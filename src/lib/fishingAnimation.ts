import { gsap } from 'gsap';
import { isFishing, type EscapePoint, type FishingLifecycle, type FishingPhase, type FishingPose } from './cinematic';
import type { FishingCue } from './fishingSound';

export const FISHING_WATCHDOG_MS = 58_000;

/** Recover the committed result if the rendering or animation clock stalls. */
export function watchFishingRun(lifecycle: FishingLifecycle, run: number) {
  const timeout = setTimeout(() => {
    if (lifecycle.run === run) lifecycle.skip();
  }, FISHING_WATCHDOG_MS);
  return () => clearTimeout(timeout);
}

/** One owned timeline per phase. Completion, rather than a parallel timer, advances it. */
const SOUND_CUES: Partial<Record<FishingPhase, readonly (readonly [number, FishingCue])[]>> = {
  CASTING: [[0.39, 'cast'], [1.10, 'plop']],
  UNDERWATER: [[0.47, 'dive']],
  DECOY_BITE: [[0.045, 'bite']],
  DECOY_ESCAPE: [[0.07, 'escape']],
  BITING: [[0.045, 'bite']],
  REVEALING: [[0.31, 'reveal']],
};
const REEL_CUES = [
  [0.06, 'reel'], [0.38, 'strain'],
  [1.89, 'reel'], [3.17, 'water-tug'], [3.69, 'riser'],
] as const satisfies readonly (readonly [number, FishingCue])[];

function animateUnderwaterPull(tl: gsap.core.Timeline, pose: FishingPose, escapePoint?: EscapePoint) {
  tl.set(pose, { catchShot: 'fight' })
    .to(pose, { bobberY: 0.04, bobberZ: -7.65, leaderY: -3.16, fishPitch: 0.48, fishStruggle: 0.6,
      rodX: 0.045, bend: 0.12, tension: 0.46, shake: 0.16, duration: 0.37, ease: 'power2.out' })
    .to(pose, { bobberY: -0.22, bobberZ: -7.89, leaderY: -3.88, fishPitch: -0.66, fishStruggle: 1.3,
      rodX: -0.13, bend: 0.25, tension: 0.94, shake: 0.39, duration: 0.32, ease: 'power2.inOut' })
    .to(pose, { bobberY: -0.03, bobberZ: -7.35, leaderY: -3.16, fishPitch: 0.42, fishStruggle: 0.85,
      rodX: -0.015, bend: 0.18, tension: 0.72, shake: 0.15, duration: 0.29 });
  if (escapePoint === 'early') return;
  tl.to(pose, { bobberY: 0.12, bobberZ: -6.8, leaderY: -1.45, fishPitch: 0.6, fishStruggle: 0.68,
      rodX: 0.04, bend: 0.17, tension: 0.51, shake: 0.25, duration: 0.87, ease: 'power2.inOut' });
}

function animateRodPull(tl: gsap.core.Timeline, pose: FishingPose) {
  tl.set(pose, { catchShot: 'rod' })
    .to(pose, { bobberZ: -4.65, bobberX: -0.08, rodX: -0.035, rodZ: -0.05, bend: 0.22, tension: 0.78,
      duration: 0.38, ease: 'power1.in' })
    .to(pose, { bobberZ: -2.35, bobberY: 0.21, rodX: 0.135, rodZ: 0.015, bend: 0.13,
      leaderY: -0.62, tension: 0.72, duration: 0.56, ease: 'power2.out' });
}

function animateSurfacePull(tl: gsap.core.Timeline, pose: FishingPose, escapePoint?: EscapePoint) {
  tl.set(pose, { catchShot: 'surface' })
    .to(pose, { bobberZ: -1.9, bobberY: 0.29, bobberX: 0, fishPitch: 0.9, leaderY: -0.53,
      rodX: 0.18, duration: 0.28, ease: 'power2.out' })
    .set(pose, { splash: 0.01, splashSize: 0.48 })
    .to(pose, { bobberY: -0.15, bobberZ: -2.16, leaderY: -0.84, rodX: 0.06, fishPitch: -0.53, bend: 0.25, splash: 0.62,
      tension: 1, fishStruggle: 1.15, shake: 0.4, disturbance: 1.45, duration: 0.41, ease: 'power2.inOut' })
    .to(pose, { bobberY: 0.18, bobberZ: -1.9, leaderY: -0.53, rodX: 0.19, fishPitch: 0.67, bend: 0.245,
      tension: 0.88, splash: 1, shake: 0.14, disturbance: 1.2, duration: 0.47 })
    .set(pose, { splash: 0 })
    .to(pose, { bobberY: 0.22, leaderY: -0.45, bend: 0.26, tension: 1, shake: 0.08, duration: 0.42 });
  if (escapePoint === 'surface') return;
  tl.to(pose, { bobberY: 0.33, rodX: 0.21, bend: 0.2, shake: 0.23, duration: 0.39, ease: 'power2.in' });
}

function animateBreach(tl: gsap.core.Timeline, pose: FishingPose, playSound?: (cue: FishingCue) => void) {
  const start = tl.duration();
  tl.set(pose, { catchShot: 'breach', splash: 0.01, splashSize: 1.65 })
    .to(pose, { splash: 0.24, bobberY: 1.28, rodX: 0.26, bend: 0.07, fishPitch: 0.62, fishStruggle: 0.68,
      tension: 0.34, shake: 0.95, duration: 0.21, ease: 'power2.out' })
    .to(pose, { splash: 0.53, bobberY: 2.04, bend: 0.035, fishPitch: 0.51, shake: 0.22, duration: 0.65, ease: 'power2.out' })
    .to(pose, { splash: 0.78, bobberY: 1.86, fishPitch: 0.38, fishStruggle: 0.36, tension: 0, shake: 0, duration: 0.46 })
    .set(pose, { catchShot: 'hero' })
    .to(pose, { splash: 1, bobberY: 1.4, rodX: 0.16, disturbance: 0, fishPitch: 0.28, fishStruggle: 0.12, duration: 0.48 })
    .set(pose, { splash: 0 })
    .to(pose, { fishStruggle: 0.04, duration: 0.8 });
  tl.fromTo(pose, { breachProgress: 0 },
    { breachProgress: 1, duration: tl.duration() - start, ease: 'none', immediateRender: false }, start);
  if (playSound) tl.call(playSound, ['splash'], start + 0.045);
}

/** A new fish takes the hook after it drops back into the same camera setup. */
function animateRepeatPull(tl: gsap.core.Timeline, pose: FishingPose, playSound?: (cue: FishingCue) => void) {
  const airborne = pose.catchShot === 'hero';
  const underwater = pose.catchShot === 'fight';
  const biteDepth = pose.leaderY;
  tl.to(pose, { bobberY: -0.1, leaderY: biteDepth - 0.35, bend: 0.25, fishPitch: -0.62,
    fishStruggle: 1.18, tension: 0.98, shake: 0.36, duration: 0.34 })
    .to(pose, { bobberY: airborne ? 1.4 : underwater ? 0.28 : 0.56, leaderY: underwater ? biteDepth + 0.5 : -0.45,
      rodX: 0.17, bend: 0.24, fishPitch: 0.58, fishStruggle: 0.72, tension: 0.91, shake: 0.17,
      duration: 0.68, ease: 'power2.inOut' })
    .to(pose, { bobberY: airborne ? 1.4 : underwater ? 0.32 : 0.53, fishPitch: airborne ? 0.28 : 0.44,
      bend: airborne ? 0.08 : 0.21, fishStruggle: 0.42,
      tension: airborne ? 0.48 : 0.83, shake: 0.05, duration: 0.42 });
  if (playSound) {
    tl.call(playSound, [underwater ? 'strain' : 'water-tug'], 0.1);
    tl.call(playSound, ['reel'], 0.4);
    tl.call(playSound, [airborne ? 'splash' : 'riser'], 0.8);
  }
  if (!underwater) {
    tl.set(pose, { splash: 0.03, splashSize: airborne ? 0.85 : 0.48 }, 0.78)
      .to(pose, { splash: 1, duration: 0.62 }, 0.78)
      .set(pose, { splash: 0 }, 1.4);
  }
}

export function playFishingPhase(phase: FishingPhase, pose: FishingPose, complete: () => void,
  playSound?: (cue: FishingCue) => void, pullDelay = 0.48, escapePoint: EscapePoint = 'early', keepCamera = false) {
  const tl = gsap.timeline({ onComplete: complete, defaults: { ease: 'sine.inOut' } });
  switch (phase) {
    case 'CASTING':
      tl.to(pose, { rodX: 0.27, rodZ: -0.08, bobberY: 1.1, bobberZ: -4.8, duration: 0.4 })
        .to(pose, { rodX: -0.12, rodZ: 0.025, duration: 0.3, ease: 'power2.in' })
        .to(pose, { bobberY: 2.4, bobberZ: -6.5, duration: 0.32, ease: 'sine.out' }, '<')
        .to(pose, { bobberY: 0.15, bobberZ: -8, duration: 0.42, ease: 'power2.in' })
        .set(pose, { splash: 0.01, splashSize: 0.45, disturbance: 0.6 })
        .to(pose, { splash: 1, rodX: 0, rodZ: 0, duration: 0.48 })
        .set(pose, { splash: 0 });
      break;
    case 'WAITING_FOR_BITE':
      tl.to(pose, { bobberY: 0.19, disturbance: 0.25, duration: 0.28 })
        .to(pose, { bobberY: 0.13, duration: 0.28 })
        .to(pose, { bobberY: 0.17, duration: 0.28 });
      break;
    case 'UNDERWATER':
      tl.to(pose, { leaderY: -3.9, duration: 1.43, ease: 'sine.inOut' })
        .to(pose, { leaderY: -3.95, bobberY: 0.1, duration: 0.94 })
        .to(pose, { leaderY: -4.04, bobberY: 0.14, duration: 0.73 })
        .to(pose, { leaderY: -3.96, bobberY: 0.17, tension: 0.33, duration: 1.08 });
      break;
    case 'DECOY_PULL':
    case 'REELING': {
      const stop = phase === 'DECOY_PULL' ? escapePoint : undefined;
      const reelShot = keepCamera ? pose.catchShot : 'fight';
      if (keepCamera) {
        animateRepeatPull(tl, pose, playSound);
        if (stop || reelShot === 'hero') break;
        if (reelShot === 'fight') {
          tl.to(pose, { bobberY: 0.12, bobberZ: -6.8, leaderY: -1.45, fishPitch: 0.6, tension: 0.68, duration: 0.62 });
        }
        if (reelShot === 'surface') {
          tl.to(pose, { bobberY: 0.33, tension: 1, duration: 0.45 });
          if (playSound) tl.call(playSound, ['riser'], 1.15);
          break;
        }
      } else {
        animateUnderwaterPull(tl, pose, stop);
      }
      if (stop !== 'early' && stop !== 'midway' && reelShot !== 'rod') {
        animateRodPull(tl, pose);
      }
      if (stop !== 'early' && stop !== 'midway' && stop !== 'rod') {
        const surfaceStart = tl.duration();
        animateSurfacePull(tl, pose, stop);
        if (keepCamera) {
          tl.to(pose, { reelTime: 4.76, duration: tl.duration() - surfaceStart, ease: 'none' }, surfaceStart);
          if (playSound) {
            tl.call(playSound, ['water-tug'], surfaceStart + 0.39);
            tl.call(playSound, ['riser'], surfaceStart + 0.77);
          }
        }
      }
      const duration = tl.duration();
      if (!keepCamera) {
        tl.fromTo(pose, { reelTime: 0 }, { reelTime: duration, duration, ease: 'none' }, 0);
      }
      if (playSound && !keepCamera) {
        for (const [time, cue] of REEL_CUES) {
          if (time < duration) tl.call(playSound, [cue], time);
        }
      }
      if (phase === 'DECOY_PULL' && escapePoint === 'breach') animateBreach(tl, pose, playSound);
      break;
    }
    case 'DECOY_ESCAPE': {
      if (escapePoint === 'rod' || escapePoint === 'surface') {
        tl.set(pose, { splash: 0.025, splashSize: 0.65 })
          .to(pose, { splash: 1, duration: 0.75 }, 0)
          .set(pose, { splash: 0 });
      }
      if (escapePoint === 'breach') {
        tl.set(pose, { splash: 0.015, splashSize: 0.9 }, 0.3)
          .to(pose, { splash: 1, duration: 0.68 }, 0.3)
          .set(pose, { splash: 0 }, 0.98);
      }
      const depth = keepCamera ? (pose.catchShot === 'fight' ? pose.leaderY - 0.18 : -0.72) : -3.96;
      tl.to(pose, { bobberY: Math.max(0.33, pose.bobberY), rodX: 0.035, bend: 0, taut: 0, fishStruggle: 0,
        disturbance: 0.75, shake: 0.55, duration: 0.12, ease: 'power2.out' }, 0)
        .to(pose, { bobberY: 0.17, leaderY: depth, rodX: 0, fishPitch: 0, tension: 0, shake: 0,
          disturbance: 0.24, duration: escapePoint === 'breach' ? 1.25 : 0.96 }, 0.12);
      if (!keepCamera) tl.to(pose, { bobberX: -0.35, bobberZ: -8, rodZ: 0, duration: 0.5 }, '>-0.5');
      if (playSound && escapePoint === 'breach') tl.call(playSound, ['splash'], 0.32);
      else if (playSound && (escapePoint === 'rod' || escapePoint === 'surface')) tl.call(playSound, ['water-tug'], 0.19);
      break;
    }
    case 'FINAL_APPROACH':
      if (keepCamera) {
        tl.to(pose, { bobberY: 0.09, tension: 0.2, disturbance: 0.32, duration: 0.52 + pullDelay * 0.35 });
      } else {
        tl.to(pose, { bobberY: 0.13, bobberX: -0.35, bobberZ: -8, rodZ: 0, leaderY: -4.01, duration: 0.56 })
          .to(pose, { bobberY: 0.16, leaderY: -3.96, tension: 0.33, duration: 0.35 + pullDelay * 0.62 });
      }
      break;
    case 'DECOY_BITE':
    case 'BITING': {
      const depth = keepCamera ? pose.leaderY : -3.74;
      tl.to(pose, { bobberY: -0.19, leaderY: depth - 0.34, rodX: -0.055, bend: 0.065, taut: 1, disturbance: 1,
        fishPitch: -0.15, fishStruggle: 1, duration: 0.15, ease: 'power2.out' })
        .to(pose, { bobberY: -0.07, leaderY: depth, rodX: -0.04, fishPitch: 0.45, fishStruggle: 0.55,
          tension: 0.41, duration: 0.62 + pullDelay });
      break;
    }
    case 'SPLASH':
      animateBreach(tl, pose, playSound);
      break;
    case 'REVEALING':
      tl.fromTo(pose, { reveal: 0 }, { reveal: 1, duration: 1.2, ease: 'none' });
      break;
    default: tl.kill();
  }
  if (phase !== 'CASTING' && phase !== 'REVEALING' && isFishing(phase)) {
    tl.fromTo(pose, { shotProgress: 0 }, { shotProgress: 1, duration: tl.duration(), ease: 'none' }, 0);
  }
  if (playSound) {
    for (const [time, cue] of SOUND_CUES[phase] ?? []) tl.call(playSound, [cue], time);
  }
  return tl;
}

/** Shared normal/reduced-motion driver; all callers receive the same cleanup contract. */
export function driveFishingPhase(lifecycle: FishingLifecycle, phase: FishingPhase, reducedMotion: boolean, playSound?: (cue: FishingCue) => void) {
  if (!isFishing(phase)) return () => {};
  if (reducedMotion) { lifecycle.skip(); return () => {}; }
  const run = lifecycle.run;
  const shot = lifecycle.shot;
  const timeline = playFishingPhase(phase, lifecycle.pose, () => lifecycle.complete(run, phase, shot),
    playSound && (cue => { if (lifecycle.shot === shot) playSound(cue); }), lifecycle.pullDelay, lifecycle.escapePoint, lifecycle.keepCamera);
  return () => { timeline.kill(); };
}
