if (!/\/(?:whiteboard|tldraw|offline-canvas)(?:\/|$)/i.test(window.location.pathname)) {
function stableTarget(node) {
  return node.closest('[data-artifact-node-id], button, a, input, textarea, select, [role], h1, h2, h3, section, article, main, div, p') || node;
}

function cssSelector(element) {
  if (element.dataset.artifactNodeId) return `[data-artifact-node-id="${CSS.escape(element.dataset.artifactNodeId)}"]`;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();
    const classes = [...current.classList].slice(0, 2);
    if (classes.length) part += classes.map((name) => `.${CSS.escape(name)}`).join('');
    const parent = current.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((child) => child.tagName === current.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
  }
  return parts.join(' > ') || 'body';
}

function fingerprint(element) {
  const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const hints = [element.getAttribute('role'), element.id, [...element.classList].slice(0, 3).join('.')].filter(Boolean).join('|');
  return `${element.tagName.toLowerCase()}|${hints}|${text}`;
}

function mark(selectors) {
  document.querySelectorAll('[data-artifact-commented]').forEach((element) => {
    element.removeAttribute('data-artifact-commented');
  });
  selectors.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((element) => element.setAttribute('data-artifact-commented', 'true'));
    } catch {
      // Ignore stale selectors from older versions.
    }
  });
}

document.addEventListener('contextmenu', (event) => {
  const target = stableTarget(event.target);
  event.preventDefault();
  target.setAttribute('data-artifact-selected', 'true');
  setTimeout(() => target.removeAttribute('data-artifact-selected'), 1200);
  window.parent.postMessage(
    {
      type: 'artifact-anchor',
      clientX: event.clientX,
      clientY: event.clientY,
      anchor: {
        elementSelector: cssSelector(target),
        elementNodeId: target.dataset.artifactNodeId || null,
        elementFingerprint: fingerprint(target)
      }
    },
    window.location.origin
  );
});

let pressTimer = null;
document.addEventListener('touchstart', (event) => {
  pressTimer = setTimeout(() => {
    const touch = event.touches[0];
    const target = stableTarget(event.target);
    window.parent.postMessage(
      {
        type: 'artifact-anchor',
        clientX: touch.clientX,
        clientY: touch.clientY,
        anchor: {
          elementSelector: cssSelector(target),
          elementNodeId: target.dataset.artifactNodeId || null,
          elementFingerprint: fingerprint(target)
        }
      },
      window.location.origin
    );
  }, 650);
});
document.addEventListener('touchend', () => clearTimeout(pressTimer));

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== 'artifact-comments') return;
  mark(event.data.selectors || []);
});

const style = document.createElement('style');
style.textContent = `
  [data-artifact-selected] { outline: 3px solid #116b5b !important; outline-offset: 3px !important; }
  [data-artifact-commented] { outline: 2px solid #d18b00 !important; outline-offset: 2px !important; }
`;
document.head.appendChild(style);
}
