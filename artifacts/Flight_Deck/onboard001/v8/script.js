const templates = {
  company: {
    goals: [
      ['Coordinate leadership', 'Strategy, ideas, and decisions need a visible home.'],
      ['Ship product', 'Roadmap, features, bugs, implementation, and releases.'],
      ['Grow the business', 'Marketing, campaigns, partnerships, and pipeline.'],
      ['Serve customers', 'Key accounts and support escalations.']
    ],
    scopes: [
      { name: 'Leadership', note: 'Shared direction and executive decisions.', selected: true, channels: ['Strategy', 'Ideas'].map(name => ({ name, selected: true })) },
      { name: 'Product', note: 'Product direction and delivery work.', selected: true, channels: ['Roadmap', 'Features', 'Bugs', 'Implementation', 'Releases'].map(name => ({ name, selected: true })) },
      { name: 'Customer Operations', note: 'Customer-facing work across accounts and support.', selected: true, channels: ['Key accounts', 'Support escalations'].map(name => ({ name, selected: true })) },
      { name: 'Growth', note: 'Market, partnership, and pipeline work.', selected: true, channels: ['Marketing', 'Campaigns', 'Partnerships', 'Pipeline'].map(name => ({ name, selected: true })) }
    ]
  },
  personal: {
    goals: [
      ['Plan the week', 'Keep planning, reviews, and decisions together.'],
      ['Manage life admin', 'Home, finances, and schedule.'],
      ['Move projects forward', 'Active projects, ideas, and reviews.'],
      ['Keep learning visible', 'Research, reading, and experiments.']
    ],
    scopes: [
      { name: 'Home', note: 'Personal operating context for recurring life admin.', selected: true, channels: ['Finances', 'Schedule'].map(name => ({ name, selected: true })) },
      { name: 'Projects', note: 'Active personal work that needs a place to move forward.', selected: true, channels: ['Active projects', 'Ideas', 'Reviews'].map(name => ({ name, selected: true })) },
      { name: 'Learning', note: 'Research, reading, and experiments worth keeping together.', selected: true, channels: ['Research', 'Reading', 'Experiments'].map(name => ({ name, selected: true })) }
    ]
  }
};

const titles = [
  'Connect to a Tower',
  'Choose or create a workspace',
  'What kind of workspace is this?',
  'What should this workspace help with?',
  'Choose the spaces to create'
];

let step = 1;
let selectedTower = 'demo';
let selectedWorkspace = 'new';
let selectedTemplate = 'company';
let selectedScope = 0;
let backgroundCreateRunning = false;

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const wizardTitle = qs('#wizard-title');
const wizardSteps = qs('#wizard-steps');
const screens = qsa('.wizard-screen');
const towerButtons = qsa('.connect-host-row');
const workspaceButtons = qsa('.connect-workspace-row');
const choiceCards = qsa('.choice-card');
const goalList = qs('#goal-list');
const scopeList = qs('#scope-list');
const scopeTitle = qs('#scope-title');
const scopeNote = qs('#scope-note');
const channelList = qs('#channel-list');
const summary = qs('#wizard-summary');
const backButton = qs('#back-button');
const nextButton = qs('#next-button');
const towerInput = qs('#tower-input');
const workspaceInput = qs('#workspace-input');
const connectedTower = qs('#connected-tower');
const workspaceStatus = qs('#workspace-status');
const workspaceName = qs('#workspace-name');
const workspaceMeta = qs('#workspace-meta');
const workspaceAvatar = qs('#workspace-avatar');
const scopeChip = qs('#scope-chip');
const channelChip = qs('#channel-chip');
const stageTitle = qs('#stage-title');
const stageCopy = qs('#stage-copy');
const towerWriteList = qs('#tower-write-list');
const towerPayload = qs('#tower-payload');
const automationToggle = qs('#automation-toggle');
const automationDetails = qs('#automation-details');

function template() {
  return templates[selectedTemplate];
}

function activeScope() {
  return template().scopes[selectedScope] || template().scopes[0];
}

function selectedCounts() {
  const scopes = template().scopes.filter((scope) => scope.selected);
  const channels = scopes.reduce((count, scope) => count + scope.channels.filter((channel) => channel.selected).length, 0);
  return { scopes: scopes.length, channels };
}

function workspaceLabel() {
  return selectedWorkspace === 'existing' ? 'Adapt Demo Workspace' : workspaceInput.value.trim() || 'New workspace';
}

function selectedTowerLabel() {
  return selectedTower === 'local' ? 'Local Tower' : 'Demo Tower';
}

function selectedTowerUrl() {
  return towerInput.value.trim() || (selectedTower === 'local' ? 'http://127.0.0.1:3100' : 'https://tower.demo.runwingman.local');
}

function renderChrome() {
  wizardTitle.textContent = titles[step - 1];
  wizardSteps.innerHTML = '';
  titles.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = `step-dot${index + 1 === step ? ' active' : ''}`;
    dot.textContent = index + 1;
    wizardSteps.appendChild(dot);
  });
  screens.forEach((screen) => screen.classList.toggle('active', Number(screen.dataset.screen) === step));
  backButton.textContent = step === 1 ? 'Skip for now' : 'Back';
  nextButton.textContent = step === 1
    ? 'Connect'
    : step === 2
      ? selectedWorkspace === 'existing' ? 'Open workspace' : 'Create workspace'
      : step === titles.length
        ? 'Done'
        : 'Continue';
}

function renderConnection() {
  towerButtons.forEach((button) => button.classList.toggle('active', button.dataset.tower === selectedTower));
  workspaceButtons.forEach((button) => button.classList.toggle('active', button.dataset.workspace === selectedWorkspace));
  connectedTower.textContent = selectedTowerLabel();
  const hasWorkspace = step >= 3;
  workspaceStatus.textContent = hasWorkspace ? 'Connected' : selectedTower === 'demo' ? 'Demo' : 'Local';
  workspaceName.textContent = hasWorkspace ? workspaceLabel() : 'No workspace connected';
  workspaceMeta.textContent = hasWorkspace ? selectedTowerUrl() : 'Choose a Tower to begin';
  workspaceAvatar.textContent = hasWorkspace ? workspaceLabel().charAt(0).toUpperCase() : 'N';
  stageTitle.textContent = hasWorkspace ? workspaceLabel() : 'Connect a workspace';
  stageCopy.textContent = hasWorkspace
    ? backgroundCreateRunning
      ? 'Creating workspace, spaces, channels, grants, and local materialized views in the background.'
      : 'This workspace is empty until starter scopes and channels are created.'
    : 'Flight Deck opens first, then guides the user through Tower, workspace, and starter spaces.';
}

function renderChoices() {
  choiceCards.forEach((card) => card.classList.toggle('active', card.dataset.template === selectedTemplate));
}

function renderGoals() {
  goalList.innerHTML = '';
  template().goals.forEach(([title, copy], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `goal-card${index < 2 ? ' active' : ''}`;
    button.innerHTML = `<span>Goal</span><strong>${title}</strong><small>${copy}</small>`;
    button.addEventListener('click', () => button.classList.toggle('active'));
    goalList.appendChild(button);
  });
}

function renderScopes() {
  const current = activeScope();
  scopeList.innerHTML = '';
  template().scopes.forEach((scope, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scope-button${index === selectedScope ? ' active' : ''}`;
    button.innerHTML = `
      <input type="checkbox" ${scope.selected ? 'checked' : ''} aria-label="Create ${scope.name}">
      <strong>${scope.name}</strong>
      <span>${scope.channels.filter((channel) => channel.selected).length} channels</span>
    `;
    button.addEventListener('click', (event) => {
      if (event.target?.tagName === 'INPUT') {
        scope.selected = event.target.checked;
      } else {
        selectedScope = index;
      }
      render();
    });
    scopeList.appendChild(button);
  });

  scopeTitle.textContent = current.name;
  scopeNote.textContent = current.note;
  channelList.innerHTML = '';
  current.channels.forEach((channel) => {
    const label = document.createElement('label');
    label.className = 'channel-card';
    label.innerHTML = `
      <input type="checkbox" ${channel.selected ? 'checked' : ''}>
      <span><strong>${channel.name}</strong><span>Channel</span></span>
    `;
    label.querySelector('input').addEventListener('change', (event) => {
      channel.selected = event.target.checked;
      render();
    });
    channelList.appendChild(label);
  });
}

function towerWritePayload() {
  const scopes = template().scopes
    .filter((scope) => scope.selected)
    .map((scope) => ({
      name: scope.name,
      description: scope.note,
      channels: scope.channels.filter((channel) => channel.selected).map((channel) => ({ name: channel.name, kind: 'channel' }))
    }));
  return {
    tower: selectedTowerUrl(),
    workspace: selectedWorkspace === 'new'
      ? { action: 'create', name: workspaceLabel(), description: qs('#workspace-description').value.trim() }
      : { action: 'open', name: workspaceLabel() },
    bootstrap: { template: selectedTemplate, scopes }
  };
}

function renderTowerWrites() {
  const counts = selectedCounts();
  const rows = [
    selectedWorkspace === 'new'
      ? 'POST /api/v4/flightdeck-pg/workspaces to create the workspace.'
      : 'GET /api/v4/flightdeck-pg/workspaces and select the existing workspace.',
    'POST one scope row for each selected top-level work area.',
    'POST channel rows under each created scope.',
    'Create owner/admin grants immediately; add member or guest channel grants later.',
    'Refresh Flight Deck Dexie materialization from Tower PG so the empty shell becomes the real workspace.'
  ];
  towerWriteList.innerHTML = rows.map((row) => `<li>${row}</li>`).join('');
  towerPayload.textContent = JSON.stringify(towerWritePayload(), null, 2);
  scopeChip.textContent = backgroundCreateRunning
    ? 'Creating spaces'
    : counts.scopes > 0 ? `${counts.scopes} scopes ready` : 'No scopes selected';
  channelChip.textContent = backgroundCreateRunning ? 'Background setup running' : `${counts.channels} channels ready`;
}

function renderSummary() {
  const counts = selectedCounts();
  summary.textContent = step === 1
    ? 'Demo Tower is prefilled so the flow can be reviewed without real credentials.'
    : step === 2
      ? 'Create a workspace first, then bootstrap spaces inside it.'
      : step === 5
        ? `${counts.scopes} scopes and ${counts.channels} channels selected. Create runs the Tower updates in the background.`
        : 'Private until people or groups are granted to channels.';
}

function render() {
  renderChrome();
  renderConnection();
  renderChoices();
  renderGoals();
  renderScopes();
  renderTowerWrites();
  renderSummary();
}

towerButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedTower = button.dataset.tower;
    towerInput.value = selectedTower === 'local' ? 'http://127.0.0.1:3100' : 'https://tower.demo.runwingman.local';
    render();
  });
});

workspaceButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedWorkspace = button.dataset.workspace;
    render();
  });
});

choiceCards.forEach((card) => {
  card.addEventListener('click', () => {
    selectedTemplate = card.dataset.template;
    selectedScope = 0;
    render();
  });
});

[towerInput, workspaceInput, qs('#workspace-description')].forEach((input) => input.addEventListener('input', render));

nextButton.addEventListener('click', () => {
  if (step < titles.length) step += 1;
  else {
    backgroundCreateRunning = true;
    workspaceStatus.textContent = 'Creating';
  }
  render();
});

backButton.addEventListener('click', () => {
  if (step > 1) step -= 1;
  render();
});

automationToggle.addEventListener('click', () => {
  const expanded = automationToggle.getAttribute('aria-expanded') === 'true';
  automationToggle.setAttribute('aria-expanded', String(!expanded));
  automationDetails.hidden = expanded;
  automationToggle.textContent = expanded ? 'Show background note' : 'Hide background note';
});

render();
