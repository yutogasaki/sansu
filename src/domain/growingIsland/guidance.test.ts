import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { achievementSuggestions, migrateGuidance, noteTownBuilds, pendingAchievements, starterStep } from './guidance';
import { ingestCompletions, newIsland } from './island';
import { openTown } from './town';
import { landCells } from './space';
import type { Command, GrowingState } from './types';
const act = (state: GrowingState, command: Command, id = crypto.randomUUID()) => applyIntent(state, { id, command }, 100).state;
const home = (state: GrowingState) => act(state, { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });

describe('island guidance evidence', () => {
    it('explains actual prices, unlocks and space instead of sending every unavailable goal to a bench', () => {
        const state = newIsland('kid', 0);
        const goal = (id: string) => achievementSuggestions(state).find(item => item.id === id)!;
        expect(goal('A2').reason).toContain('しずく 4こ。いまは 0こ');
        expect(goal('A5').reason).toContain('えらべるようになったら');
        expect(goal('A6').reason).toContain('しずく 12こ。いまは 0こ');
        state.tutorial = 'done'; state.drops = 1;
        expect(goal('A1').reason).toContain('しずく 4こ。いまは 1こ');
        state.landmarks = [];
        expect(goal('A4').reason).toContain('おいたら うごかせる');
        state.landmarks = [...landCells(state)].map((cell, index) => ({ id: `full-${index}`, kind: 'bench', growth: 0, cell }));
        state.drops = 100; state.unlocked.push('landmark:bandstand');
        for (const id of ['A1', 'A2', 'A4', 'A5']) {
            expect(goal(id).available).toBe(false);
            expect(goal(id).reason).toContain('ばしょ');
            expect(goal(id).reason).not.toContain('しずく');
        }
    });
    it('keeps five starter steps separate from the free-home command flag and supports open-all', () => {
        let state = home(newIsland('kid', 0));
        expect(state.tutorial).toBe('done');
        expect(starterStep(state)).toBe('S2');
        expect(state.guidance?.achievements.A1).toBeUndefined();
        state = act(state, { type: 'open-all' });
        expect(starterStep(state)).toBe('S4');
        expect(state.guidance?.starter.steps.S3?.targetId).toBe(state.villagers[0].id);
        expect(state.guidance?.achievements.A2).toBeUndefined();
        const learned = ingestCompletions(state, [{ id: 'supported-valid', at: 10 }]);
        expect(learned.state.guidance?.starter.steps.S4).toBeUndefined();
        state = act(learned.state, { type: 'learning-returned', profileId: 'kid', expectedRevision: 0 });
        expect(starterStep(state)).toBe('S5');
    });
    it('requires a paid ordinary seed actually built by town time and opened; nature and free homes do not qualify', () => {
        let state = act(home(newIsland('kid', 0)), { type: 'open-all' });
        state = ingestCompletions(state, Array.from({ length: 4 }, (_, i) => ({ id: `valid-${i}`, at: i + 1 }))).state;
        state = act(state, { type: 'plant', kind: 'farm', cell: { x: 4, z: 3 } });
        noteTownBuilds(state, openTown(state));
        const p = state.plots.find(p => p.kind === 'farm')!;
        expect(p.townBuilt).toBe(true);
        expect(state.guidance?.achievements.A2).toBeUndefined();
        state = act(state, { type: 'open', id: p.id });
        expect(state.guidance?.achievements.A2?.targetId).toBe(p.id);
        expect(state.guidance?.starter.steps.S5?.targetId).toBe(p.id);
        const old = structuredClone(state.guidance?.achievements.A2);
        state = act(state, { type: 'open', id: p.id });
        expect(state.guidance?.achievements.A2).toEqual(old);
        expect(pendingAchievements(state)).toEqual(['A1', 'A2']);
    });
    it('uses earlier banked learning for a seed planted later', () => {
        let state = act(home(newIsland('kid', 0)), { type: 'open-all' });
        state = ingestCompletions(state, Array.from({ length: 10 }, (_, i) => ({ id: `learn-${i}`, at: i + 1 }))).state;
        expect(state.town.bank).toBeGreaterThan(0);
        state = act(state, { type: 'plant', kind: 'farm', cell: { x: 4, z: 3 } });
        noteTownBuilds(state, openTown(state));
        const p = state.plots.find(p => p.kind === 'farm')!;
        state = act(state, { type: 'open', id: p.id });
        expect(state.guidance?.achievements.A2).toBeDefined();
    });
    it('ignores no-op moves/colours, keeps immutable memories and never revokes them', () => {
        let state = newIsland('kid', 0);
        state = act(state, { type: 'flag', color: 0 });
        state = act(state, { type: 'move', id: 'starter-bench', cell: { x: 3, z: 3 } });
        expect(state.guidance?.achievements).toEqual({});
        state = act(state, { type: 'flag', color: 2 });
        state = act(state, { type: 'move', id: 'starter-bench', cell: { x: 4, z: 3 } });
        const original = structuredClone(state.guidance?.achievements);
        state = act(state, { type: 'flag', color: 3 });
        state = act(state, { type: 'store', id: 'starter-bench' });
        expect(state.guidance?.achievements).toEqual(original);
        expect(original?.A3?.snapshot.flagColor).toBe(2);
        expect(original?.A4?.snapshot.target).toMatchObject({ cell: { x: 4, z: 3 } });
        expect(() => act(state, { type: 'move', id: 'starter-bench', cell: { x: 5, z: 3 } })).toThrow();
    });
    it('captures a saved expansion once and preserves it after later growth; failed paint or expansion is not evidence', () => {
        let state = newIsland('kid', 0);
        const original = structuredClone(state);
        expect(() => act(state, { type: 'paint', target: 'starter-bench', color: 2 })).toThrow();
        expect(() => act(state, { type: 'expand', side: 'east' })).toThrow();
        expect(state).toEqual(original);
        state.drops = 50;
        state = act(state, { type: 'expand', side: 'east' }, 'expand-east');
        const first = structuredClone(state.guidance?.achievements.A6);
        expect(first).toMatchObject({ source: 'expand-east', at: 100, snapshot: { land: { expanded: 'east', extra: [], capes: [] } } });
        state = act(state, { type: 'expand', side: 'west' });
        expect(state.guidance?.achievements.A6).toEqual(first);
        expect(state.land.extra).toEqual(['west']);
    });
    it('dismisses/resumes guidance without redistributing rights and keeps chosen goals through resource changes', () => {
        let state = newIsland('kid', 0);
        state = act(state, { type: 'starter-guide', automatic: false });
        state = act(state, { type: 'choose-goal', id: 'A6' });
        state = act(state, { type: 'starter-guide', automatic: true });
        expect(state.guidance?.selected).toBe('A6');
        expect(state.drops).toBe(0); expect(state.tutorial).toBe('first-home');
        expect(achievementSuggestions(state).find(a => a.id === 'A6')?.available).toBe(false);
        state = act(state, { type: 'choose-goal' });
        expect(state.guidance?.selected).toBeUndefined();
    });
    it('migrates only provable old facts silently and omits dates; old islands skip the unavailable free starter', () => {
        const state = home(newIsland('kid', 0));
        delete state.guidance;
        state.land.expanded = 'east';
        migrateGuidance(state);
        expect(state.guidance?.achievements.A1).toBeUndefined();
        expect(state.guidance?.achievements.A6).toMatchObject({ source: 'legacy', snapshot: { legacy: true } });
        expect(state.guidance?.achievements.A6?.at).toBeUndefined();
        expect(state.guidance?.starter.automatic).toBe(false);
        expect(starterStep(state)).toBe('S4');
        expect(pendingAchievements(state)).toEqual([]);
        const snapshot = structuredClone(state.guidance);
        migrateGuidance(state); expect(state.guidance).toEqual(snapshot);
    });
    it('credits the future opening of a provably built old paid plot without awarding its unknown past opening', () => {
        let state = home(newIsland('kid', 0));
        state.plots.push({ id: 'old-farm', kind: 'farm', cell: { x: 4, z: 3 }, plantedAt: 2, builtAt: 8, stage: 1, growth: 0, origin: 'seed', paid: 4 });
        state.unopened.push('old-farm'); delete state.guidance;
        migrateGuidance(state);
        expect(state.guidance?.achievements.A2).toBeUndefined();
        state = act(state, { type: 'open', id: 'old-farm' });
        expect(state.guidance?.achievements.A2?.source).not.toBe('legacy');
        expect(state.guidance?.achievements.A2?.targetId).toBe('old-farm');
    });
    it('does not credit invalid or pre-enrollment learning and completion retries keep the original evidence', () => {
        const state = newIsland('kid', 10);
        expect(ingestCompletions(state, [{ id: 'old', at: 9 }, { id: 'bad', at: NaN }]).added).toBe(0);
        const first = ingestCompletions(state, [{ id: 'one', at: 11 }]);
        expect(ingestCompletions(first.state, [{ id: 'one', at: 11 }]).state).toBe(first.state);
        expect(first.state.guidance?.learning?.source).toBe('learning:one');
    });
    it('uses actual expansion price and bandstand unlock/space when ranking suggestions', () => {
        const state = newIsland('kid', 0);
        state.drops = 30; state.land = { expanded: 'east', extra: ['west'], capes: [] };
        expect(achievementSuggestions(state).find(a => a.id === 'A6')?.available).toBe(false);
        expect(achievementSuggestions(state).find(a => a.id === 'A5')?.available).toBe(false);
        state.unlocked.push('landmark:bandstand');
        expect(achievementSuggestions(state).find(a => a.id === 'A5')?.available).toBe(true);
    });
});
