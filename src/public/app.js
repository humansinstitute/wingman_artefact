const state = {
  catalog: [],
  selected: { project: '', artifact: '', version: '', page: 'index.html' },
  anchor: null,
  attachment: null
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-title"></div>
        <div class="brand-subtitle">Private by default</div>
      </div>
      <div class="selectors">
        <select id="project"></select>
        <select id="artifact"></select>
        <select id="version"></select>
        <select id="page"></select>
      </div>
      <div class="toolbar">
        <span class="status" id="status"></span>
        <button class="icon-button" id="copy" title="Copy current artifact link" aria-label="Copy current artifact link">⧉</button>
        <button class="icon-button" id="commentsToggle" title="Open comments" aria-label="Open comments">☰</button>
      </div>
    </header>
    <main class="workspace">
      <section class="viewer">
        <div class="frame-wrap"><iframe id="frame" title="Artifact preview"></iframe></div>
      </section>
      <aside class="panel" id="panel">
        <div class="panel-head">
          <div class="panel-title">Comments</div>
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
    <div class="modal hidden" id="modal"><img alt="Attachment preview"></div>
  </div>
`;

const els = {
  brand: document.querySelector('.brand-title'),
  project: document.querySelector('#project'),
  artifact: document.querySelector('#artifact'),
  version: document.querySelector('#version'),
  page: document.querySelector('#page'),
  frame: document.querySelector('#frame'),
  status: document.querySelector('#status'),
  panel: document.querySelector('#panel'),
  panelMeta: document.querySelector('#panelMeta'),
  comments: document.querySelector('#comments'),
  copy: document.querySelector('#copy'),
  commentsToggle: document.querySelector('#commentsToggle'),
  composer: document.querySelector('#composer'),
  commentBody: document.querySelector('#commentBody'),
  cancelComment: document.querySelector('#cancelComment'),
  pasteNote: document.querySelector('#pasteNote'),
  modal: document.querySelector('#modal')
};

els.brand.textContent = window.ARTIFACTS_APP.appName;

function unique(rows, key) {
  return [...new Set(rows.map((row) => row[key]))].filter(Boolean);
}

function option(select, values, current) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join('');
  if (values.includes(current)) select.value = current;
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
  return `/artifact-frame/${project}/${artifact}/${version}/${page}`;
}

function setRoute() {
  history.replaceState(null, '', artifactPath());
  els.frame.src = framePath();
  els.status.textContent = rowsForSelected().find((row) => row.page === state.selected.page)?.accessMode || 'private';
  els.panelMeta.textContent = `${state.selected.project}/${state.selected.artifact}/${state.selected.version}/${state.selected.page}`;
  loadComments();
}

async function loadCatalog() {
  const response = await fetch('/api/catalog');
  const data = await response.json();
  state.catalog = data.rows;

  const routeMatch = location.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)\/([^/]+)\//);
  if (routeMatch) {
    state.selected.project = decodeURIComponent(routeMatch[1]);
    state.selected.artifact = decodeURIComponent(routeMatch[2]);
    state.selected.version = decodeURIComponent(routeMatch[3]);
  }

  syncSelectors();
  setRoute();
}

async function loadComments() {
  const { project, artifact, version, page } = state.selected;
  const response = await fetch(`/api/comments/${project}/${artifact}/${version}?page=${encodeURIComponent(page)}`);
  const data = await response.json();
  const comments = data.comments || [];
  if (!comments.length) {
    els.comments.innerHTML = '<div class="empty">No comments on this page/version yet.</div>';
    notifyFrame([]);
    return;
  }
  els.comments.innerHTML = comments
    .map(
      (comment) => `
        <article class="comment ${comment.status === 'resolved' ? 'resolved' : ''}">
          <div class="comment-top">
            <span>${new Date(comment.created_at).toLocaleString()} · ${comment.status}</span>
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
      `
    )
    .join('');
  notifyFrame(comments);
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

els.copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(new URL(artifactPath(), location.origin).toString());
  els.status.textContent = 'link copied';
  setTimeout(() => setRoute(), 900);
});

els.commentsToggle.addEventListener('click', () => {
  els.panel.classList.toggle('open');
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
  els.panel.classList.add('open');
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

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'artifact-anchor') return;
  openComposer(event.data.anchor, event.data.clientX + els.frame.getBoundingClientRect().left, event.data.clientY + els.frame.getBoundingClientRect().top);
});

els.frame.addEventListener('load', loadComments);

loadCatalog().catch((error) => {
  els.status.textContent = error.message;
});
