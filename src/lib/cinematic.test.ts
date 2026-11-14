import { describe, expect, it, vi } from 'vitest';
import { FishingLifecycle, isFishing, PHASES, restingPose } from './cinematic';
import { addNames, completeDraw, eligibleEntries, emptyState } from './picker';
import { selectWinner } from './random';
import { validateState } from './storage';

const draw = { id: 'draw-1', entryId: 'one', name: '魚', timestamp: '2026-10-18T00:00:00.000Z' };
const committed = { draw, candidates: [] };
const withDecoy = { draw, candidates: [{ id: 'other', name: '007', removed: false }] };

describe('fishing presentation lifecycle', () => {
  it('commits before emitting CASTING, rejects overlaps and completes each phase once', () => {
    const run = new FishingLifecycle(() => 0.75);
    const commit = vi.fn(() => withDecoy);
    const observed: string[] = [];
    run.subscribe(() => { expect(commit).toHaveBeenCalledTimes(1); observed.push(run.phase); });
    expect(run.start(commit)).toBe(true);
    expect(run.start(commit)).toBe(false);
    expect(run.start(commit, true)).toBe(false);
    for (const phase of PHASES.filter(isFishing)) {
      expect(run.complete(run.run, 'IDLE')).toBe(false);
      expect(run.complete(run.run - 1, phase)).toBe(false);
      expect(run.complete(run.run, phase)).toBe(true);
      expect(run.complete(run.run, phase)).toBe(false);
    }
    expect(observed).toEqual(PHASES.slice(1));
    expect(run.draw).toEqual(draw);
  });
  it.each(PHASES.filter(isFishing))('skip/interruption during %s preserves winner and rejects stale callbacks', phase => {
    const run = new FishingLifecycle(() => 0.75);
    const select = vi.fn(() => withDecoy);
    run.start(select);
    while (run.phase !== phase) run.complete(run.run, run.phase);
    run.pose.bobberZ = -3;
    const oldRun = run.run;
    run.skip(); run.skip();
    expect(run.phase).toBe('RESULT');
    expect(run.draw).toBe(draw);
    expect(run.pose).toEqual(restingPose());
    expect(run.complete(oldRun, phase)).toBe(false);
    expect(select).toHaveBeenCalledTimes(1);
    expect(run.close()).toBe(true);
    expect(run.close()).toBe(false);
    run.start(() => ({ ...committed, draw: { ...draw, id: 'draw-2' } }));
    expect(run.complete(oldRun, 'CASTING')).toBe(false);
    expect(run.phase).toBe('CASTING');
  });
  it('empty and failed transactions remain idle; reentrant selection cannot overlap', () => {
    const run = new FishingLifecycle();
    expect(run.start(() => null)).toBe(false);
    expect(run.phase).toBe('IDLE');
    expect(() => run.start(() => { throw Error('selection failed'); })).toThrow('selection failed');
    expect(run.phase).toBe('IDLE');
    run.start(() => { expect(run.start(() => committed)).toBe(false); return committed; });
    expect(run.close()).toBe(false);
  });
  it('supports Fish Again only after RESULT and cleans subscriptions', () => {
    const run = new FishingLifecycle();
    const listener = vi.fn(); const stop = run.subscribe(listener);
    run.start(() => committed); run.skip(); stop();
    expect(run.start(() => committed)).toBe(false);
    const calls = listener.mock.calls.length;
    expect(run.start(() => ({ ...committed, draw: { ...draw, id: 'draw-2' } }), true)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(run.draw?.id).toBe('draw-2');
  });
  it('integrates one committed draw with duplicate entries, elimination, history and reload', () => {
    let state = addNames({ ...emptyState(), removeCaught: true }, '007\n007\nAda', (() => { let n = 0; return () => `entry-${++n}`; })());
    const run = new FishingLifecycle(() => 0.75); let randomCalls = 0; let nextId = 0;
    const commit = vi.fn(() => {
      const candidates = eligibleEntries(state);
      const winner = selectWinner(candidates, () => { randomCalls++; return 0; });
      if (!winner) return null;
      state = completeDraw(state, winner, `catch-${++nextId}`, draw.timestamp);
      return { draw: state.history[0]!, candidates };
    });
    run.start(commit);
    for (let i = 0; i < 20; i++) run.start(commit);
    expect(state.history).toHaveLength(1);
    expect(state.entries.filter(entry => entry.removed)).toHaveLength(1);
    expect(run.school.filter(entry => entry.label === '007')).toHaveLength(2);
    expect(run.school.filter(entry => entry.catchesHook)).toEqual([{ id: 'entry-1', label: '007', catchesHook: true }]);
    while (run.phase !== 'DECOY_ESCAPE') run.complete(run.run, run.phase);
    expect(state.history.map(entry => entry.entryId)).toEqual(['entry-1']);
    expect(state.entries.find(entry => entry.id === run.decoy?.id)?.removed).toBe(false);
    run.skip();
    expect(run.draw?.entryId).toBe('entry-1');
    expect(state.history).toHaveLength(1);
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    run.start(commit, true);
    expect(run.school.map(entry => entry.id)).not.toContain('entry-1');
    expect(run.school.filter(entry => entry.catchesHook)).toEqual([{ id: 'entry-2', label: '007', catchesHook: true }]);
    run.skip(); run.close();
    expect(run.school).toEqual([]);
    expect(state.history).toHaveLength(2);
    expect(state.history.map(catchRecord => catchRecord.entryId)).toEqual(['entry-2', 'entry-1']);
    expect(randomCalls).toBe(2);
    expect(run.phase).toBe('IDLE');
  });
  it('caps a large cast at ten distinct tagged fish and always includes the committed label', () => {
    const run = new FishingLifecycle();
    const candidates = Array.from({ length: 50 }, (_, index) => ({
      id: String(index),
      name: String(index).padStart(3, '0'),
      removed: index === 0,
    }));
    const winner = candidates[47]!;
    run.start(() => ({ draw: { ...draw, entryId: winner.id, name: winner.name }, candidates }));
    expect(run.school).toHaveLength(10);
    expect(new Set(run.school.map(entry => entry.id)).size).toBe(10);
    expect(run.school.map(entry => entry.id)).not.toContain('0');
    expect(run.school.filter(entry => entry.catchesHook)).toEqual([{ id: '47', label: '047', catchesHook: true }]);
  });
  it('goes directly to the real bite when only one entry is eligible', () => {
    const run = new FishingLifecycle();
    run.start(() => committed);
    while (run.phase !== 'UNDERWATER') run.complete(run.run, run.phase);
    expect(run.decoy).toBeUndefined();
    run.complete(run.run, 'UNDERWATER');
    expect(run.phase).toBe('BITING');
  });
  it.each([0, 1, 2, 3])('plays %i distinct escape attempts before the same committed bite', count => {
    const run = new FishingLifecycle(() => (count + 0.5) / 4);
    const candidates = ['002', '014', '042', '050'].map(name => ({ id: name, name, removed: false }));
    const select = vi.fn(() => ({ draw, candidates }));
    run.start(select);
    const escapes = [];
    let firstBiteShot: number | undefined;
    for (let step = 0; step < 24 && run.phase !== 'RESULT'; step++) {
      if (run.phase === 'DECOY_BITE') {
        if (firstBiteShot !== undefined) expect(run.complete(run.run, 'DECOY_BITE', firstBiteShot)).toBe(false);
        firstBiteShot ??= run.shot;
      }
      if (run.phase === 'DECOY_ESCAPE') escapes.push(run.decoy?.id);
      run.complete(run.run, run.phase);
    }
    expect(escapes).toHaveLength(count);
    expect(new Set(escapes).size).toBe(count);
    expect(escapes).not.toContain(draw.entryId);
    expect(run.phase).toBe('RESULT');
    expect(run.draw).toBe(draw);
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('gives a repeated miss count one redraw and still allows repeats', () => {
    const candidates = ['a', 'b', 'c'].map(id => ({ id, name: id, removed: false }));
    const next = vi.fn(() => ({ draw, candidates }));
    const random = vi.fn(() => 0.52);
    const run = new FishingLifecycle(random);
    run.start(next);
    expect(run.decoys).toHaveLength(2);
    run.skip();
    random.mockReturnValueOnce(0.53).mockReturnValueOnce(0.05);
    run.start(next, true);
    expect(run.decoys).toHaveLength(0);
    run.skip();
    random.mockReturnValueOnce(0.05).mockReturnValueOnce(0.10);
    run.start(next, true);
    expect(run.decoys).toHaveLength(0);
    expect(run.draw).toBe(draw);
    expect(next).toHaveBeenCalledTimes(3);
  });
  it('honors the selected test shots and a direct catch without changing selection', () => {
    const candidates = ['a', 'b', 'c'].map(id => ({ id, name: id, removed: false }));
    const next = vi.fn(() => ({ draw, candidates }));
    const run = new FishingLifecycle(() => 0.55);
    run.start(next, false, ['rod', 'breach', 'midway']);
    const shots = [];
    while (isFishing(run.phase)) {
      if (run.phase === 'DECOY_ESCAPE') shots.push(run.escapePoint);
      run.complete(run.run, run.phase);
    }
    expect(shots).toEqual(['rod', 'breach', 'midway']);
    run.start(next, true, []);
    expect(run.decoys).toHaveLength(0);
    expect(run.draw).toBe(draw);
    expect(next).toHaveBeenCalledTimes(2);
  });
  it.each([
    [0.18, 'early', true],
    [0.75, 'breach', false],
  ] as const)('chooses whether to hold the same shot by chance (%s)', (roll, nextPoint, holds) => {
    const candidates = ['a', 'b'].map(id => ({ id, name: id, removed: false }));
    const random = vi.fn(() => 0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0.01).mockReturnValueOnce(roll);
    const run = new FishingLifecycle(random);
    run.start(() => ({ draw, candidates }));
    while (run.phase !== 'DECOY_ESCAPE') run.complete(run.run, run.phase);
    expect(run.escapePoint).toBe('early');
    expect(run.holdShot).toBe(holds);
    run.complete(run.run, run.phase);
    expect(run.escapePoint).toBe(nextPoint);
    expect(run.continuingShot).toBe(holds);
    expect(run.draw).toBe(draw);
  });
});
