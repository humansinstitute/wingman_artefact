import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';

function displayName(slug) {
  return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromHtml(filePath, fallback) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
    return match ? match[1].replace(/\s+/g, ' ').trim() : fallback;
  } catch {
    return fallback;
  }
}

function dirs(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs.readdirSync(parent, { withFileTypes: true }).filter((entry) => entry.isDirectory());
}

function htmlFiles(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
}

export function scanArtifacts() {
  fs.mkdirSync(config.artifactsDir, { recursive: true });
  const now = new Date().toISOString();

  const projectStmt = db.prepare(`
    INSERT INTO projects (slug, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
    RETURNING id
  `);
  const artifactStmt = db.prepare(`
    INSERT INTO artifacts (project_id, slug, title, created_by_npub, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, slug) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at
    RETURNING id
  `);
  const versionStmt = db.prepare(`
    INSERT INTO artifact_versions (artifact_id, version_slug, filesystem_path, entrypoint_path, created_at, created_by_npub)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(artifact_id, version_slug) DO UPDATE SET
      filesystem_path = excluded.filesystem_path,
      entrypoint_path = excluded.entrypoint_path
    RETURNING id
  `);
  const pageStmt = db.prepare(`
    INSERT INTO artifact_pages (version_id, page_path, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(version_id, page_path) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at
    RETURNING id
  `);
  const accessStmt = db.prepare(`
    INSERT OR IGNORE INTO artifact_access
      (artifact_id, version_id, page_id, mode, allowed_npub, is_public, created_at, updated_at)
    VALUES (?, ?, ?, 'private', ?, 0, ?, ?)
  `);
  const memberStmt = db.prepare(`
    INSERT INTO project_members (project_id, npub, role, created_at, updated_at)
    VALUES (?, ?, 'edit', ?, ?)
    ON CONFLICT(project_id, npub) DO UPDATE SET role = 'edit', updated_at = excluded.updated_at
  `);

  db.exec('BEGIN');
  try {
    for (const projectDir of dirs(config.artifactsDir)) {
      const projectId = projectStmt.get(projectDir.name, displayName(projectDir.name), now, now).id;
      memberStmt.run(projectId, config.ownerNpub, now, now);
      for (const artifactDir of dirs(path.join(config.artifactsDir, projectDir.name))) {
        const artifactId = artifactStmt.get(
          projectId,
          artifactDir.name,
          displayName(artifactDir.name),
          config.ownerNpub,
          now,
          now
        ).id;
        for (const versionDir of dirs(path.join(config.artifactsDir, projectDir.name, artifactDir.name))) {
          const versionPath = path.join(config.artifactsDir, projectDir.name, artifactDir.name, versionDir.name);
          const pages = htmlFiles(versionPath);
          if (!pages.length) continue;
          const entrypoint = pages.includes('index.html') ? 'index.html' : pages[0];
          const versionId = versionStmt.get(
            artifactId,
            versionDir.name,
            versionPath,
            entrypoint,
            now,
            config.ownerNpub
          ).id;
          for (const pagePath of pages) {
            const title = titleFromHtml(path.join(versionPath, pagePath), displayName(artifactDir.name));
            const pageId = pageStmt.get(versionId, pagePath, title, now, now).id;
            accessStmt.run(artifactId, versionId, pageId, config.ownerNpub, now, now);
          }
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
