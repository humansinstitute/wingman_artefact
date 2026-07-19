const state = {
  catalog: [],
  catalogSignature: '',
  selected: { project: '', artifact: '', version: '', page: 'index.html' },
  anchor: null,
  attachment: null,
  panelPinned: false,
  filtersCollapsed: localStorage.getItem('artifactFiltersCollapsed') !== 'false',
  user: window.ARTIFACTS_APP.user || null
};

const CATALOG_REFRESH_MS = 5000;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">A</div>
        <div>
          <div class="brand-title"></div>
          <div class="brand-subtitle">Rendered review surfaces</div>
        </div>
      </div>
      <div class="selectors">
        <label><span>Project</span><select id="project"></select></label>
        <label><span>Artifact</span><select id="artifact"></select></label>
        <label><span>Version</span><select id="version"></select></label>
        <label><span>Page</span><select id="page"></select></label>
      </div>
      <div class="toolbar">
        <span class="user-chip" id="userChip"></span>
        <span class="status" id="status"></span>
        <button class="icon-button filter-toggle" id="filterToggle" title="Hide filters" aria-label="Hide filters" aria-expanded="true"><span aria-hidden="true">x</span></button>
        <button class="icon-button" id="copy" title="Copy current artifact link" aria-label="Copy current artifact link"><span aria-hidden="true">[]</span></button>
        <button class="icon-button" id="copyShare" title="Copy share link with unlock code" aria-label="Copy share link with unlock code"><span aria-hidden="true">#</span></button>
        <button class="icon-button" id="addMember" title="Add npub to current project" aria-label="Add npub to current project"><span aria-hidden="true">+</span></button>
        <button class="icon-button" id="commentsToggle" title="Open comments" aria-label="Open comments"><span aria-hidden="true">::</span></button>
      </div>
    </header>
    <section class="project-home hidden" id="projectHome">
      <div class="project-home-inner">
        <div class="project-home-head">
          <div>
            <h1>Projects</h1>
            <p>Select a project to open its default artifact.</p>
          </div>
          <span class="project-home-user" id="projectHomeUser"></span>
        </div>
        <div class="project-grid" id="projectGrid"></div>
      </div>
    </section>
    <main class="workspace" id="workspace">
      <section class="viewer">
        <div class="frame-wrap"><iframe id="frame" title="Artifact preview"></iframe></div>
      </section>
      <aside class="panel" id="panel">
        <div class="panel-head">
          <div class="panel-head-top">
            <div class="panel-title">Comments</div>
            <button class="pin-button" id="panelPin" type="button" title="Pin comments" aria-label="Pin comments" aria-pressed="false">pin</button>
          </div>
          <div class="panel-meta" id="panelMeta"></div>
        </div>
        <div class="comments" id="comments"></div>
      </aside>
    </main>
    <form class="composer hidden" id="composer">
      <div class="composer-title">Comment on selected element</div>
      <textarea id="commentBody" placeholder="Write feedback for this element"></textarea>
      <div class="composer-actions">
        <span class="paste-note" id="pasteNote">Paste screenshot optional</span>
        <div>
          <button type="button" class="secondary" id="cancelComment">Cancel</button>
          <button class="primary">Save</button>
        </div>
      </div>
    </form>
    <section class="auth-gate hidden" id="authGate">
      <div class="auth-card">
        <div class="auth-mark" aria-hidden="true"></div>
        <h1>Private artifact</h1>
        <p>This page is private by default. Sign in with an allowed Nostr npub or use the unlock code from a share link.</p>
        <div class="auth-actions">
          <button class="primary" id="signinExtension" type="button">Nostr extension</button>
          <button class="secondary" id="signinNsec" type="button">nsec sign in</button>
        </div>
        <form class="unlock-form" id="unlockForm">
          <input id="unlockCode" inputmode="numeric" autocomplete="one-time-code" placeholder="Unlock code">
          <button class="secondary">Unlock</button>
        </form>
        <div class="auth-error" id="authError"></div>
      </div>
    </section>
    <div class="modal hidden" id="modal"><img alt="Attachment preview"></div>
  </div>
`;

const els = {
  topbar: document.querySelector('.topbar'),
  brand: document.querySelector('.brand-title'),
  selectors: document.querySelector('.selectors'),
  project: document.querySelector('#project'),
  artifact: document.querySelector('#artifact'),
  version: document.querySelector('#version'),
  page: document.querySelector('#page'),
  frame: document.querySelector('#frame'),
  workspace: document.querySelector('#workspace'),
  projectHome: document.querySelector('#projectHome'),
  projectHomeUser: document.querySelector('#projectHomeUser'),
  projectGrid: document.querySelector('#projectGrid'),
  status: document.querySelector('#status'),
  userChip: document.querySelector('#userChip'),
  panel: document.querySelector('#panel'),
  panelPin: document.querySelector('#panelPin'),
  panelMeta: document.querySelector('#panelMeta'),
  comments: document.querySelector('#comments'),
  filterToggle: document.querySelector('#filterToggle'),
  copy: document.querySelector('#copy'),
  commentsToggle: document.querySelector('#commentsToggle'),
  copyShare: document.querySelector('#copyShare'),
  addMember: document.querySelector('#addMember'),
  composer: document.querySelector('#composer'),
  commentBody: document.querySelector('#commentBody'),
  cancelComment: document.querySelector('#cancelComment'),
  pasteNote: document.querySelector('#pasteNote'),
  modal: document.querySelector('#modal'),
  authGate: document.querySelector('#authGate'),
  signinExtension: document.querySelector('#signinExtension'),
  signinNsec: document.querySelector('#signinNsec'),
  unlockForm: document.querySelector('#unlockForm'),
  unlockCode: document.querySelector('#unlockCode'),
  authError: document.querySelector('#authError')
};

function isWhiteboardSelection() {
  const value = `${state.selected.artifact}/${state.selected.page}`.toLowerCase();
  return value.includes('whiteboard') || value.includes('tldraw') || value.includes('offline-canvas');
}

function syncWhiteboardMode() {
  const whiteboard = isWhiteboardSelection();
  document.body.classList.toggle('whiteboard-mode', whiteboard);
  if (whiteboard) {
    els.composer.classList.add('hidden');
    setPanelOpen(false);
  }
  els.commentsToggle.disabled = whiteboard;
  els.commentsToggle.setAttribute('aria-hidden', String(whiteboard));
}

els.brand.textContent = window.ARTIFACTS_APP.appName;

function syncFilterToggle() {
  els.selectors.classList.toggle('filters-collapsed', state.filtersCollapsed);
  els.filterToggle.setAttribute('aria-expanded', String(!state.filtersCollapsed));
  els.filterToggle.setAttribute('aria-label', state.filtersCollapsed ? 'Show filters' : 'Hide filters');
  els.filterToggle.title = state.filtersCollapsed ? 'Show filters' : 'Hide filters';
  els.filterToggle.querySelector('span').textContent = state.filtersCollapsed ? 'v' : 'x';
  requestAnimationFrame(syncTopbarHeight);
}

function syncTopbarHeight() {
  document.documentElement.style.setProperty('--topbar-height', `${Math.ceil(els.topbar.getBoundingClientRect().height)}px`);
}

syncFilterToggle();
syncTopbarHeight();
window.addEventListener('resize', syncTopbarHeight);
if ('ResizeObserver' in window) {
  new ResizeObserver(syncTopbarHeight).observe(els.topbar);
}

function unique(rows, key) {
  return [...new Set(rows.map((row) => row[key]))].filter(Boolean);
}

function catalogSignature(rows) {
  return rows
    .map((row) => `${row.project}/${row.artifact}/${row.version}/${row.page}/${row.accessMode}`)
    .sort()
    .join('|');
}

function option(select, values, current) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join('');
  if (values.includes(current)) select.value = current;
}

function hasArtifactRoute() {
  return /^\/artifacts\/[^/]+\/[^/]+\/[^/]+\//.test(location.pathname);
}

function rowsForSelected() {
  return state.catalog.filter(
    (row) =>
      (!state.selected.project || row.project === state.selected.project) &&
      (!state.selected.artifact || row.artifact === state.selected.artifact) &&
      (!state.selected.version || row.version === state.selected.version)
  );
}

function syncSelectors() {
  const projects = unique(state.catalog, 'project');
  state.selected.project ||= projects[0] || '';
  if (!projects.includes(state.selected.project)) state.selected.project = projects[0] || '';
  option(els.project, projects, state.selected.project);

  const artifacts = unique(state.catalog.filter((row) => row.project === state.selected.project), 'artifact');
  if (!artifacts.includes(state.selected.artifact)) state.selected.artifact = artifacts[0] || '';
  option(els.artifact, artifacts, state.selected.artifact);

  const versions = unique(
    state.catalog.filter((row) => row.project === state.selected.project && row.artifact === state.selected.artifact),
    'version'
  );
  if (!versions.includes(state.selected.version)) state.selected.version = versions[0] || '';
  option(els.version, versions, state.selected.version);

  const pages = rowsForSelected().map((row) => row.page);
  if (!pages.includes(state.selected.page)) state.selected.page = pages[0] || 'index.html';
  option(els.page, pages, state.selected.page);
}

function artifactPath() {
  const { project, artifact, version } = state.selected;
  return `/artifacts/${project}/${artifact}/${version}/`;
}

function framePath() {
  const { project, artifact, version, page } = state.selected;
  const review = isWhiteboardSelection() ? '?review=disabled' : '';
  return `/artifact-frame/${project}/${artifact}/${version}/${page}${review}`;
}

function setRoute() {
  history.replaceState(null, '', artifactPath());
  els.authGate.classList.add('hidden');
  els.projectHome.classList.add('hidden');
  els.workspace.classList.remove('home-hidden');
  els.frame.src = framePath();
  const accessMode = rowsForSelected().find((row) => row.page === state.selected.page)?.accessMode || 'private';
  els.status.textContent = accessMode;
  els.status.dataset.mode = accessMode;
  els.panelMeta.textContent = `${state.selected.project}/${state.selected.artifact}/${state.selected.version}/${state.selected.page}`;
  syncWhiteboardMode();
  loadComments();
}

function parseRouteSelection() {
  const routeMatch = location.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)\/([^/]+)\//);
  if (!routeMatch) return false;
  state.selected.project = decodeURIComponent(routeMatch[1]);
  state.selected.artifact = decodeURIComponent(routeMatch[2]);
  state.selected.version = decodeURIComponent(routeMatch[3]);
  return true;
}

function selectedPageFromCatalog() {
  const pages = rowsForSelected().map((row) => row.page);
  if (!pages.includes(state.selected.page)) state.selected.page = pages[0] || 'index.html';
}

async function fetchCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error(`Catalog refresh failed: ${response.status}`);
  return response.json();
}

function updateUserChip() {
  if (state.user?.npub) {
    els.userChip.textContent = `${state.user.npub.slice(0, 10)}...${state.user.npub.slice(-6)}`;
    els.userChip.dataset.signedIn = 'true';
  } else {
    els.userChip.textContent = 'signed out';
    els.userChip.dataset.signedIn = 'false';
  }
}

async function unlockFromUrl() {
  const code = new URLSearchParams(location.search).get('unlock');
  if (!code) return;
  parseRouteSelection();
  const payload = { ...state.selected, page: state.selected.page || 'index.html', code };
  const response = await fetch('/api/auth/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unlock failed');
  }
  history.replaceState(null, '', artifactPath());
}

async function loadCatalog() {
  updateUserChip();
  const routeSelected = parseRouteSelection();
  await unlockFromUrl();
  const data = await fetchCatalog();
  state.catalog = data.rows;
  state.user = data.user || state.user;
  state.catalogSignature = catalogSignature(data.rows);
  updateUserChip();

  syncSelectors();
  selectedPageFromCatalog();
  if (!state.catalog.length || !state.selected.project) {
    if (state.user?.npub) {
      showProjectHome('No projects available for this key.');
    } else {
      showAuthGate('Sign in or unlock a shared artifact link.');
    }
    return;
  }
  if (!routeSelected && state.user?.npub) {
    showProjectHome();
    return;
  }
  setRoute();
}

async function refreshCatalog() {
  // Never let a background catalog update replace an active artifact iframe.
  // This guard is intentionally inside the refresh function as well as the
  // interval setup, covering callbacks from an older timer after navigation.
  if (state.selected.project && state.selected.version) return;
  const data = await fetchCatalog();
  state.user = data.user || state.user;
  updateUserChip();
  const nextSignature = catalogSignature(data.rows);
  if (nextSignature === state.catalogSignature) return;

  const previousSelection = { ...state.selected };
  state.catalog = data.rows;
  state.catalogSignature = nextSignature;
  syncSelectors();

  const selectionChanged =
    previousSelection.project !== state.selected.project ||
    previousSelection.artifact !== state.selected.artifact ||
    previousSelection.version !== state.selected.version ||
    previousSelection.page !== state.selected.page;
  if (selectionChanged) setRoute();
}

function startCatalogRefresh() {
  // Once an artifact is open, keep its iframe and editor session stable.
  // Refreshing the catalog is only useful on the project home screen.
  if (state.selected.project && state.selected.version) return;
  setInterval(() => {
    if (state.selected.project && state.selected.version) return;
    refreshCatalog().catch((error) => {
      els.status.textContent = error.message;
      els.status.dataset.mode = 'error';
    });
  }, CATALOG_REFRESH_MS);
}

async function loadComments() {
  if (isWhiteboardSelection()) {
    els.comments.innerHTML = '';
    notifyFrame([]);
    return;
  }
  const { project, artifact, version, page } = state.selected;
  const response = await fetch(`/api/comments/${project}/${artifact}/${version}?page=${encodeURIComponent(page)}`);
  if (response.status === 403) {
    showAuthGate('Sign in or unlock this page to view comments.');
    notifyFrame([]);
    return;
  }
  const data = await response.json();
  const comments = data.comments || [];
  if (!comments.length) {
    els.comments.innerHTML = `
      <div class="empty">
        <div class="empty-mark" aria-hidden="true"></div>
        <strong>No comments on this page/version yet.</strong>
        <span>Right-click an element in the preview to leave anchored feedback.</span>
      </div>
    `;
    notifyFrame([]);
    return;
  }
  els.comments.innerHTML = comments
    .map((comment, index) => {
      const tone = ['teal', 'amber', 'blue', 'rose'][index % 4];
      return `
        <article class="comment ${comment.status === 'resolved' ? 'resolved' : ''}" data-tone="${tone}">
          <div class="comment-top">
            <span class="comment-state">${comment.status}</span>
            <span>${new Date(comment.created_at).toLocaleString()}</span>
            ${
              comment.status === 'open'
                ? `<button class="resolve" data-resolve="${comment.id}">Resolve</button>`
                : ''
            }
          </div>
          <div class="comment-body">${escapeHtml(comment.body)}</div>
          <div class="selector">${escapeHtml(comment.element_selector)}</div>
          ${comment.attachments
            .map(
              (attachment) =>
                `<div class="attachment"><img src="/feedback-assets/${attachment.filePath}" alt="Screenshot attachment"></div>`
            )
            .join('')}
        </article>
      `;
    })
    .join('');
  notifyFrame(comments);
}

function showAuthGate(message) {
  els.frame.removeAttribute('src');
  els.projectHome.classList.add('hidden');
  els.workspace.classList.remove('home-hidden');
  els.status.textContent = 'private';
  els.status.dataset.mode = 'private';
  els.authError.textContent = message || '';
  els.authGate.classList.remove('hidden');
}

function rowsForProject(project) {
  return state.catalog.filter((row) => row.project === project);
}

function defaultSelectionForProject(project) {
  const rows = rowsForProject(project);
  return rows.find((row) => row.page === 'index.html') || rows[0] || null;
}

function showProjectHome(message = '') {
  els.frame.removeAttribute('src');
  els.authGate.classList.add('hidden');
  els.workspace.classList.add('home-hidden');
  els.projectHome.classList.remove('hidden');
  els.status.textContent = 'home';
  els.status.dataset.mode = 'copied';
  els.projectHomeUser.textContent = state.user?.npub ? `${state.user.npub.slice(0, 10)}...${state.user.npub.slice(-6)}` : '';

  const projects = unique(state.catalog, 'project');
  if (!projects.length) {
    els.projectGrid.innerHTML = `<div class="empty">${escapeHtml(message || 'No projects available.')}</div>`;
    return;
  }
  els.projectGrid.innerHTML = projects
    .map((project) => {
      const rows = rowsForProject(project);
      const artifacts = unique(rows, 'artifact');
      const versions = unique(rows, 'version');
      return `
        <button class="project-tile" type="button" data-project="${escapeHtml(project)}">
          <strong>${escapeHtml(project)}</strong>
          <span>${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'} · ${versions.length} version${versions.length === 1 ? '' : 's'}</span>
        </button>
      `;
    })
    .join('');
}

function notifyFrame(comments) {
  els.frame.contentWindow?.postMessage(
    {
      type: 'artifact-comments',
      selectors: comments.filter((comment) => comment.status === 'open').map((comment) => comment.element_selector)
    },
    location.origin
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function openComposer(anchor, clientX, clientY) {
  state.anchor = anchor;
  state.attachment = null;
  els.commentBody.value = '';
  els.pasteNote.textContent = 'Paste screenshot optional';
  els.composer.classList.remove('hidden');
  els.composer.style.left = `${Math.min(clientX, window.innerWidth - 380)}px`;
  els.composer.style.top = `${Math.min(clientY, window.innerHeight - 230)}px`;
  els.commentBody.focus();
}

function setPanelOpen(open) {
  els.panel.classList.toggle('open', open);
  els.workspace.classList.toggle('panel-pinned', open && state.panelPinned);
  els.commentsToggle.setAttribute('aria-pressed', String(open));
  els.commentsToggle.setAttribute('title', open ? 'Close comments' : 'Open comments');
  els.commentsToggle.setAttribute('aria-label', open ? 'Close comments' : 'Open comments');
}

function setPanelPinned(pinned) {
  state.panelPinned = pinned;
  els.workspace.classList.toggle('panel-pinned', pinned && els.panel.classList.contains('open'));
  els.panelPin.setAttribute('aria-pressed', String(pinned));
  els.panelPin.textContent = pinned ? 'unpin' : 'pin';
  els.panelPin.setAttribute('title', pinned ? 'Unpin comments' : 'Pin comments');
  els.panelPin.setAttribute('aria-label', pinned ? 'Unpin comments' : 'Pin comments');
  if (pinned) setPanelOpen(true);
}

els.project.addEventListener('change', () => {
  state.selected.project = els.project.value;
  state.selected.artifact = '';
  state.selected.version = '';
  state.selected.page = '';
  syncSelectors();
  setRoute();
});

els.artifact.addEventListener('change', () => {
  state.selected.artifact = els.artifact.value;
  state.selected.version = '';
  state.selected.page = '';
  syncSelectors();
  setRoute();
});

els.version.addEventListener('change', () => {
  state.selected.version = els.version.value;
  state.selected.page = '';
  syncSelectors();
  setRoute();
});

els.page.addEventListener('change', () => {
  state.selected.page = els.page.value;
  setRoute();
});

els.filterToggle.addEventListener('click', () => {
  state.filtersCollapsed = !state.filtersCollapsed;
  localStorage.setItem('artifactFiltersCollapsed', String(state.filtersCollapsed));
  syncFilterToggle();
});

els.copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(new URL(artifactPath(), location.origin).toString());
  els.status.textContent = 'link copied';
  els.status.dataset.mode = 'copied';
  setTimeout(() => setRoute(), 900);
});

els.copyShare.addEventListener('click', async () => {
  const { project, artifact, version, page } = state.selected;
  const response = await fetch(`/api/share/${project}/${artifact}/${version}/${page}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'code' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    els.status.textContent = data.error || 'share failed';
    els.status.dataset.mode = 'error';
    return;
  }
  const url = new URL(data.sharePath, location.origin);
  url.searchParams.set('unlock', data.code);
  await navigator.clipboard.writeText(url.toString());
  els.status.textContent = 'share link copied';
  els.status.dataset.mode = 'code';
  await refreshCatalog();
});

els.addMember.addEventListener('click', async () => {
  const npub = window.prompt('Add npub to this project');
  if (!npub) return;
  const response = await fetch(`/api/projects/${state.selected.project}/members`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ npub, role: 'read' })
  });
  const data = await response.json().catch(() => ({}));
  els.status.textContent = response.ok ? 'npub added' : data.error || 'add failed';
  els.status.dataset.mode = response.ok ? 'copied' : 'error';
});

els.projectGrid.addEventListener('click', (event) => {
  const tile = event.target.closest('[data-project]');
  if (!tile) return;
  const row = defaultSelectionForProject(tile.dataset.project);
  if (!row) return;
  state.selected.project = row.project;
  state.selected.artifact = row.artifact;
  state.selected.version = row.version;
  state.selected.page = row.page || 'index.html';
  syncSelectors();
  setRoute();
});

els.commentsToggle.addEventListener('click', () => {
  setPanelOpen(!els.panel.classList.contains('open'));
});

els.panelPin.addEventListener('click', () => {
  setPanelPinned(!state.panelPinned);
});

els.cancelComment.addEventListener('click', () => els.composer.classList.add('hidden'));

els.composer.addEventListener('paste', (event) => {
  const file = [...event.clipboardData.files].find((item) => item.type.startsWith('image/'));
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.attachment = { dataUrl: reader.result };
    els.pasteNote.textContent = file.name || 'Screenshot attached';
  };
  reader.readAsDataURL(file);
});

els.composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.anchor || !els.commentBody.value.trim()) return;
  const { project, artifact, version, page } = state.selected;
  await fetch(`/api/comments/${project}/${artifact}/${version}/${page}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...state.anchor,
      body: els.commentBody.value,
      attachment: state.attachment
    })
  });
  els.composer.classList.add('hidden');
  setPanelOpen(true);
  await loadComments();
});

els.comments.addEventListener('click', async (event) => {
  const resolve = event.target.closest('[data-resolve]');
  if (resolve) {
    await fetch(`/api/comments/${resolve.dataset.resolve}/resolve`, { method: 'PATCH' });
    await loadComments();
    return;
  }
  const image = event.target.closest('.attachment img');
  if (image) {
    els.modal.querySelector('img').src = image.src;
    els.modal.classList.remove('hidden');
  }
});

els.modal.addEventListener('click', () => els.modal.classList.add('hidden'));

els.signinExtension.addEventListener('click', async () => {
  if (!window.nostr?.getPublicKey) {
    els.authError.textContent = 'No Nostr browser extension found.';
    return;
  }
  els.authError.textContent = '';
  try {
    const pubkey = await window.nostr.getPublicKey();
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ npub: pubkey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      els.authError.textContent = data.error || 'Sign in failed';
      return;
    }
    state.user = data.user;
    history.replaceState(null, '', '/');
    await loadCatalog();
  } catch (error) {
    els.authError.textContent = error?.message || 'Sign in failed';
  }
});

els.signinNsec.addEventListener('click', async () => {
  const nsec = window.prompt('Paste nsec. It is used once to sign in and is not stored.');
  if (!nsec) return;
  const response = await fetch('/api/auth/nsec', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nsec })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    els.authError.textContent = data.error || 'Sign in failed';
    return;
  }
  state.user = data.user;
  history.replaceState(null, '', '/');
  await loadCatalog();
});

els.unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parseRouteSelection();
  const response = await fetch('/api/auth/unlock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...state.selected, page: state.selected.page || 'index.html', code: els.unlockCode.value })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    els.authError.textContent = data.error || 'Unlock failed';
    return;
  }
  await loadCatalog();
});

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'artifact-anchor') return;
  openComposer(event.data.anchor, event.data.clientX + els.frame.getBoundingClientRect().left, event.data.clientY + els.frame.getBoundingClientRect().top);
});

els.frame.addEventListener('load', loadComments);

loadCatalog()
  .then(startCatalogRefresh)
  .catch((error) => {
    els.status.textContent = error.message;
    els.status.dataset.mode = 'error';
  });
