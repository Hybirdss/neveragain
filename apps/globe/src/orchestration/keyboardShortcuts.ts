/**
 * Keyboard Shortcuts — Global keydown handler.
 */

import { store } from '../store/appState';
import { openSearch } from '../ui/searchBar';

export function initKeyboardShortcuts(): () => void {
  function handleKeyboard(e: KeyboardEvent): void {
    // CMD+K / Ctrl+K → open search overlay
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
      return;
    }

    // Don't handle shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case 'd':
        store.set('viewPreset', 'default');
        break;
      case 'u':
        store.set('viewPreset', 'underground');
        break;
      case 's':
        store.set('viewPreset', 'shakemap');
        break;
      case 'x':
        store.set('viewPreset', 'crossSection');
        break;
      case 'escape':
        store.set('viewPreset', 'default');
        break;
      case ' ':
        e.preventDefault();
        const tl = store.get('timeline');
        store.set('timeline', { ...tl, isPlaying: !tl.isPlaying });
        break;
    }
  }

  document.addEventListener('keydown', handleKeyboard);

  return () => {
    document.removeEventListener('keydown', handleKeyboard);
  };
}
