/**
 * Blockwright's interaction sounds.
 *
 * Synthesised with the Web Audio API rather than shipped as files: a handful of
 * short tones costs nothing to download, has no licensing question, and can be
 * tuned by ear in code. The palette is deliberately narrow — a soft wooden
 * knock for confirmations, a rising pair for connection, a low thud for failure
 * — so the product has a recognisable voice rather than a pile of stock beeps.
 *
 * Rules this file exists to enforce:
 * - Nothing plays until the user has interacted with the page. Browsers enforce
 *   this anyway; relying on that instead of respecting it would just mean the
 *   first sound arrives at a random moment.
 * - Nothing plays above a quiet ceiling. These are feedback, not alerts.
 * - Every sound is tied to something that actually happened.
 * - Muting is honoured immediately and persists.
 */

export type SoundName =
  | "send"
  | "complete"
  | "validated"
  | "error"
  | "connect"
  | "disconnect"
  | "approve"
  | "toggle";

const STORAGE_KEY = "blockwright:sound";
const MASTER_GAIN = 0.16; // quiet ceiling; feedback, never an alert

let context: AudioContext | null = null;
let enabled: boolean | null = null;

/** Read once, then keep in memory — this is read on every interaction. */
export function soundEnabled(): boolean {
  if (enabled !== null) return enabled;
  if (typeof window === "undefined") return false;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    /* private browsing; the in-memory value still applies for this session */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  // Created before the first gesture, an AudioContext starts suspended.
  if (context.state === "suspended") void context.resume();
  return context;
}

interface Tone {
  freq: number;
  /** Seconds from the start of the sound. */
  at: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Slide to this frequency over the tone's life. */
  glideTo?: number;
}

/**
 * The palette.
 *
 * Intervals rather than arbitrary pitches: rising fifths read as "connected",
 * falling minor thirds as "stopped". Short attacks and fast decays keep them
 * out of the way of someone typing.
 */
const SOUNDS: Record<SoundName, Tone[]> = {
  // A soft wooden knock — the composer's "sent".
  send: [{ freq: 420, at: 0, duration: 0.07, type: "triangle", gain: 0.7 }],

  // Two rising notes: something finished and it worked.
  complete: [
    { freq: 523.25, at: 0, duration: 0.1, type: "sine" },
    { freq: 783.99, at: 0.085, duration: 0.18, type: "sine", gain: 0.85 },
  ],

  // A single clean tick for a validator passing.
  validated: [{ freq: 987.77, at: 0, duration: 0.08, type: "sine", gain: 0.5 }],

  // Falling minor third, low and short. Not a klaxon.
  error: [
    { freq: 311.13, at: 0, duration: 0.12, type: "triangle", gain: 0.8 },
    { freq: 233.08, at: 0.1, duration: 0.2, type: "triangle", gain: 0.7 },
  ],

  // Studio coming online: a rising glide, like a link being made.
  connect: [
    { freq: 392, at: 0, duration: 0.09, type: "sine" },
    { freq: 587.33, at: 0.07, duration: 0.14, type: "sine", glideTo: 659.25 },
  ],

  // The same shape, reversed.
  disconnect: [
    { freq: 587.33, at: 0, duration: 0.09, type: "sine", gain: 0.6 },
    { freq: 392, at: 0.07, duration: 0.16, type: "sine", gain: 0.5 },
  ],

  // Approving a change set is the weightiest action in the product, so it gets
  // the fullest sound: a low root under a bright confirmation.
  approve: [
    { freq: 261.63, at: 0, duration: 0.22, type: "sine", gain: 0.55 },
    { freq: 659.25, at: 0.05, duration: 0.1, type: "sine", gain: 0.7 },
    { freq: 880, at: 0.13, duration: 0.2, type: "sine", gain: 0.55 },
  ],

  toggle: [{ freq: 660, at: 0, duration: 0.045, type: "square", gain: 0.28 }],
};

/**
 * Play a sound, if sound is on and audio is available.
 *
 * Never throws: a browser refusing to make noise must not break the interaction
 * that triggered it.
 */
export function playSound(name: SoundName): void {
  if (!soundEnabled()) return;

  try {
    const ctx = audio();
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);

    for (const tone of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(tone.freq, now + tone.at);
      if (tone.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(tone.glideTo, now + tone.at + tone.duration);
      }

      // A short attack and exponential decay; a hard stop clicks audibly.
      const peak = (tone.gain ?? 1) * 0.9;
      gain.gain.setValueAtTime(0.0001, now + tone.at);
      gain.gain.exponentialRampToValueAtTime(peak, now + tone.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.duration);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now + tone.at);
      osc.stop(now + tone.at + tone.duration + 0.02);
    }
  } catch {
    /* audio is a nicety; never let it surface as an error */
  }
}

/** Names, for a settings UI that wants to preview them. */
export const SOUND_NAMES = Object.keys(SOUNDS) as SoundName[];
