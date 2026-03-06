/**
 * Alert Sound — Web Audio API professional alert tones.
 *
 * Generates clean, non-alarming tones for earthquake notifications.
 * Designed for operator consoles: attention-getting but calm.
 * No external audio files — all synthesized.
 *
 * Sound design reference:
 * - Watch (M4.5-5.4): Single soft tone — subtle notification
 * - Priority (M5.5-6.4): Double ascending tone — please attend
 * - Critical (M6.5+): Triple ascending tone — immediate attention
 *
 * All tones use sine waves (pure, non-harsh) with smooth
 * attack/release envelopes to avoid clicks.
 */

type AlertLevel = 'watch' | 'priority' | 'critical';

interface ToneSpec {
  frequency: number;
  duration: number; // seconds
  volume: number;   // 0-1
}

// Tone sequences per alert level
// Frequencies chosen from musical scale for pleasant sound:
// C5=523, E5=659, G5=784, C6=1047
const TONE_SEQUENCES: Record<AlertLevel, ToneSpec[]> = {
  watch: [
    { frequency: 523, duration: 0.15, volume: 0.12 },
  ],
  priority: [
    { frequency: 523, duration: 0.12, volume: 0.18 },
    { frequency: 659, duration: 0.12, volume: 0.18 },
  ],
  critical: [
    { frequency: 523, duration: 0.15, volume: 0.22 },
    { frequency: 659, duration: 0.15, volume: 0.22 },
    { frequency: 784, duration: 0.20, volume: 0.22 },
  ],
};

const TONE_GAP = 0.08; // seconds between tones in a sequence
const ATTACK = 0.01;   // seconds — fast but click-free
const RELEASE = 0.05;  // seconds — smooth tail

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a single tone with smooth envelope.
 */
function playTone(
  ctx: AudioContext,
  spec: ToneSpec,
  startTime: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = spec.frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Envelope: attack → sustain → release
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(spec.volume, startTime + ATTACK);
  gain.gain.setValueAtTime(spec.volume, startTime + spec.duration - RELEASE);
  gain.gain.linearRampToValueAtTime(0, startTime + spec.duration);

  osc.start(startTime);
  osc.stop(startTime + spec.duration + 0.01);
}

/**
 * Map earthquake magnitude to alert level.
 */
export function magnitudeToAlertLevel(magnitude: number): AlertLevel | null {
  if (magnitude >= 6.5) return 'critical';
  if (magnitude >= 5.5) return 'priority';
  if (magnitude >= 4.5) return 'watch';
  return null;
}

/**
 * Play an alert tone sequence for the given level.
 * Returns immediately; audio plays asynchronously.
 */
export function playAlertSound(level: AlertLevel): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const tones = TONE_SEQUENCES[level];
  let offset = ctx.currentTime + 0.05; // small buffer

  for (const tone of tones) {
    playTone(ctx, tone, offset);
    offset += tone.duration + TONE_GAP;
  }
}

/**
 * Play alert for a specific earthquake magnitude.
 * No-op if magnitude is below watch threshold.
 */
export function playEarthquakeAlert(magnitude: number): void {
  const level = magnitudeToAlertLevel(magnitude);
  if (level) playAlertSound(level);
}
