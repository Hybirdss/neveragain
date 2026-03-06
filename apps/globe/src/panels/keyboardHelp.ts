/**
 * Keyboard Help Overlay — Shows available keyboard shortcuts.
 *
 * Triggered by '?' key. Dismisses with Escape or another '?'.
 * Glassmorphism overlay matching console design language.
 */

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: [isMac ? '⌘' : 'Ctrl', 'K'], label: 'Command palette' },
      { keys: ['J', '/', 'K'], label: 'Next / previous event' },
      { keys: ['T'], label: 'Cycle timeline range' },
      { keys: ['1–5'], label: 'Switch bundle' },
      { keys: ['Esc'], label: 'Close overlay / deselect' },
    ],
  },
  {
    title: 'Controls',
    shortcuts: [
      { keys: ['S'], label: 'Toggle scenario mode' },
      { keys: ['B'], label: 'Toggle bundle drawer' },
      { keys: ['P'], label: 'Toggle panels' },
      { keys: ['F'], label: 'Toggle faults layer' },
    ],
  },
  {
    title: 'Information',
    shortcuts: [
      { keys: ['?'], label: 'Show this help' },
      { keys: [','], label: 'Open settings' },
    ],
  },
];

function renderHelp(): string {
  const groups = SHORTCUT_GROUPS.map((group) => {
    const rows = group.shortcuts.map((s) => {
      const keys = s.keys.map((k) => `<kbd class="nz-help__key">${k}</kbd>`).join('');
      return `
        <div class="nz-help__row">
          <span class="nz-help__keys">${keys}</span>
          <span class="nz-help__label">${s.label}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="nz-help__group">
        <div class="nz-help__group-title">${group.title}</div>
        ${rows}
      </div>
    `;
  }).join('');

  return `
    <div class="nz-help">
      <div class="nz-help__header">
        <span class="nz-help__title">Keyboard Shortcuts</span>
        <kbd class="nz-help__key">?</kbd>
      </div>
      ${groups}
    </div>
  `;
}

export interface KeyboardHelp {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createKeyboardHelp(): KeyboardHelp {
  let visible = false;

  const overlay = document.createElement('div');
  overlay.className = 'nz-help-overlay';
  overlay.innerHTML = renderHelp();

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    if (visible) return;
    visible = true;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('nz-help-overlay--open'));
  }

  function close(): void {
    if (!visible) return;
    visible = false;
    overlay.classList.remove('nz-help-overlay--open');
    setTimeout(() => {
      if (!visible && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  function toggle(): void {
    if (visible) close(); else open();
  }

  return {
    open,
    close,
    toggle,
    isOpen: () => visible,
    dispose() {
      close();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
