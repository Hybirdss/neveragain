/**
 * Wave Orchestrator — P/S wave animation loop via requestAnimationFrame.
 */

import { store } from '../store/appState';
import { updateWaveState, isWaveActive } from '../engine/wavePropagation';
import type { EarthquakeEvent } from '../types';

let animationId: number | null = null;

export function startWaveAnimation(event: EarthquakeEvent): void {
  stopWaveAnimation();

  const originTime = event.time;

  function animate(): void {
    const waveState = updateWaveState(
      { lat: event.lat, lng: event.lng },
      event.depth_km,
      originTime,
      Date.now(),
    );

    store.set('waveState', waveState);

    const { pActive, sActive } = isWaveActive(waveState, 40);
    if (pActive || sActive) {
      animationId = requestAnimationFrame(animate);
    } else {
      animationId = null;
    }
  }

  animate();
}

export function stopWaveAnimation(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function disposeWaveOrchestrator(): void {
  stopWaveAnimation();
}
