import { describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { FishingLifecycle, PHASES, isFishing, restingPose, type FishingPhase, type FishingPose } from './cinematic';
import { driveFishingPhase, FISHING_WATCHDOG_MS, playFishingPhase, watchFishingRun } from './fishingAnimation';

const draw = { id: 'a', entryId: 'one', name: 'Ada', timestamp: '2026-10-18T00:00:00.000Z' };
const committed = { draw, candidates: [] };
const withDecoy = { draw, candidates: [{ id: 'other', name: '007', removed: false }] };

describe('owned fishing timelines', () => {
  it('runs every phase by completion signals with continuous endpoints and bounded poses', () => {
    const lifecycle = new FishingLifecycle(() => 0.75); lifecycle.start(() => withDecoy);
    let duration = 0;
    for (const phase of PHASES.filter(isFishing)) {
      const complete = vi.fn(() => lifecycle.complete(lifecycle.run, phase));
      const before = { ...lifecycle.pose };
      const tl = playFishingPhase(phase, lifecycle.pose, complete).pause();
      duration += tl.duration();
      tl.time(0);
      // Splash intentionally starts an effect, but rig coordinates must not jump.
      for (const key of ['rodX', 'rodZ', 'bobberX', 'bobberY', 'bobberZ'] as const) {
        expect(lifecycle.pose[key]).toBe(before[key]);
      }
      for (let fraction = 0.05; fraction < 1; fraction += 0.05) {
        tl.progress(fraction);
        (Object.keys(restingPose()) as (keyof FishingPose)[]).forEach(key => {
          if (key !== 'catchShot') expect(Number.isFinite(lifecycle.pose[key])).toBe(true);
        });
        expect(Math.abs(lifecycle.pose.rodX)).toBeLessThan(0.3);
        expect(lifecycle.pose.bobberZ).toBeLessThan(-1.5);
      }
      tl.progress(1);
      expect(complete).toHaveBeenCalledTimes(1);
      tl.kill();
    }
    expect(duration).toBeGreaterThan(10);
    expect(duration * 1000).toBeLessThan(FISHING_WATCHDOG_MS - 2_000);
    expect(lifecycle.phase).toBe('RESULT');
    expect(lifecycle.pose.splash).toBe(0);
    expect(gsap.getTweensOf(lifecycle.pose)).toHaveLength(0);
  });
  it('lifts the hooked decoy under tension before release and leaves time for three escapes', () => {
    const lifecycle = new FishingLifecycle(() => 0.999);
    const candidates = ['a', 'b', 'c'].map(id => ({ id, name: id, removed: false }));
    lifecycle.start(() => ({ draw, candidates }), false, ['breach', 'surface', 'breach']);
    let duration = 0;
    let pulls = 0;
    while (isFishing(lifecycle.phase)) {
      const phase = lifecycle.phase;
      const keepCamera = phase === 'DECOY_ESCAPE' ? lifecycle.holdShot : lifecycle.continuingShot;
      const depth = lifecycle.pose.bobberY + lifecycle.pose.leaderY;
      const tl = playFishingPhase(phase, lifecycle.pose, () => {}, undefined,
        lifecycle.pullDelay, lifecycle.escapePoint, keepCamera).pause();
      duration += tl.duration();
      tl.progress(1);
      if (phase === 'DECOY_PULL') {
        pulls++;
        expect(lifecycle.pose.bobberY + lifecycle.pose.leaderY).toBeGreaterThan(depth + 0.9);
        expect(lifecycle.pose.taut).toBe(1);
      }
      if (phase === 'DECOY_ESCAPE') expect(lifecycle.pose.taut).toBe(0);
      tl.kill();
      lifecycle.complete(lifecycle.run, phase);
      if (phase === 'DECOY_PULL' && lifecycle.escapePoint === 'breach') {
        expect(lifecycle.pose.escapeY).toBeCloseTo(0.95);
        expect(lifecycle.pose.escapePitch).toBeCloseTo(0.28);
      }
    }
    expect(pulls).toBe(3);
    expect(duration * 1000).toBeLessThan(FISHING_WATCHDOG_MS - 2_000);
  });
  it.each([
    ['early', 'midway', 'fight'],
    ['rod', 'rod', 'rod'],
    ['surface', 'surface', 'surface'],
    ['breach', 'breach', 'hero'],
  ] as const)('plays two escapes in one camera setup for %s and %s', (first, second, camera) => {
    const lifecycle = new FishingLifecycle(() => 0.5);
    const candidates = ['014', '042'].map(id => ({ id, name: id, removed: false }));
    lifecycle.start(() => ({ draw, candidates }), false, [first, second]);
    const released: string[] = [];
    const uninterrupted = ['DECOY_ESCAPE', 'FINAL_APPROACH', 'DECOY_BITE', 'DECOY_PULL'];
    while (isFishing(lifecycle.phase)) {
      const phase = lifecycle.phase;
      const keepCamera = phase === 'DECOY_ESCAPE' ? lifecycle.holdShot : lifecycle.continuingShot;
      const timeline = playFishingPhase(phase, lifecycle.pose, () => {}, undefined,
        lifecycle.pullDelay, lifecycle.escapePoint, keepCamera).pause();
      const firstRelease = released.length === 0 && phase === 'DECOY_ESCAPE';
      if (firstRelease || (released.length === 1 && uninterrupted.includes(phase))) {
        for (const progress of [0, 0.25, 0.5, 1]) {
          timeline.progress(progress);
          expect(lifecycle.pose.catchShot).toBe(camera);
        }
      }
      timeline.progress(1).kill();
      if (phase === 'DECOY_ESCAPE') released.push(lifecycle.decoy!.id);
      lifecycle.complete(lifecycle.run, phase);
    }
    expect(new Set(released)).toEqual(new Set(['014', '042']));
    expect(lifecycle.draw).toBe(draw);
  });
  it.each([
    ['early', 'fight', -3.19],
    ['midway', 'fight', -1.33],
    ['rod', 'rod', -0.41],
    ['surface', 'surface', -0.23],
    ['breach', 'hero', 0.95],
  ] as const)('releases the fish at the %s beat with the same reel and camera as the catch', (point, shot, depth) => {
    const pose = { ...restingPose(), bobberY: -0.08, leaderY: -3.9, taut: 1 };
    const pull = playFishingPhase('DECOY_PULL', pose, () => {}, undefined, 0.48, point).pause();
    const winner = { ...pose };
    const reel = playFishingPhase('REELING', winner, () => {}).pause();
    let splash: ReturnType<typeof playFishingPhase> | undefined;
    for (let time = 0.1; time < pull.duration() - 0.01; time += 0.1) {
      pull.time(time);
      if (time <= reel.duration()) reel.time(time);
      else {
        if (!splash) {
          reel.progress(1);
          splash = playFishingPhase('SPLASH', winner, () => {}).pause();
        }
        splash.time(time - reel.duration());
      }
      for (const key of ['bobberY', 'bobberZ', 'leaderY', 'reelTime', 'breachProgress', 'tension'] as const) {
        expect(pose[key]).toBeCloseTo(winner[key]);
      }
      expect(pose.catchShot).toBe(winner.catchShot);
    }
    reel.kill();
    splash?.kill();
    pull.progress(1).kill();
    expect(pose.catchShot).toBe(shot);
    expect(pose.bobberY + pose.leaderY).toBeCloseTo(depth);
    expect(pose.taut).toBe(1);
    const release = playFishingPhase('DECOY_ESCAPE', pose, () => {}, undefined, 0.48, point).pause();
    release.progress(1).kill();
    expect(pose.taut).toBe(0);
    expect(pose.splash).toBe(0);
    expect(pose.bobberY + pose.leaderY).toBeLessThan(depth);
  });
  it('shows the hooked fish gain height, pull the line down twice, and recover under tension', () => {
    const pose = { ...restingPose(), bobberY: -0.07, leaderY: -3.74, taut: 1 };
    const reel = playFishingPhase('REELING', pose, () => {}).pause();
    for (const [rise, dive, recovery] of [[0.37, 0.69, 0.98], [3.07, 3.48, 4.37]] as const) {
      reel.time(rise);
      const raised = pose.bobberY + pose.leaderY;
      const initialBend = pose.bend;
      reel.time(dive);
      const lowered = pose.bobberY + pose.leaderY;
      expect(lowered).toBeLessThan(raised - 0.6);
      expect(pose.bend).toBeGreaterThan(initialBend);
      expect(pose.taut).toBe(1);
      reel.time(recovery);
      expect(pose.bobberY + pose.leaderY).toBeGreaterThan(lowered + 0.6);
    }
    reel.kill();
  });
  it('drives the animated trophy entrance before making result actions available', () => {
    const lifecycle = new FishingLifecycle();
    lifecycle.start(() => committed);
    for (const phase of ['CASTING', 'WAITING_FOR_BITE', 'UNDERWATER', 'BITING', 'REELING', 'SPLASH'] as const) {
      expect(lifecycle.complete(lifecycle.run, phase)).toBe(true);
    }
    expect(lifecycle.phase).toBe('REVEALING');
    expect(lifecycle.close()).toBe(false);
    expect(lifecycle.start(() => committed, true)).toBe(false);
    const timeline = playFishingPhase(lifecycle.phase, lifecycle.pose, () => lifecycle.complete(lifecycle.run, 'REVEALING')).pause();
    expect(timeline.duration()).toBeCloseTo(1.2);
    timeline.progress(0.5);
    expect(lifecycle.pose.reveal).toBeGreaterThan(0);
    expect(lifecycle.pose.reveal).toBeLessThan(1);
    expect(lifecycle.phase).toBe('REVEALING');
    timeline.progress(1);
    expect(lifecycle.phase).toBe('RESULT');
    expect(lifecycle.draw).toBe(draw);
    timeline.kill();
  });
  it('follows the hooked fish from below the surface through the splash', () => {
    const lifecycle = new FishingLifecycle();
    lifecycle.start(() => committed);
    const play = (phase: FishingPhase, progress = 1) => {
      const timeline = playFishingPhase(phase, lifecycle.pose, () => {}).pause();
      timeline.progress(progress);
      timeline.kill();
    };
    play('CASTING');
    play('WAITING_FOR_BITE');
    play('UNDERWATER');
    expect(lifecycle.pose.shotProgress).toBe(1);
    expect(lifecycle.pose.taut).toBe(0);
    expect(lifecycle.pose.bobberY + lifecycle.pose.leaderY).toBeLessThan(-0.6);
    play('BITING');
    expect(lifecycle.pose.taut).toBe(1);
    const depth = lifecycle.pose.bobberY + lifecycle.pose.leaderY;
    expect(depth).toBeLessThan(-0.6);
    play('REELING');
    expect(lifecycle.pose.bobberY + lifecycle.pose.leaderY).toBeGreaterThan(depth);
    expect(lifecycle.pose.bobberY + lifecycle.pose.leaderY).toBeLessThan(0);
    play('SPLASH');
    expect(lifecycle.pose.bobberY + lifecycle.pose.leaderY).toBeGreaterThan(0.6);
  });
  it('kills interrupted animation resources without completion or mutations to the next run', () => {
    const lifecycle = new FishingLifecycle(); lifecycle.start(() => committed);
    const done = vi.fn();
    const tl = playFishingPhase('CASTING', lifecycle.pose, done).pause();
    tl.progress(0.4); tl.kill(); lifecycle.skip();
    expect(done).not.toHaveBeenCalled();
    expect(gsap.getTweensOf(lifecycle.pose)).toHaveLength(0);
    expect(lifecycle.pose.rodX).toBe(0);
    expect(lifecycle.phase).toBe('RESULT');
  });
});

it('reduced motion reveals the same committed catch with no timeline or camera movement', () => {
  const lifecycle = new FishingLifecycle(); const select = vi.fn(() => committed);
  lifecycle.start(select);
  const cleanup = driveFishingPhase(lifecycle, lifecycle.phase, true);
  expect(lifecycle.phase).toBe('RESULT');
  expect(lifecycle.draw).toBe(draw);
  expect(select).toHaveBeenCalledTimes(1);
  expect(lifecycle.pose).toEqual(restingPose());
  expect(gsap.getTweensOf(lifecycle.pose)).toHaveLength(0);
  cleanup();
});

it('phase driver cleanup cancels a normal-motion run without orphaned tweens', () => {
  const lifecycle = new FishingLifecycle(); lifecycle.start(() => committed);
  const cleanup = driveFishingPhase(lifecycle, 'CASTING', false);
  expect(gsap.getTweensOf(lifecycle.pose).length).toBeGreaterThan(0);
  cleanup();
  expect(gsap.getTweensOf(lifecycle.pose)).toHaveLength(0);
  lifecycle.skip();
  expect(lifecycle.phase).toBe('RESULT');
});

it('reveals a stalled catch and never interrupts a subsequent run', () => {
  vi.useFakeTimers();
  try {
    const lifecycle = new FishingLifecycle();
    const select = vi.fn(() => committed);
    lifecycle.start(select);
    const stop = watchFishingRun(lifecycle, lifecycle.run);
    vi.advanceTimersByTime(FISHING_WATCHDOG_MS);
    expect(lifecycle.phase).toBe('RESULT');
    expect(lifecycle.draw).toBe(draw);
    expect(select).toHaveBeenCalledTimes(1);
    stop();

    const staleRun = lifecycle.run;
    lifecycle.start(() => ({ ...committed, draw: { ...draw, id: 'next' } }), true);
    watchFishingRun(lifecycle, staleRun);
    vi.advanceTimersByTime(FISHING_WATCHDOG_MS);
    expect(lifecycle.phase).toBe('CASTING');
  } finally {
    vi.useRealTimers();
  }
});
