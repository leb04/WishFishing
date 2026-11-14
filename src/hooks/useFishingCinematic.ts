import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FishingLifecycle, isFishing, type FishingPhase } from '../lib/cinematic';
import { driveFishingPhase, watchFishingRun } from '../lib/fishingAnimation';
import { FishingSound, type FishingCue } from '../lib/fishingSound';
import { useMediaQuery } from './useSceneActivity';

const SOUND_KEY = 'wishfishing:sound';

function castMusic(phase: FishingPhase) {
  switch (phase) {
    case 'CASTING':
    case 'WAITING_FOR_BITE':
    case 'UNDERWATER':
      return 'suspense';
    default:
      return 'reel';
  }
}

export function useFishingCinematic(developerMode = false) {
  const [lifecycle] = useState(() => new FishingLifecycle());
  const [sound] = useState(() => new FishingSound());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (developerMode) return true;
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
  });
  const soundEnabledRef = useRef(soundEnabled);
  const playSound = useCallback((cue: FishingCue) => {
    if (soundEnabledRef.current && isFishing(lifecycle.phase) && !document.hidden) sound.play(cue);
  }, [lifecycle, sound]);
  const phase = useSyncExternalStore(lifecycle.subscribe, lifecycle.snapshot);
  const busy = isFishing(phase);
  const run = lifecycle.run;
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const unlockSound = useCallback(() => {
    if (!soundEnabledRef.current || document.hidden) return;
    sound.unlock();
    const current = lifecycle.phase;
    if (current === 'REVEALING' || (current === 'RESULT' && lifecycle.pose.reveal === 1)) sound.setMusic('victory');
    else sound.setMusic(isFishing(current) ? castMusic(current) : 'idle');
  }, [lifecycle, sound]);
  useEffect(() => {
    return driveFishingPhase(lifecycle, phase, reduced, playSound);
  }, [lifecycle, phase, playSound, reduced]);
  useEffect(() => {
    if (soundEnabled) void sound.preloadEffects();
  }, [sound, soundEnabled]);
  useEffect(() => {
    const unsubscribe = lifecycle.subscribe(() => {
      if (!soundEnabledRef.current || document.hidden) return;
      if (lifecycle.phase === 'CASTING') sound.setMusic('suspense');
      if (lifecycle.phase === 'BITING' || lifecycle.phase === 'DECOY_BITE') sound.setMusic('reel');
      if (!isFishing(lifecycle.phase)) {
        sound.stopEffects();
        if (lifecycle.phase === 'IDLE' || lifecycle.pose.reveal !== 1) sound.setMusic('idle');
      }
    });
    return () => { unsubscribe(); sound.close(); };
  }, [lifecycle, sound]);
  useEffect(() => {
    if (busy) return watchFishingRun(lifecycle, run);
  }, [busy, lifecycle, run]);
  useEffect(() => {
    // A hidden page cannot show the animation: preserve the committed result instead.
    const hidden = () => {
      if (document.hidden) {
        sound.stop(true);
        lifecycle.skip();
      } else if (soundEnabledRef.current) {
        sound.setMusic('idle');
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.repeat && isFishing(lifecycle.phase)) {
        event.preventDefault(); lifecycle.skip();
      }
    };
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('keydown', escape);
    // Browsers require a gesture before starting the pond music.
    window.addEventListener('click', unlockSound, { once: true });
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('click', unlockSound);
    };
  }, [lifecycle, sound, unlockSound]);
  return {
    lifecycle, phase, busy, soundEnabled,
    unlockSound,
    toggleSound: () => {
      const enabled = !soundEnabledRef.current;
      soundEnabledRef.current = enabled;
      setSoundEnabled(enabled);
      if (enabled) unlockSound();
      else sound.stop();
      if (!developerMode) {
        try { localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* Session preference still applies. */ }
      }
    },
  };
}
