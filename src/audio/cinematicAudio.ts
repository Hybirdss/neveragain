/**
 * cinematicAudio.ts — Minimal Web Audio sound design for cinematic sequences
 *
 * Three sounds:
 * - rumble: low C1 sine drone during globe zoom-in
 * - impact: short membrane-like "thud" at translucency reveal
 * - drone:  slowly rising tone during subduction tilt
 *
 * Muted by default (SNS autoplay policy). User enables via toggle button.
 * No external dependencies — pure Web Audio API.
 */

let ctx: AudioContext | null = null;
let muted = true;
let activeNodes: AudioNode[] = [];

export function enableAudio(): void {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  muted = false;
}

export function disableAudio(): void {
  muted = true;
  stopAll();
}

export function isAudioEnabled(): boolean {
  return !muted;
}

/** Low-frequency sine rumble (C1 ≈ 32.7 Hz). */
export function playRumble(durationS: number): void {
  if (muted || !ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 32.7; // C1

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationS);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationS);

  activeNodes.push(osc, gain);
  osc.onended = () => cleanup(osc, gain);
}

/** Short membrane impact — low pitched with quick decay. */
export function playImpact(): void {
  if (muted || !ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(65.4, ctx.currentTime); // C2
  osc.frequency.exponentialRampToValueAtTime(32.7, ctx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);

  activeNodes.push(osc, gain);
  osc.onended = () => cleanup(osc, gain);
}

/** Slowly rising drone (A1 → D2) for subduction tilt. */
export function playDrone(durationS: number): void {
  if (muted || !ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, ctx.currentTime); // A1
  osc.frequency.linearRampToValueAtTime(73.4, ctx.currentTime + durationS); // D2

  // Filter to soften harsh sawtooth
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + durationS * 0.7);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationS);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationS);

  activeNodes.push(osc, filter, gain);
  osc.onended = () => cleanup(osc, filter, gain);
}

export function stopAll(): void {
  for (const node of activeNodes) {
    try {
      if (node instanceof OscillatorNode) node.stop();
      node.disconnect();
    } catch { /* already stopped */ }
  }
  activeNodes = [];
}

function cleanup(...nodes: AudioNode[]): void {
  for (const n of nodes) {
    const idx = activeNodes.indexOf(n);
    if (idx !== -1) activeNodes.splice(idx, 1);
    try { n.disconnect(); } catch { /* ok */ }
  }
}
