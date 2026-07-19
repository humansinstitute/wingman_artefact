import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_identity (
      id TEXT PRIMARY KEY,
      owner_npub TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      created_by_npub TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS artifact_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      version_slug TEXT NOT NULL,
      filesystem_path TEXT NOT NULL,
      entrypoint_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by_npub TEXT NOT NULL,
      UNIQUE(artifact_id, version_slug)
    );

    CREATE TABLE IF NOT EXISTS artifact_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
      page_path TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(version_id, page_path)
    );

    CREATE TABLE IF NOT EXISTS artifact_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      version_id INTEGER REFERENCES artifact_versions(id) ON DELETE CASCADE,
      page_id INTEGER REFERENCES artifact_pages(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK (mode IN ('private', 'public', 'code')),
      allowed_npub TEXT,
      access_code_hash TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(artifact_id, version_id, page_id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      npub TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'read' CHECK (role IN ('read', 'edit')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(project_id, npub)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id INTEGER NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      version_id INTEGER NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
      page_id INTEGER NOT NULL REFERENCES artifact_pages(id) ON DELETE CASCADE,
      element_selector TEXT NOT NULL,
      element_node_id TEXT,
      element_fingerprint TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
      created_by_npub TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comment_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_identity (id, owner_npub, display_name, created_at, updated_at)
    VALUES ('default', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_npub = excluded.owner_npub,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
  `).run(config.ownerNpub, config.appName, now, now);
}

export function one(sql, ...params) {
  return db.prepare(sql).get(...params);
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}
