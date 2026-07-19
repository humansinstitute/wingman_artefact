const templates = {
  company: {
    title: 'Company workspace',
    summary: '5 scopes, 17 channels. Every scope and channel includes chat, task board, docs, and files.',
    button: 'Create company workspace',
    access: 'Access default: private until people or groups are granted to channels.',
    scopes: [
      {
        name: 'Company HQ',
        note: 'Shared operating context for company-level coordination.',
        channels: ['Leadership', 'Operating rhythm', 'Policy decisions']
      },
      {
        name: 'Product',
        note: 'Where product direction and delivery decisions happen.',
        channels: ['Roadmap', 'Core app', 'Integrations', 'Releases']
      },
      {
        name: 'Customer Operations',
        note: 'Customer-facing work across accounts and support.',
        channels: ['Key accounts', 'Support escalations', 'Renewals']
      },
      {
        name: 'Growth',
        note: 'Market, partnership, and pipeline work.',
        channels: ['Campaigns', 'Partnerships', 'Pipeline']
      },
      {
        name: 'People and Admin',
        note: 'Internal team and business administration.',
        channels: ['Hiring', 'Onboarding', 'Budget planning', 'Vendor contracts']
      }
    ]
  },
  personal: {
    title: 'Personal workspace',
    summary: '4 scopes, 12 channels. Every scope and channel includes chat, task board, docs, and files.',
    button: 'Create personal workspace',
    access: 'Access default: owner only until another person or agent is granted to a channel.',
    scopes: [
      {
        name: 'Personal HQ',
        note: 'Your main operating space for planning and decisions.',
        channels: ['Weekly planning', 'Daily review', 'Decisions']
      },
      {
        name: 'Projects',
        note: 'Active personal work that needs a place to move forward.',
        channels: ['Active projects', 'Ideas', 'Reviews']
      },
      {
        name: 'Life Admin',
        note: 'Recurring practical work outside projects.',
        channels: ['Home', 'Finance', 'Travel']
      },
      {
        name: 'Learning',
        note: 'Research, reading, and experiments worth keeping together.',
        channels: ['Research', 'Reading', 'Experiments']
      }
    ]
  }
};

let selectedTemplate = 'company';
let selectedScope = 0;

const title = document.querySelector('#template-title');
const summary = document.querySelector('#template-summary');
const scopeList = document.querySelector('#scope-list');
const scopeTitle = document.querySelector('#scope-title');
const scopeNote = document.querySelector('#scope-note');
const channelList = document.querySelector('#channel-list');
const accessCopy = document.querySelector('#access-copy');
const createButton = document.querySelector('#create-button');
const switchButtons = [...document.querySelectorAll('.switch-button')];

function render() {
  const template = templates[selectedTemplate];
  const scope = template.scopes[selectedScope] || template.scopes[0];

  title.textContent = template.title;
  summary.textContent = template.summary;
  accessCopy.innerHTML = `<strong>Access default:</strong> ${template.access.replace(/^Access default:\s*/, '')}`;
  createButton.textContent = template.button;

  switchButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.template === selectedTemplate);
  });

  scopeList.innerHTML = '';
  template.scopes.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scope-button${index === selectedScope ? ' active' : ''}`;
    button.innerHTML = `<strong>${item.name}</strong><span>${item.channels.length} channels</span>`;
    button.addEventListener('click', () => {
      selectedScope = index;
      render();
    });
    scopeList.appendChild(button);
  });

  scopeTitle.textContent = scope.name;
  scopeNote.textContent = scope.note;
  channelList.innerHTML = '';
  scope.channels.forEach((channel) => {
    const card = document.createElement('article');
    card.className = 'channel-card';
    card.innerHTML = `<strong>${channel}</strong><span>Work context channel</span>`;
    channelList.appendChild(card);
  });
}

switchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedTemplate = button.dataset.template;
    selectedScope = 0;
    render();
  });
});

render();
