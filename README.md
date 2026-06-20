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

## Validation

```bash
npm run smoke
```

The smoke script expects the server to already be running on `PORT` or `5178`.
