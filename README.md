# Artifact WApp

Standalone Wingman WApp MVP for publishing rendered HTML artifacts and collecting page/version-specific review comments.

## Run

```bash
PORT=5178 npm start
```

The app honors `PORT` and serves the canonical artifact route:

```text
/artifacts/:project/:artifactId/:version/
```

## Artifact Layout

Agents publish files directly under:

```text
artifacts/<project>/<artifactId>/<version>/
```

The scanner infers projects, artifacts, versions, and HTML pages from disk and persists metadata in SQLite at `data/artifacts.sqlite`. Feedback screenshots pasted into a comment are stored under the selected version's `fdback/` folder.

## MVP Features

- Browse projects, artifacts, versions, and pages from path-inferred metadata.
- Render selected artifact pages in a constrained iframe.
- Copy the current artifact/version URL.
- Right-click or long-press rendered elements to create anchored comments.
- Store comments by artifact page and version.
- Resolve comments without deleting history.
- Paste a screenshot into the comment composer and view it inline.
- Default each discovered page/version to private access for the configured owner npub.
- Enforce private-by-default artifact access at request time for catalog rows, rendered frames, frame assets, comments, and feedback assets.
- Sign in with a Nostr browser extension or one-time nsec entry.
- Add npubs to a project so they can browse that project's private artifact pages.
- Copy a code-gated share link for a specific page/version; the unlock code grants access only to that page/version.

## Access Model

Private is the default for every scanned page. The configured `ARTIFACTS_OWNER_NPUB` can access and manage all projects. Project members can be added by npub from the toolbar and can read that project's private pages.

Specific pages can be opened up as public or code-gated records in `artifact_access`. The toolbar's share action creates a short unlock code and copies a link with `?unlock=<code>`. Unlocking stores a signed browser cookie scoped to that page/version; it does not expose sibling projects, artifacts, versions, or pages.

When this app is running under Wingman app management, source changes require an approved managed-app restart before the hosted URL serves the new code.

## Validation

```bash
npm run smoke
```

The smoke script expects the server to already be running on `PORT` or `5178`.
