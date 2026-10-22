/**
 * Calming background sound, made in the browser with the Web Audio API.
 *
 * There are no audio files: each sound is shaped from random noise, so
 * nothing is downloaded and there is no licence to worry about. Natural,
 * steady sounds without melody or words were chosen on purpose: they mask
 * distracting noise without pulling attention away from reading.
 *
 * - rain: soft, even rainfall with a low body.
 * - stream: flowing water that rises and falls slowly.
 * - focus: brown noise, a deep and even hush.
 *
 * Sound starts only after the student presses play (browsers also require
 * this) and fades in and out gently.
 */
export type SoundId = 'rain' | 'stream' | 'focus';

export const SOUND_IDS: SoundId[] = ['rain', 'stream', 'focus'];

type Color = 'white' | 'pink' | 'brown';

const BUFFER_SECONDS = 8;
const FADE_IN = 1.5;
const FADE_OUT = 0.8;

function noiseBuffer(context: AudioContext, color: Color): AudioBuffer {
  const length = context.sampleRate * BUFFER_SECONDS;
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (color === 'white') {
        data[i] = white * 0.5;
      } else if (color === 'pink') {
        // Paul Kellet's refined pink noise filter.
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    // Blend the end into the start so the loop has no click.
    const blend = Math.floor(context.sampleRate * 0.05);
    for (let i = 0; i < blend; i += 1) {
      const k = i / blend;
      data[length - blend + i] = data[length - blend + i] * (1 - k) + data[i] * k;
    }
  }
  return buffer;
}

class AmbientPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Color, AudioBuffer>();
  private running: AudioScheduledSourceNode[] = [];
  private volume = 0.5;
  current: SoundId | null = null;

  private ensure(): { context: AudioContext; master: GainNode } {
    if (!this.context || !this.master) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
    }
    return { context: this.context, master: this.master };
  }

  private buffer(color: Color): AudioBuffer {
    const { context } = this.ensure();
    let buffer = this.buffers.get(color);
    if (!buffer) {
      buffer = noiseBuffer(context, color);
      this.buffers.set(color, buffer);
    }
    return buffer;
  }

  /** A looping noise source. */
  private source(color: Color): AudioBufferSourceNode {
    const { context } = this.ensure();
    const node = context.createBufferSource();
    node.buffer = this.buffer(color);
    node.loop = true;
    // Each layer starts at a different point, so layers do not line up.
    node.start(0, Math.random() * BUFFER_SECONDS);
    this.running.push(node);
    return node;
  }

  /** A slow wobble added to an audio parameter. */
  private lfo(target: AudioParam, rate: number, depth: number) {
    const { context } = this.ensure();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = rate;
    gain.gain.value = depth;
    oscillator.connect(gain).connect(target);
    oscillator.start();
    this.running.push(oscillator);
  }

  private build(id: SoundId, output: GainNode) {
    const { context } = this.ensure();
    const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
      const node = context.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = q;
      return node;
    };
    const level = (value: number) => {
      const node = context.createGain();
      node.gain.value = value;
      return node;
    };

    if (id === 'rain') {
      // The patter: pink noise without its lowest and highest parts.
      const patter = level(0.55);
      this.source('pink')
        .connect(filter('highpass', 450))
        .connect(filter('lowpass', 7000))
        .connect(patter)
        .connect(output);
      this.lfo(patter.gain, 0.06, 0.08);
      // The body: a soft low rumble under it.
      this.source('brown')
        .connect(filter('lowpass', 300))
        .connect(level(0.35))
        .connect(output);
    } else if (id === 'stream') {
      // Water: a band of noise whose centre drifts slowly up and down.
      const band = filter('bandpass', 900, 0.6);
      this.source('pink').connect(band).connect(level(1.1)).connect(output);
      this.lfo(band.frequency, 0.13, 350);
      // Small ripples higher up.
      const ripples = level(0.12);
      this.source('white')
        .connect(filter('bandpass', 2600, 2.5))
        .connect(ripples)
        .connect(output);
      this.lfo(ripples.gain, 0.37, 0.08);
    } else {
      this.source('brown')
        .connect(filter('lowpass', 650))
        .connect(level(0.9))
        .connect(output);
    }
  }

  async play(id: SoundId) {
    const { context, master } = this.ensure();
    if (context.state === 'suspended') {
      await context.resume();
    }
    this.stopNodes();
    this.build(id, master);
    this.current = id;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(this.volume * 0.6, now + FADE_IN);
  }

  stop() {
    if (!this.context || !this.master) {
      return;
    }
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    const nodes = this.running;
    this.running = [];
    window.setTimeout(() => nodes.forEach((node) => safeStop(node)), FADE_OUT * 1000 + 50);
    this.current = null;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.context && this.master && this.current) {
      this.master.gain.setTargetAtTime(volume * 0.6, this.context.currentTime, 0.1);
    }
  }

  private stopNodes() {
    this.running.forEach((node) => safeStop(node));
    this.running = [];
  }
}

function safeStop(node: AudioScheduledSourceNode) {
  try {
    node.stop();
    node.disconnect();
  } catch {
    // Already stopped.
  }
}

/** One player for the whole app, so the sound continues between pages. */
export const ambient = new AmbientPlayer();

const PREFS_KEY = 'ruang-pulih:sound';

export interface SoundPrefs {
  id: SoundId;
  volume: number;
}

export function loadPrefs(): SoundPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? 'null') as
      | Partial<SoundPrefs>
      | null;
    const id = SOUND_IDS.includes(raw?.id as SoundId) ? (raw!.id as SoundId) : 'rain';
    const volume =
      typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1
        ? raw.volume
        : 0.5;
    return { id, volume };
  } catch {
    return { id: 'rain', volume: 0.5 };
  }
}

export function savePrefs(prefs: SoundPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // The choice still applies for this visit.
  }
}
