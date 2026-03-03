/**
 * cinematicOverlay.ts — Loading / playback / skip overlay for cinematic sequences
 *
 * Two modes:
 * - loading: full-screen dim + "LOADING TILES..." text
 * - playing: transparent with skip button (bottom-right) + annotation support
 *
 * Annotations: brief text overlays with position/size options, fade-up + blur-to-sharp.
 * Audio toggle: mute/unmute button for cinematic sound.
 * Progress bar: 2px bar at viewport bottom showing sequence progress.
 * Magnitude badge: large centered → corner transition.
 * Intensity badge: JMA intensity class display.
 */

import { enableAudio, disableAudio, isAudioEnabled } from '../audio/cinematicAudio';

export interface AnnotationOptions {
  position?: 'center' | 'bottom-left';
  size?: 'large' | 'medium' | 'small';
  subtitle?: string;
}

export interface CinematicOverlayHandle {
  setMode(mode: 'loading' | 'playing'): void;
  showAnnotation(text: string, durationMs: number, options?: AnnotationOptions): void;
  setProgress(fraction: number): void;
  showMagnitude(mag: number, mode: 'large' | 'corner'): void;
  showIntensity(jmaClass: string): void;
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

  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'cinematic-overlay__progress';
  el.appendChild(progressBar);

  // Magnitude badge
  const magBadge = document.createElement('div');
  magBadge.className = 'cinematic-overlay__mag-badge';
  el.appendChild(magBadge);

  // Intensity badge
  const intensityBadge = document.createElement('div');
  intensityBadge.className = 'cinematic-overlay__intensity-badge';
  el.appendChild(intensityBadge);

  document.body.appendChild(el);

  let annotationTimer: ReturnType<typeof setTimeout> | null = null;

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

    showAnnotation(text: string, durationMs: number, options?: AnnotationOptions): void {
      // Clear any pending hide timer
      if (annotationTimer !== null) {
        clearTimeout(annotationTimer);
        annotationTimer = null;
      }

      // Reset classes
      annotationEl.className = 'cinematic-overlay__annotation';

      // Apply position
      const position = options?.position ?? 'center';
      annotationEl.classList.add(`cinematic-overlay__annotation--${position}`);

      // Apply size
      const size = options?.size ?? 'medium';
      annotationEl.classList.add(`cinematic-overlay__annotation--${size}`);

      // Set content
      if (options?.subtitle) {
        annotationEl.innerHTML =
          `${text}<span class="cinematic-overlay__annotation-subtitle">${options.subtitle}</span>`;
      } else {
        annotationEl.textContent = text;
      }

      // Trigger visible (use rAF to ensure transition fires after class reset)
      requestAnimationFrame(() => {
        annotationEl.classList.add('cinematic-overlay__annotation--visible');
      });

      // Schedule hide
      annotationTimer = setTimeout(() => {
        annotationEl.classList.remove('cinematic-overlay__annotation--visible');
        annotationTimer = null;
      }, durationMs);
    },

    setProgress(fraction: number): void {
      const clamped = Math.max(0, Math.min(1, fraction));
      progressBar.style.width = `${clamped * 100}%`;
    },

    showMagnitude(mag: number, mode: 'large' | 'corner'): void {
      magBadge.textContent = `M${mag.toFixed(1)}`;
      magBadge.className = 'cinematic-overlay__mag-badge';
      magBadge.classList.add(`cinematic-overlay__mag-badge--${mode}`);
      // Use rAF to ensure transition triggers
      requestAnimationFrame(() => {
        magBadge.classList.add('cinematic-overlay__mag-badge--visible');
      });
    },

    showIntensity(jmaClass: string): void {
      intensityBadge.textContent = `JMA ${jmaClass}`;
      intensityBadge.className = 'cinematic-overlay__intensity-badge';
      // Use rAF to ensure transition triggers
      requestAnimationFrame(() => {
        intensityBadge.classList.add('cinematic-overlay__intensity-badge--visible');
      });
    },

    remove(): void {
      if (annotationTimer !== null) {
        clearTimeout(annotationTimer);
      }
      el.remove();
      skipCallback = null;
    },
  };
}
