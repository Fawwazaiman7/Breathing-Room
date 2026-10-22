/**
 * Calm background piano, played live in the browser with the Web Audio API.
 *
 * There are no audio files: every note is synthesised (a few sine partials
 * with a soft hammer and a long decay, as a felt piano sounds) and placed
 * in a slow chord progression, with a gentle room reverb. The music is
 * original, so there is no licence to worry about, and it never repeats
 * exactly, because the right hand picks its notes with a little chance.
 *
 * Music for focus works best when it is slow, quiet, without words and
 * without surprises, so all three moods stay in major or soft minor keys,
 * between 50 and 64 beats per minute, at low volume.
 *
 * - calm: warm arpeggios over slow chords.
 * - focus: a soft chord, then a few sparse notes, with room between them.
 * - night: low, long chords for winding down.
 *
 * Sound starts only after the student presses play (browsers also require
 * this) and fades in and out gently.
 */
export type SoundId = 'calm' | 'focus' | 'night';

export const SOUND_IDS: SoundId[] = ['calm', 'focus', 'night'];

const FADE_IN = 2;
const FADE_OUT = 1.2;
/** Notes are scheduled this far ahead, so a busy or hidden tab keeps time. */
const LOOKAHEAD = 1.5;
const TICK_MS = 250;

/** MIDI note number to frequency. */
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Chord {
  /** Bass note (MIDI). */
  bass: number;
  /** Chord tones for the right hand (MIDI). */
  tones: number[];
}

interface Mood {
  bpm: number;
  chords: Chord[];
  /** Beats per chord. */
  beats: number;
  /** Plays one bar (one chord) starting at time t. */
  bar: (play: Play, chord: Chord, t: number, beat: number) => void;
}

type Play = (midi: number, time: number, velocity: number, length?: number) => void;

const chance = (p: number) => Math.random() < p;
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const MOODS: Record<SoundId, Mood> = {
  // C major: Cmaj7 - Am7 - Fmaj7 - G6, arpeggios in eighth notes.
  calm: {
    bpm: 64,
    beats: 4,
    chords: [
      { bass: 36, tones: [60, 64, 67, 71, 72] },
      { bass: 45, tones: [57, 60, 64, 67, 69] },
      { bass: 41, tones: [57, 60, 64, 65, 69] },
      { bass: 43, tones: [59, 62, 64, 67, 71] },
    ],
    bar(play, chord, t, beat) {
      play(chord.bass, t, 0.55, 6);
      play(chord.bass + 12, t + beat * 0.02, 0.3, 5);
      const order = [0, 1, 2, 3, 4, 3, 2, 1];
      order.forEach((index, step) => {
        if (step > 0 && chance(0.18)) {
          return; // a small rest keeps it from sounding mechanical
        }
        const note = chord.tones[index % chord.tones.length];
        play(note, t + step * (beat / 2), 0.22 + Math.random() * 0.12, 3);
      });
      if (chance(0.5)) {
        play(pick(chord.tones) + 12, t + beat * 2.5, 0.16, 4);
      }
    },
  },
  // A minor (soft): Am9 - Fmaj7 - Cmaj7 - Gsus2, sparse and steady.
  focus: {
    bpm: 56,
    beats: 4,
    chords: [
      { bass: 45, tones: [60, 64, 67, 71] },
      { bass: 41, tones: [60, 64, 65, 69] },
      { bass: 36, tones: [59, 64, 67, 72] },
      { bass: 43, tones: [57, 62, 67, 69] },
    ],
    bar(play, chord, t, beat) {
      play(chord.bass, t, 0.45, 7);
      chord.tones.slice(0, 3).forEach((note, i) => play(note, t + i * 0.03, 0.18, 6));
      const pentatonic = [72, 74, 76, 79, 81];
      const count = chance(0.5) ? 2 : 3;
      for (let i = 0; i < count; i += 1) {
        const at = t + beat * (1 + i * 1.1 + Math.random() * 0.3);
        play(pick(pentatonic), at, 0.14 + Math.random() * 0.06, 4);
      }
    },
  },
  // D minor: Dm9 - Bbmaj7 - Fmaj7 - C6, low and long.
  night: {
    bpm: 50,
    beats: 4,
    chords: [
      { bass: 38, tones: [53, 57, 60, 64] },
      { bass: 34, tones: [50, 53, 57, 62] },
      { bass: 41, tones: [52, 57, 60, 64] },
      { bass: 36, tones: [52, 55, 57, 60] },
    ],
    bar(play, chord, t, beat) {
      play(chord.bass, t, 0.5, 8);
      chord.tones.forEach((note, i) => play(note, t + i * 0.06, 0.17, 7));
      if (chance(0.6)) {
        play(pick(chord.tones) + 12, t + beat * 2, 0.12, 6);
      }
    },
  },
};

class PianoPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbIn: GainNode | null = null;
  private session: GainNode | null = null;
  private timer: number | null = null;
  private nextBar = 0;
  private chordIndex = 0;
  private volume = 0.5;
  current: SoundId | null = null;

  private ensure() {
    if (!this.context || !this.master || !this.reverbIn) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.buildGraph(new Ctor());
    }
    return { context: this.context!, master: this.master!, reverbIn: this.reverbIn! };
  }

  /** Master volume, a soft top end, and a room reverb. */
  private buildGraph(context: AudioContext) {
    const master = context.createGain();
    master.gain.value = this.volume;
    // A soft top end, like a felt piano in a small warm room.
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    master.connect(tone).connect(context.destination);

    // Room reverb from a decaying noise impulse.
    const reverb = context.createConvolver();
    reverb.buffer = this.impulse(context, 3.2);
    const wet = context.createGain();
    wet.gain.value = 0.42;
    const reverbIn = context.createGain();
    reverbIn.connect(reverb).connect(wet).connect(master);

    this.context = context;
    this.master = master;
    this.reverbIn = reverbIn;
    return { context, master: this.master!, reverbIn: this.reverbIn! };
  }

  private impulse(context: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
      }
    }
    return buffer;
  }

  /** One piano note: a few partials, a soft hammer, a long decay. */
  private note(output: GainNode, reverbIn: GainNode, midi: number, time: number, velocity: number, length = 4) {
    const context = this.context!;
    const frequency = hz(midi);
    // Higher notes fade sooner, as on a real piano.
    const decay = Math.max(1.2, length * (1 - (midi - 36) / 90));
    const voice = context.createGain();
    voice.gain.setValueAtTime(0, time);
    voice.gain.linearRampToValueAtTime(velocity, time + 0.008);
    voice.gain.exponentialRampToValueAtTime(velocity * 0.35, time + 0.25);
    voice.gain.exponentialRampToValueAtTime(0.0008, time + decay);

    // The hammer: bright at first, mellow soon after.
    const brightness = context.createBiquadFilter();
    brightness.type = 'lowpass';
    brightness.frequency.setValueAtTime(Math.min(9000, frequency * 9), time);
    brightness.frequency.exponentialRampToValueAtTime(Math.max(700, frequency * 2.5), time + 0.6);

    voice.connect(brightness);
    brightness.connect(output);
    const send = context.createGain();
    send.gain.value = 0.6;
    brightness.connect(send).connect(reverbIn);

    const partials: Array<[number, number]> = [
      [1, 1],
      [2, 0.42],
      [3, 0.16],
      [4, 0.07],
    ];
    for (const [multiple, amplitude] of partials) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      // A touch of stretch in the upper partials, as piano strings have.
      oscillator.frequency.value = frequency * multiple * (1 + 0.0004 * multiple * multiple);
      oscillator.detune.value = (Math.random() - 0.5) * 4;
      const level = context.createGain();
      level.gain.value = amplitude * 0.6;
      oscillator.connect(level).connect(voice);
      oscillator.start(time);
      oscillator.stop(time + decay + 0.1);
    }
  }

  private schedule() {
    const context = this.context;
    const session = this.session;
    const reverbIn = this.reverbIn;
    if (!context || !session || !reverbIn || !this.current) {
      return;
    }
    const mood = MOODS[this.current];
    const beat = 60 / mood.bpm;
    const play: Play = (midi, time, velocity, length) =>
      this.note(session, reverbIn, midi, time, velocity, length);
    while (this.nextBar < context.currentTime + LOOKAHEAD) {
      const chord = mood.chords[this.chordIndex % mood.chords.length];
      mood.bar(play, chord, this.nextBar, beat);
      this.nextBar += beat * mood.beats;
      this.chordIndex += 1;
    }
  }

  async play(id: SoundId) {
    const { context, master } = this.ensure();
    if (context.state === 'suspended') {
      await context.resume();
    }
    this.fadeOutSession();
    const session = context.createGain();
    session.connect(master);
    const now = context.currentTime;
    session.gain.setValueAtTime(0, now);
    session.gain.linearRampToValueAtTime(1, now + FADE_IN);
    this.session = session;
    this.current = id;
    this.chordIndex = 0;
    this.nextBar = now + 0.1;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop() {
    this.fadeOutSession();
    this.current = null;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
    }
  }

  /** The same graph and notes on an offline context, for a preview. */
  async renderOffline(offline: OfflineAudioContext, id: SoundId, seconds: number) {
    this.context = offline as unknown as AudioContext;
    this.master = null;
    this.reverbIn = null;
    const { context, master } = this.buildGraph(this.context);
    const session = context.createGain();
    session.connect(master);
    this.session = session;
    this.current = id;
    this.chordIndex = 0;
    this.nextBar = 0.1;
    const mood = MOODS[id];
    const beat = 60 / mood.bpm;
    const play: Play = (midi, time, velocity, length) =>
      this.note(session, this.reverbIn!, midi, time, velocity, length);
    while (this.nextBar < seconds) {
      mood.bar(play, mood.chords[this.chordIndex % mood.chords.length], this.nextBar, beat);
      this.nextBar += beat * mood.beats;
      this.chordIndex += 1;
    }
    return offline.startRendering();
  }

  /** Lets the notes already sounding fade out, then lets them go. */
  private fadeOutSession() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const session = this.session;
    const context = this.context;
    this.session = null;
    if (!session || !context) {
      return;
    }
    const now = context.currentTime;
    session.gain.cancelScheduledValues(now);
    session.gain.setValueAtTime(session.gain.value, now);
    session.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    window.setTimeout(() => {
      try {
        session.disconnect();
      } catch {
        // Already disconnected.
      }
    }, (FADE_OUT + LOOKAHEAD + 8) * 1000);
  }
}

/** One player for the whole app, so the music continues between pages. */
export const ambient = new PianoPlayer();

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
    // Earlier choices (rain, stream...) fall back to the calm piano.
    const id = SOUND_IDS.includes(raw?.id as SoundId) ? (raw!.id as SoundId) : 'calm';
    const volume =
      typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1
        ? raw.volume
        : 0.5;
    return { id, volume };
  } catch {
    return { id: 'calm', volume: 0.5 };
  }
}

export function savePrefs(prefs: SoundPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // The choice still applies for this visit.
  }
}

/**
 * Renders a few seconds of one mood without playing it, using the same
 * notes and room. Used to check the music (and to make a preview file).
 */
export async function renderPreview(id: SoundId, seconds: number): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, sampleRate * seconds, sampleRate);
  const player = new PianoPlayer();
  return player.renderOffline(offline, id, seconds);
}
