import { BOBBER } from '../scenes/config';
import type { CommittedCatch, Draw } from '../types/picker';

export const PHASES = ['IDLE', 'CASTING', 'WAITING_FOR_BITE', 'UNDERWATER', 'DECOY_BITE', 'DECOY_PULL', 'DECOY_ESCAPE', 'FINAL_APPROACH', 'BITING', 'REELING', 'SPLASH', 'REVEALING', 'RESULT'] as const;
const SCHOOL_SIZE = 10;
export type CinematicFish = { id: string; label: string; catchesHook: boolean };

/** The picker has already committed the result. This shuffle only stages the shot. */
function stageSchool({ draw, candidates }: CommittedCatch): CinematicFish[] {
  const others = candidates.filter(entry => !entry.removed && entry.id !== draw.entryId);
  const school: CinematicFish[] = [];
  for (let slot = 0; slot < Math.min(SCHOOL_SIZE - 1, others.length); slot++) {
    const index = slot + Math.floor(Math.random() * (others.length - slot));
    [others[slot], others[index]] = [others[index]!, others[slot]!];
    const entry = others[slot]!;
    school.push({ id: entry.id, label: entry.name, catchesHook: false });
  }
  const winnerSlot = Math.floor(Math.random() * (school.length + 1));
  school.splice(winnerSlot, 0, { id: draw.entryId, label: draw.name, catchesHook: true });
  return school;
}

export type FishingPhase = typeof PHASES[number];
export function hasSwimmingSchool(phase?: FishingPhase) {
  return phase === 'WAITING_FOR_BITE' || phase === 'UNDERWATER' || phase === 'DECOY_BITE' ||
    phase === 'DECOY_PULL' || phase === 'DECOY_ESCAPE' || phase === 'FINAL_APPROACH' || phase === 'BITING' || phase === 'REELING';
}
type CatchShot = 'fight' | 'rod' | 'surface' | 'breach' | 'hero';
export const ESCAPE_POINTS = ['early', 'midway', 'rod', 'surface', 'breach'] as const;
export type EscapePoint = typeof ESCAPE_POINTS[number];
function sameEscapeShot(first: EscapePoint, second: EscapePoint) {
  return first === second || (ESCAPE_POINTS.indexOf(first) < 2 && ESCAPE_POINTS.indexOf(second) < 2);
}

export function isFishing(phase: FishingPhase) { return phase !== 'IDLE' && phase !== 'RESULT'; }
export function restingPose(): FishingPose {
  return { rodX: 0, rodZ: 0, bend: 0, bobberX: BOBBER[0], bobberY: BOBBER[1], bobberZ: BOBBER[2],
    taut: 0, splash: 0, splashSize: 1, disturbance: 0, reveal: 0,
    shotProgress: 0, reelTime: 0, breachProgress: 0, leaderY: -0.35, fishPitch: 0, fishStruggle: 0, catchShot: 'fight',
    tension: 0, shake: 0, escapeX: 0, escapeY: 0, escapeZ: 0, escapePitch: 0 };
}
export interface FishingPose {
  rodX: number;
  rodZ: number;
  bend: number;
  bobberX: number;
  bobberY: number;
  bobberZ: number;
  taut: number;
  splash: number;
  splashSize: number;
  disturbance: number;
  reveal: number;
  shotProgress: number;
  reelTime: number;
  breachProgress: number;
  leaderY: number;
  fishPitch: number;
  fishStruggle: number;
  tension: number;
  catchShot: CatchShot;
  shake: number;
  escapeX: number;
  escapeY: number;
  escapeZ: number;
  escapePitch: number;
}

/** Presentation only. Selection/commit is supplied once, before CASTING is emitted. */
export class FishingLifecycle {
  constructor(private readonly presentationRandom = () => Math.random()) {}
  phase: FishingPhase = 'IDLE';
  draw: Draw | null = null;
  school: readonly CinematicFish[] = [];
  decoys: readonly CinematicFish[] = [];
  attempt = 0;
  pullDelay = 0.35;
  get decoy() { return this.decoys[this.attempt]; }
  get escapePoint(): EscapePoint { return this.escapePlan[this.attempt] ?? 'early'; }
  get holdShot() {
    const next = this.escapePlan[this.attempt + 1];
    return next === undefined ? this.keepShotForCatch : sameEscapeShot(this.escapePoint, next);
  }
  get keepCamera() { return this.phase === 'DECOY_ESCAPE' ? this.holdShot : this.continuingShot; }
  continuingShot = false;
  run = 0;
  shot = 0;
  readonly pose = restingPose();
  private starting = false;
  private previousMissCount?: number;
  private escapePlan: readonly EscapePoint[] = [];
  private keepShotForCatch = false;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.phase;
  private enter(phase: FishingPhase) {
    this.shot++;
    this.pose.shotProgress = 0;
    if ((phase === 'DECOY_PULL' || phase === 'REELING') && !this.continuingShot) {
      this.pose.catchShot = 'fight';
      this.pose.reelTime = 0;
    }
    if (phase === 'SPLASH') {
      this.pose.catchShot = 'breach';
      this.pose.breachProgress = 0;
    }
    if (phase === 'DECOY_ESCAPE') {
      this.pose.escapeX = this.pose.bobberX - 0.11;
      this.pose.escapeY = this.pose.bobberY + this.pose.leaderY;
      this.pose.escapeZ = this.pose.bobberZ;
      this.pose.escapePitch = this.pose.fishPitch;
    }
    this.phase = phase;
    this.listeners.forEach(listener => listener());
  }
  start(selectAndCommit: () => CommittedCatch | null | undefined, again = false, escapePlan?: readonly EscapePoint[]) {
    if (this.starting || (this.phase !== 'IDLE' && !(again && this.phase === 'RESULT'))) return false;
    this.starting = true;
    try {
      const committed = selectAndCommit();
      if (!committed) return false;
      this.draw = committed.draw;
      this.school = stageSchool(committed);
      this.attempt = 0;
      const otherFish = this.school.filter(fish => !fish.catchesHook);
      const maxMisses = Math.min(3, otherFish.length);
      let count = Math.min(escapePlan?.length ?? Math.floor(this.presentationRandom() * (maxMisses + 1)), maxMisses);
      if (!escapePlan && maxMisses > 0 && count === this.previousMissCount) {
        count = Math.floor(this.presentationRandom() * (maxMisses + 1));
      }
      if (!escapePlan) this.previousMissCount = count;
      this.decoys = otherFish.slice(0, count);
      const points: EscapePoint[] = [];
      if (!escapePlan) {
        while (points.length < count) {
          const previous = points.at(-1);
          // Give each subsequent fish a one-in-three chance to use the same camera.
          if (previous && this.presentationRandom() < 1 / 3) {
            points.push(previous);
          } else {
            const choices = previous ? ESCAPE_POINTS.filter(point => !sameEscapeShot(previous, point)) : ESCAPE_POINTS;
            points.push(choices[Math.floor(this.presentationRandom() * choices.length)]!);
          }
        }
      }
      this.escapePlan = escapePlan?.slice(0, count) ?? points;
      this.keepShotForCatch = !escapePlan && count > 0 && this.presentationRandom() < 1 / 3;
      this.continuingShot = false;
      this.pullDelay = 0.28 + this.presentationRandom() * 0.52;
      this.run++;
      Object.assign(this.pose, restingPose());
      this.enter('CASTING');
      return true;
    } finally { this.starting = false; }
  }
  complete(run: number, phase: FishingPhase, shot = this.shot) {
    if (run !== this.run || shot !== this.shot || phase !== this.phase || !isFishing(phase)) return false;
    if (phase === 'DECOY_ESCAPE') {
      this.continuingShot = this.holdShot;
      this.attempt++;
      this.pullDelay = 0.28 + this.presentationRandom() * 0.52;
    }
    if (phase === 'UNDERWATER' || phase === 'FINAL_APPROACH') {
      this.enter(this.decoy ? 'DECOY_BITE' : 'BITING');
    } else if (phase === 'REELING' && this.continuingShot && this.pose.catchShot === 'hero') {
      this.enter('REVEALING');
    } else {
      this.enter(PHASES[PHASES.indexOf(phase) + 1]!);
    }
    return true;
  }
  /** Interrupted presentation reveals the committed catch; it never cancels the draw. */
  skip = () => {
    if (!isFishing(this.phase)) return;
    Object.assign(this.pose, restingPose());
    this.enter('RESULT');
  };
  close = () => {
    if (this.phase !== 'RESULT') return false;
    this.run++;
    this.draw = null;
    this.school = [];
    this.decoys = [];
    this.attempt = 0;
    Object.assign(this.pose, restingPose());
    this.enter('IDLE');
    return true;
  };
}
