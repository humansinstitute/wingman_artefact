const templates = {
  company: {
    goals: [
      ['Coordinate leadership', 'Strategy, ideas, and decisions need a visible home.'],
      ['Ship product', 'Roadmap, features, bugs, implementation, and releases.'],
      ['Grow the business', 'Marketing, campaigns, partnerships, and pipeline.'],
      ['Serve customers', 'Key accounts and support escalations.']
    ],
    scopes: [
      {
        name: 'Leadership',
        note: 'Shared direction and executive decisions.',
        selected: true,
        channels: [
          { name: 'Strategy', selected: true },
          { name: 'Ideas', selected: true }
        ]
      },
      {
        name: 'Product',
        note: 'Product direction and delivery work.',
        selected: true,
        channels: [
          { name: 'Roadmap', selected: true },
          { name: 'Features', selected: true },
          { name: 'Bugs', selected: true },
          { name: 'Implementation', selected: true },
          { name: 'Releases', selected: true }
        ]
      },
      {
        name: 'Customer Operations',
        note: 'Customer-facing work across accounts and support.',
        selected: true,
        channels: [
          { name: 'Key accounts', selected: true },
          { name: 'Support escalations', selected: true }
        ]
      },
      {
        name: 'Growth',
        note: 'Market, partnership, and pipeline work.',
        selected: true,
        channels: [
          { name: 'Marketing', selected: true },
          { name: 'Campaigns', selected: true },
          { name: 'Partnerships', selected: true },
          { name: 'Pipeline', selected: true }
        ]
      }
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
      {
        name: 'Home',
        note: 'Personal operating context for recurring life admin.',
        selected: true,
        channels: [
          { name: 'Finances', selected: true },
          { name: 'Schedule', selected: true }
        ]
      },
      {
        name: 'Projects',
        note: 'Active personal work that needs a place to move forward.',
        selected: true,
        channels: [
          { name: 'Active projects', selected: true },
          { name: 'Ideas', selected: true },
          { name: 'Reviews', selected: true }
        ]
      },
      {
        name: 'Learning',
        note: 'Research, reading, and experiments worth keeping together.',
        selected: true,
        channels: [
          { name: 'Research', selected: true },
          { name: 'Reading', selected: true },
          { name: 'Experiments', selected: true }
        ]
      }
    ]
  }
};

let step = 1;
let selectedTemplate = 'company';
let selectedScope = 0;

const wizardTitle = document.querySelector('#wizard-title');
const stepDots = [...document.querySelectorAll('.step-dot')];
const screens = [...document.querySelectorAll('.wizard-screen')];
const choiceCards = [...document.querySelectorAll('.choice-card')];
const goalList = document.querySelector('#goal-list');
const scopeList = document.querySelector('#scope-list');
const scopeTitle = document.querySelector('#scope-title');
const scopeNote = document.querySelector('#scope-note');
const channelList = document.querySelector('#channel-list');
const summary = document.querySelector('#wizard-summary');
const backButton = document.querySelector('#back-button');
const nextButton = document.querySelector('#next-button');

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

function renderWizardChrome() {
  stepDots.forEach((dot, index) => dot.classList.toggle('active', index + 1 === step));
  screens.forEach((screen) => screen.classList.toggle('active', Number(screen.dataset.screen) === step));
  wizardTitle.textContent = step === 1
    ? 'What kind of workspace is this?'
    : step === 2
      ? 'What should this workspace help with?'
      : 'Choose the spaces to create';
  backButton.textContent = step === 1 ? 'Skip for now' : 'Back';
  nextButton.textContent = step === 3 ? `Create ${selectedCounts().scopes} scopes` : 'Continue';
}

function renderChoices() {
  choiceCards.forEach((card) => {
    card.classList.toggle('active', card.dataset.template === selectedTemplate);
  });
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

function renderSummary() {
  const counts = selectedCounts();
  summary.textContent = step === 3
    ? `${counts.scopes} scopes and ${counts.channels} channels selected. Private until people or groups are granted to channels.`
    : 'Private until people or groups are granted to channels.';
}

function render() {
  renderWizardChrome();
  renderChoices();
  renderGoals();
  renderScopes();
  renderSummary();
}

choiceCards.forEach((card) => {
  card.addEventListener('click', () => {
    selectedTemplate = card.dataset.template;
    selectedScope = 0;
    render();
  });
});

nextButton.addEventListener('click', () => {
  if (step < 3) step += 1;
  render();
});

backButton.addEventListener('click', () => {
  if (step > 1) step -= 1;
  render();
});

render();
