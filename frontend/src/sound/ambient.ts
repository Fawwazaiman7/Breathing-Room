/**
 * Calm background piano: real recordings of Frédéric Chopin's piano music,
 * performed by human pianists for the Musopen project and released into the
 * public domain (CC0 1.0). Source: https://archive.org/details/musopen-chopin
 *
 * Nothing here is generated: the app only plays these recordings.
 *
 * - calm: nocturnes with a slow, singing melody.
 * - focus: lento preludes with a steady pulse and no words.
 * - night: soft nocturnes for winding down.
 *
 * Each mood is a short playlist that continues from track to track and
 * loops. Sound starts only after the student presses play (browsers also
 * require this) and fades in and out gently.
 *
 * Files are played from /audio/ when they are hosted with the app (see
 * public/audio/README.md); otherwise they stream from the Internet Archive.
 */
export type SoundId = 'calm' | 'focus' | 'night';

export const SOUND_IDS: SoundId[] = ['calm', 'focus', 'night'];

export interface Track {
  /** File name in public/audio/. */
  file: string;
  /** The same recording on the Internet Archive. */
  remote: string;
  title: string;
}

const ARCHIVE = 'https://archive.org/download/musopen-chopin/';

export const PLAYLISTS: Record<SoundId, Track[]> = {
  calm: [
    {
      file: 'chopin-nocturne-op9-no2.mp3',
      remote: ARCHIVE + 'Nocturne%20Op.%209%20no.%202%20in%20E%20flat%20major.mp3',
      title: 'Nocturne in E-flat major, Op. 9 No. 2',
    },
    {
      file: 'chopin-nocturne-op32-no1.mp3',
      remote: ARCHIVE + 'Nocturne%20Op.%2032%20no.%201%20in%20B%20major.mp3',
      title: 'Nocturne in B major, Op. 32 No. 1',
    },
  ],
  focus: [
    {
      file: 'chopin-prelude-op28-no15.mp3',
      remote: ARCHIVE + 'Prelude%20Op.%2028%20no.%2015.mp3',
      title: 'Prelude in D-flat major, Op. 28 No. 15',
    },
    {
      file: 'chopin-prelude-op28-no13.mp3',
      remote: ARCHIVE + 'Prelude%20Op.%2028%20no.%2013.mp3',
      title: 'Prelude in F-sharp major, Op. 28 No. 13',
    },
    {
      file: 'chopin-prelude-op28-no17.mp3',
      remote: ARCHIVE + 'Prelude%20Op.%2028%20no.%2017.mp3',
      title: 'Prelude in A-flat major, Op. 28 No. 17',
    },
  ],
  night: [
    {
      file: 'chopin-nocturne-op27-no2.mp3',
      remote: ARCHIVE + 'NocturneOp27No2.mp3',
      title: 'Nocturne in D-flat major, Op. 27 No. 2',
    },
    {
      file: 'chopin-nocturne-op62-no2.mp3',
      remote: ARCHIVE + 'Nocturne%20Op.%2062%20no.%202%20in%20E%20major.mp3',
      title: 'Nocturne in E major, Op. 62 No. 2',
    },
  ],
};

const FADE_IN_MS = 2000;
const FADE_OUT_MS = 1200;

class PianoPlayer {
  private audio: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private volume = 0.5;
  private level = 0;
  private fadeFrame: number | null = null;
  current: SoundId | null = null;
  /** Called when the track changes, so the panel can show its title. */
  onTrack: ((track: Track | null) => void) | null = null;

  get track(): Track | null {
    return this.current ? PLAYLISTS[this.current][this.trackIndex] : null;
  }

  async play(id: SoundId) {
    if (this.current === id && this.audio && !this.audio.paused) {
      return;
    }
    this.release(FADE_OUT_MS);
    this.current = id;
    this.trackIndex = 0;
    await this.start();
  }

  stop() {
    this.release(FADE_OUT_MS);
    this.current = null;
    this.onTrack?.(null);
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.audio && this.fadeFrame === null) {
      this.audio.volume = this.level * volume;
    }
  }

  private async start() {
    const track = this.track;
    if (!track) {
      return;
    }
    const audio = new Audio();
    audio.preload = 'auto';
    this.audio = audio;
    let local = true;
    audio.src = '/audio/' + track.file;
    audio.volume = 0;
    this.level = 0;

    // Not hosted with the app (or not playable): stream the same recording.
    audio.addEventListener('error', () => {
      if (this.audio === audio && local) {
        local = false;
        audio.src = track.remote;
        void audio.play().catch(() => undefined);
      }
    });
    audio.addEventListener('ended', () => {
      if (this.audio !== audio || !this.current) {
        return;
      }
      const list = PLAYLISTS[this.current];
      this.trackIndex = (this.trackIndex + 1) % list.length;
      this.audio = null;
      void this.start();
    });

    this.onTrack?.(track);
    try {
      await audio.play();
    } catch {
      // The local file failed before playing; the error handler streams it.
    }
    this.fadeTo(audio, 1, FADE_IN_MS);
  }

  /** Fades the current recording out, then lets it go. */
  private release(ms: number) {
    const audio = this.audio;
    this.audio = null;
    if (this.fadeFrame !== null) {
      cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = null;
    }
    if (!audio) {
      return;
    }
    const from = audio.volume;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / ms);
      audio.volume = from * (1 - p);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
    requestAnimationFrame(step);
  }

  private fadeTo(audio: HTMLAudioElement, target: number, ms: number) {
    const from = this.level;
    const started = performance.now();
    const step = (now: number) => {
      if (this.audio !== audio) {
        return;
      }
      const p = Math.min(1, (now - started) / ms);
      this.level = from + (target - from) * p;
      audio.volume = this.level * this.volume;
      this.fadeFrame = p < 1 ? requestAnimationFrame(step) : null;
    };
    this.fadeFrame = requestAnimationFrame(step);
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
