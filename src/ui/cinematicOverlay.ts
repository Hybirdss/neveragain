/**
 * cinematicOverlay.ts — Loading / playback / skip overlay for cinematic sequences
 *
 * Two modes:
 * - loading: full-screen dim + "LOADING TILES..." text
 * - playing: transparent with skip button (bottom-right) + annotation support
 *
 * Annotations: brief text overlays (e.g. "地下を見る") that fade in/out.
 * Audio toggle: mute/unmute button for cinematic sound.
 */

import { enableAudio, disableAudio, isAudioEnabled } from '../audio/cinematicAudio';

export interface CinematicOverlayHandle {
  setMode(mode: 'loading' | 'playing'): void;
  showAnnotation(text: string, durationMs: number): void;
  remove(): void;
}

let skipCallback: (() => void) | null = null;

/** Register the skip handler — called by cinematicSequence. */
export function onSkip(cb: () => void): void {
  skipCallback = cb;
}

export function showCinematicOverlay(
  initialMode: 'loading' | 'playing',
): CinematicOverlayHandle {
  const el = document.createElement('div');
  el.className = 'cinematic-overlay';

  // Loading content
  const loadingEl = document.createElement('div');
  loadingEl.className = 'cinematic-overlay__loading';
  loadingEl.innerHTML = `
    <div class="cinematic-overlay__loading-text">LOADING TILES</div>
    <div class="cinematic-overlay__loading-dots">...</div>
  `;
  el.appendChild(loadingEl);

  // Skip button
  const skipBtn = document.createElement('button');
  skipBtn.className = 'cinematic-overlay__skip';
  skipBtn.type = 'button';
  skipBtn.textContent = 'SKIP ▶▶';
  skipBtn.style.display = 'none';
  skipBtn.addEventListener('click', () => {
    if (skipCallback) skipCallback();
  });
  el.appendChild(skipBtn);

  // Audio toggle
  const audioBtn = document.createElement('button');
  audioBtn.className = 'cinematic-overlay__audio';
  audioBtn.type = 'button';
  audioBtn.textContent = isAudioEnabled() ? '🔊' : '🔇';
  audioBtn.style.display = 'none';
  audioBtn.addEventListener('click', () => {
    if (isAudioEnabled()) {
      disableAudio();
      audioBtn.textContent = '🔇';
    } else {
      enableAudio();
      audioBtn.textContent = '🔊';
    }
  });
  el.appendChild(audioBtn);

  // Annotation container
  const annotationEl = document.createElement('div');
  annotationEl.className = 'cinematic-overlay__annotation';
  el.appendChild(annotationEl);

  document.body.appendChild(el);

  function setMode(mode: 'loading' | 'playing'): void {
    if (mode === 'loading') {
      loadingEl.style.display = 'flex';
      skipBtn.style.display = 'none';
      audioBtn.style.display = 'none';
      el.style.background = 'rgba(5, 8, 15, 0.7)';
    } else {
      loadingEl.style.display = 'none';
      skipBtn.style.display = 'block';
      audioBtn.style.display = 'block';
      el.style.background = 'transparent';
      el.style.pointerEvents = 'none';
      skipBtn.style.pointerEvents = 'auto';
      audioBtn.style.pointerEvents = 'auto';
    }
  }

  setMode(initialMode);

  return {
    setMode,
    showAnnotation(text: string, durationMs: number): void {
      annotationEl.textContent = text;
      annotationEl.classList.add('cinematic-overlay__annotation--visible');
      setTimeout(() => {
        annotationEl.classList.remove('cinematic-overlay__annotation--visible');
      }, durationMs);
    },
    remove(): void {
      el.remove();
      skipCallback = null;
    },
  };
}
