import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CloseIcon,
  MoonIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
} from '../components/Icons';
import { useT } from '../i18n/strings';
import { ambient, loadPrefs, savePrefs, SOUND_IDS } from './ambient';
import type { SoundId } from './ambient';
import './sound.css';

const BOTTOM_GAP = 48;
const TOP_GAP = 16;

const ICONS: Record<SoundId, ReactNode> = {
  calm: <MusicIcon size={18} />,
  focus: <TargetIcon size={18} />,
  night: <MoonIcon size={18} />,
};

/**
 * A small button that opens the music panel: three calm piano moods (real
 * Chopin recordings, public domain), play
 * and pause, and a volume slider. The choice is remembered on this device;
 * the sound itself never starts by itself.
 */
export function SoundButton({ placement }: { placement: 'side' | 'down' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [playing, setPlaying] = useState(ambient.current !== null);
  const [track, setTrack] = useState(ambient.track);

  useEffect(() => {
    ambient.onTrack = setTrack;
    return () => {
      ambient.onTrack = null;
    };
  }, []);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // How far the side panel moves up so it keeps a calm gap above the bottom edge.
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);

  useEffect(() => savePrefs(prefs), [prefs]);

  // The side panel opens next to the button; on a shorter screen it would
  // touch the bottom edge, so it moves up just enough to keep a 48px gap.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || placement !== 'side' || !panel) {
      liftRef.current = 0;
      setLift(0);
      return;
    }
    const fit = () => {
      // Measure where the panel would sit without any lift.
      const rect = panel.getBoundingClientRect();
      const current = liftRef.current;
      const bottom = rect.bottom + current;
      const top = rect.top + current;
      const overflow = bottom - (window.innerHeight - BOTTOM_GAP);
      const room = Math.max(0, top - TOP_GAP);
      const next = Math.max(0, Math.min(overflow, room));
      liftRef.current = next;
      setLift(next);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, placement, playing, track]);

  // Close the panel on Escape or a click outside it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  function choose(id: SoundId) {
    setPrefs((current) => ({ ...current, id }));
    if (playing) {
      void ambient.play(id);
    }
  }

  function toggle() {
    if (playing) {
      ambient.stop();
      setPlaying(false);
    } else {
      ambient.setVolume(prefs.volume);
      void ambient.play(prefs.id);
      setPlaying(true);
    }
  }

  function changeVolume(volume: number) {
    setPrefs((current) => ({ ...current, volume }));
    ambient.setVolume(volume);
  }

  const name = t.sound.options[prefs.id].name;

  return (
    <div className="sound" ref={wrapRef} data-tour="sound">
      <button
        type="button"
        className={playing ? 'sound-button playing' : 'sound-button'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={playing ? t.sound.playing(name) : t.sound.button}
        title={playing ? t.sound.playing(name) : t.sound.button}
        onClick={() => setOpen((value) => !value)}
      >
        {playing ? (
          <span className="sound-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <MusicIcon size={18} />
        )}
        <span className="sound-button-text">{t.sound.button}</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          style={lift ? { transform: `translateY(-${lift}px)` } : undefined}
          className={`sound-panel sound-panel-${placement}`}
          role="dialog"
          aria-label={t.sound.title}
        >
          <div className="sound-panel-head">
            <strong>{t.sound.title}</strong>
            <button
              type="button"
              className="sound-close"
              aria-label={t.sound.close}
              onClick={() => setOpen(false)}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <div className="sound-options" role="radiogroup" aria-label={t.sound.title}>
            {SOUND_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={prefs.id === id}
                className={prefs.id === id ? 'sound-option on' : 'sound-option'}
                onClick={() => choose(id)}
              >
                <span className="sound-option-icon" aria-hidden="true">
                  {ICONS[id]}
                </span>
                <span className="sound-option-text">
                  <strong>{t.sound.options[id].name}</strong>
                  <span>{t.sound.options[id].text}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="sound-controls">
            <button type="button" className="sound-play" onClick={toggle}>
              {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
              {playing ? t.sound.pause : t.sound.play}
            </button>
            <label className="sound-volume">
              <span className="visually-hidden">{t.sound.volume}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                aria-label={t.sound.volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
              />
            </label>
          </div>
          {playing && track && (
            <p className="sound-now" aria-live="polite">
              <span>{t.sound.nowPlaying}</span>
              <strong>Chopin · {track.title}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
