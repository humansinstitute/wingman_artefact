<!--
Local snapshot of Flight Deck document.
Document ID: 18ee6d7a-667d-46eb-8a52-c9d9a8f8c49c
Title: Design: Artifact WApp
Row version: 16
-->

# Artifacts WApp - Product Shape

## Recommendation

Build Artifacts as a standalone Autopilot-hosted WApp first, then add it to Pete's Flight Deck as a link/card once the WApp is usable.

Build it in `~/code/wingmanbefree/artifact-wapp` as a minimal standalone Wingman WApp. If an existing local WApp template can be copied cleanly, use it only as scaffolding; do not make the MVP depend on Flight Deck-native document or task surfaces.

Artifacts should be the place agents use when an output is better reviewed as rendered HTML than as chat text or a Flight Deck document. It should support information pages, document-style outputs, visual proposals, interactive web examples, and other HTML deliverables. The core value is not just display; it is review: Pete should be able to open an artifact, right-click a specific rendered element, leave feedback, optionally attach screenshots, and have that feedback stored against the exact artifact page and version.

For v1, each running Artifacts WApp is scoped to one Autopilot/agent identity. The UI can say `Rick's Artifacts` or `Lara's Artifacts`; it does not need a top-level creator/npub folder in every route. Internally the app should still record the owning npub for access, provenance, and future federation.

## Product Model

Artifacts has three primary user-facing levels inside an agent-owned WApp:

- Project: a human-readable workspace such as `Flight_Deck`.
- Artifact: a named deliverable inside a project, such as `onboard001`.
- Version: an immutable or mostly-stable folder for a specific review state, such as `v1` or `v2`.

The canonical filesystem layout should be:

```text
<wappdir>/artifacts/<project>/<artifactId>/<version>/
```

The generated review URL should be a real link agents can paste back to Pete:

```text
https://<wapp-url>/artifacts/Flight_Deck/onboard001/v1/
```

The toolbar should include a copy-link action that copies the current artifact/version URL. Pete can then point Wingman back to a precise artifact/version in later instructions.

A new version can start as a direct copy of the previous version folder, for example `cp -R v1 v2`, then the agent edits `v2`. Comments remain attached to the version URL and page they were created on.

## MVP Scope

The first build should prove the full review loop with one local Autopilot instance, one agent-owned Artifacts WApp, filesystem publishing, SQLite metadata, and Pete review.

MVP capabilities:

- Serve generated HTML from the filesystem layout above.
- Browse by project, artifact, and version.
- Use a compact header/navigation bar with dropdowns similar to Flight Deck scope/channel selectors.
- Include toolbar actions for copy current link and open comments.
- Let an agent publish by writing files directly into the correct folder.
- Infer basic metadata from paths, then persist it in SQLite when discovered.
- Maintain SQLite records for app identity, projects, artifacts, versions, pages, access rules, comments, and attachments.
- Render the selected artifact version in a constrained content area.
- Support right-click element comments using the Adapt proposal WApp interaction pattern.
- Support comments on the current page and version, not only the artifact as a whole.
- Show existing comments for the current artifact page/version in a toolbar-opened comments panel.
- Let comments be resolved without deleting history.
- Support private access for Pete's npub by default, public sharing for a specific page/version, and code-gated sharing for a specific page/version.
- Support the first demo with two versions of the same artifact, showing that comments remain separate per version.

Flight Deck integration should be deliberately small at first: add the WApp as a link/card for Pete after the standalone WApp works. Do not make the first version depend on Flight Deck-native document or task surfaces.

## Publishing Flow

1. Pete asks an agent for a reviewable HTML output, for example: `Rick, generate two Flight Deck mobile onboarding examples and put them in Artifacts under project Flight_Deck`.
2. The agent creates or updates files under `<wappdir>/artifacts/<project>/<artifactId>/<version>/`.
3. Artifacts scans or refreshes lightweight metadata so the page appears in project/artifact/version navigation.
4. The agent reports the artifact ID, version URL as a clickable link, and current sharing mode.
5. Pete opens the artifact URL, reviews the rendered HTML, and leaves comments on specific elements.
6. The agent creates a new version when responding to feedback, leaving prior version comments intact.

Example agent response:

```text
Artifacts generated: onboard001
URL: https://<wapp-url>/artifacts/Flight_Deck/onboard001/v1/
Sharing: private to Pete's npub
```

## Data Model

Use SQLite for application state and feedback, but keep artifact HTML and assets on disk so agents can edit generated files directly.

Minimum tables:

- `app_identity`: id, owner_npub, display_name, created_at, updated_at.
- `projects`: id, slug, name, created_at, updated_at.
- `artifacts`: id, project_id, slug, title, created_by_npub, created_at, updated_at.
- `artifact_versions`: id, artifact_id, version_slug, filesystem_path, entrypoint_path, created_at, created_by_npub.
- `artifact_pages`: id, version_id, page_path, title, created_at, updated_at.
- `artifact_access`: id, artifact_id, version_id nullable, page_id nullable, mode, allowed_npub, access_code_hash, is_public, created_at, updated_at.
- `comments`: id, artifact_id, version_id, page_id, element_selector, element_node_id, element_fingerprint, body, status, created_by_npub, created_at, resolved_at.
- `comment_attachments`: id, comment_id, kind, file_path, mime_type, size_bytes, created_at.

Metadata should be path-inferred for the first pass because that is simpler for TUI agents. A small register/update API can be added after the filesystem loop works, mainly for titles, sharing settings, and version notes.

## Element Feedback

Reuse the Adapt proposal WApp pattern:

- Right-click or long-press an element in the rendered artifact.
- Open a compact comment composer.
- Save the comment to SQLite.
- Visually mark elements with comments.
- Provide a comments icon in the toolbar that opens the comments list for the current page/version.
- Allow comments to be resolved without deleting history.

For MVP anchoring, use a hybrid anchor:

- Record the page path, because a version may contain more than one HTML page.
- Prefer `data-artifact-node-id` when present.
- Also record a CSS selector for immediate lookup.
- Also record a lightweight element fingerprint from tag name, text snippet, role/id/class hints, and DOM position.
- When JavaScript renders the clicked target, attach to the nearest stable rendered HTML element that can be described by the same hybrid anchor.

This gives agents a simple way to make durable review targets while still allowing comments on ordinary HTML that was not instrumented in advance.

## Feedback Assets

Each version may include a feedback asset folder, for example:

```text
<wappdir>/artifacts/Flight_Deck/onboard001/v1/fdback/
```

Screenshots pasted or attached in the comment composer can be stored there and linked from `comment_attachments`. The comments panel should show small inline previews and open images larger in a modal.

This folder is for review assets, not source application assets. Agents should preserve it when copying `v1` to `v2` only if Pete explicitly wants previous screenshots carried forward; otherwise comments and attachments remain associated with their original version.

## Access Model

Default access should be private. If Pete is logged in with his npub, he can see everything in the WApp. Other users cannot browse unrelated projects, artifacts, versions, or pages by default.

Artifacts needs three page/version-level share modes:

- Private to Pete's npub or another explicit npub.
- Public for a specific artifact page/version.
- Share link with a short access code, such as a six-digit PIN, for lightweight external review.

Users who receive a public or code-gated page/version link may review that page/version and, when allowed, add comments. That permission should not imply access to sibling projects, artifacts, versions, or hidden pages.

Access should be evaluated at artifact page/version request time. Flight Deck launcher/card visibility is separate from in-WApp authorization; both need to be configured before claiming someone has access.

## Agent Skill Update

After the WApp exists, update and install Wingman skills so agents know when to use Artifacts.

Skill guidance should say:

- Use Artifacts for complex outputs that benefit from rendered HTML, visual inspection, interactive review, or element-level feedback.
- Publish into the current agent's Artifacts WApp under a clear project/artifact/version path.
- Report the artifact URL, artifact ID, version, and sharing mode back to Pete.
- Include clickable links when communicating artifact outputs.
- Treat new rounds of feedback as new artifact versions unless Pete explicitly asks to overwrite.

## Post-MVP Ideas

- Add a reusable artifacts library of common layouts, components, and review page patterns that agents can copy into new artifacts.
- Add an explicit register/update API once path-inferred publishing is proven.
- Support richer cross-agent browsing later if Pete wants one Artifacts portal that aggregates multiple agent-owned WApps.

## First Demo Definition

The first successful demo should show:

1. `Rick's Artifacts` running as an Autopilot-hosted WApp.
2. One project, one artifact, and two versions, such as `Flight_Deck/onboard001/v1` and `v2`.
3. A real artifact URL for each version.
4. Private access for Pete by default.
5. A page/version-specific public or code-gated share option.
6. Right-click element comments on rendered HTML.
7. A toolbar comments icon that opens the current page/version comment list.
8. At least one screenshot attachment stored under that version's `fdback/` folder and shown in the comment panel.
9. Evidence that comments for `v1` and `v2` remain separate.

## Implementation Start

Start with the smallest standalone WApp that proves the filesystem and review loop:

1. Scaffold `~/code/wingmanbefree/artifact-wapp` as a Wingman-managed WApp that honors the assigned `PORT`.
2. Create the `artifacts/` folder convention and a sample `Flight_Deck/onboard001/v1/` and `v2/` artifact.
3. Add SQLite tables and path scanning before adding any register/update API.
4. Implement the artifact browser, constrained render area, toolbar copy-link action, toolbar comments panel, and right-click/long-press comment composer.
5. Add private-by-default access first, then page/version public and six-digit code-gated sharing.
6. Register/start through Autopilot appctl and smoke-test the returned WApp URL.

## Remaining Direction

This is ready to turn into an implementation task. The main direction is settled:

- WApp-first.
- Per-agent WApp identity instead of a required creator-npub URL level.
- Path-inferred publishing first.
- Default-private access with per-page/version public and code-gated sharing.
- Comments anchored to page, version, and rendered element.
- Two-version demo as the acceptance target.

No further product-shape questions are needed before implementation. Resolve the open document comments once Pete is happy with this final version; they have been folded into the spec but should remain visible until he confirms.

## Source Thread

- Channel: @[source chat](mention:channel:58286ef8-9d91-40a7-830d-611bf267742d)
- Thread: @[discussion thread](mention:message:e03ba90a-30a2-4d23-8b8a-8b7d5d2ccb7d)
- Latest request: @[final review request](mention:message:98fcda69-810d-4fd3-b904-d1931ec0b949)

Pete asked for one final review round after updating the doc and adding comments. This version folds those comments into the implementation-ready shape and narrows the next step to building the standalone MVP.

---

## Flight Deck Comments

<comment id="19bf6d33-1ec3-4f90-a6db-ed67548d026e" author="npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy" created_at="2026-06-20T10:32:08.359Z">
Whilst this is probably an npub on disk the display in the web form would be the agent Name e.g Rick .

If there are more than 1 rick then we could differentiate with teh last four chars of the pub Rick (...2kwj)
</comment>

<comment id="2e06e808-c377-455c-acbb-19c7f951db55" author="npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy" created_at="2026-06-20T10:37:49.552Z">
One thing worth bearing in mind here is that there is only one Agent ID on an autopilot, so by default there is only 1 npub. So perhaps we should simplify and strip the npub folder from the stack.

Instead the specific Wapp becomes "Rick's Artifacts" or "Lara's Artifacts" for a lara autopilot.
</comment>

<comment id="d7df5205-902b-4683-82de-56fb97e08c08" author="npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy" created_at="2026-06-20T10:40:51.252Z">
Access control is important here. The idea would be - if logged in with my npub for instance I can see everything. 

I can however choose to 1. publicly share only a specific webpage or share it with a code gate i.e. 6 digit tandom pin. 

But by default a user wouldnt be able to access any other site or version. They could however be allowed to right click and add comments.
</comment>

<comment id="27af6841-2ec3-4b29-9173-e82d092a0d31" author="npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy" created_at="2026-06-20T10:45:02.046Z">
I think you should also write the "page" ? i.e. this would be a specific HTML element that I am clicking, or the closest to one that is rendering via javascript script.
</comment>

<comment id="b818e7cc-4bcc-4e1e-9873-d3420d97e6ee" author="npub1jss47s4fvv6usl7tn6yp5zamv2u60923ncgfea0e6thkza5p7c3q0afmzy" created_at="2026-06-20T10:47:43.560Z">
I think it would be cool to allow a feedback folder in each version v1/fdback/screenshot.jpg

Which coul dbe used for grabbing screen shots nad pasting them into the comment box. These are referenced from the comment and shown inline in the comment body (when clicked they open larger in a modal).
</comment>

<comment id="7ff2301e-de5f-4239-bbdf-23b1e6c50bf0" author="npub1s4658awhcachmhzk5jhsg256gzdl7e4gh5a9zq8skjyt7g3k2axql224qz" created_at="2026-06-20T10:55:01.835Z">
Folded in. The final spec now treats each Artifacts WApp as agent-owned, e.g. Rick's Artifacts, with display name in the UI and owner npub kept internally for provenance/access rather than requiring a creator-npub URL level.
</comment>

<comment id="88ec3f4c-58bd-417c-944d-9ce63a3e17bb" author="npub1s4658awhcachmhzk5jhsg256gzdl7e4gh5a9zq8skjyt7g3k2axql224qz" created_at="2026-06-20T10:55:01.836Z">
Folded in. The final spec adds a feedback asset folder such as v1/fdback/, comment_attachments metadata, inline screenshot previews, and modal expansion.
</comment>

<comment id="8fea952a-7ce5-4827-b503-a14056d9a4a1" author="npub1s4658awhcachmhzk5jhsg256gzdl7e4gh5a9zq8skjyt7g3k2axql224qz" created_at="2026-06-20T10:55:01.864Z">
Folded in. The data model now includes artifact_pages, and element comments are anchored to page, version, and the nearest stable rendered HTML element for JavaScript-rendered content.
</comment>

<comment id="3840f01c-e4ba-4eb8-865c-cc1922bab31e" author="npub1s4658awhcachmhzk5jhsg256gzdl7e4gh5a9zq8skjyt7g3k2axql224qz" created_at="2026-06-20T10:55:01.864Z">
Folded in. Access is now default-private for Pete's npub, with public and short-code sharing scoped to a specific page/version rather than granting broad browse access.
</comment>

<comment id="0e5ac24e-7fdd-4972-b347-ad03233529c0" author="npub1s4658awhcachmhzk5jhsg256gzdl7e4gh5a9zq8skjyt7g3k2axql224qz" created_at="2026-06-20T10:55:10.966Z">
Agreed and incorporated. The route is now <wappdir>/artifacts/<project>/<artifactId>/<version>/ with the WApp identity carrying the agent name, so TUI agents do not have to manage a top-level npub folder.
</comment>
