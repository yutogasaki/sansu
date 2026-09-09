import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controlled hook commits exercise async receipt ownership and real timers.
// Pixel bounds and native key hits remain actual-browser checks.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = [], effects: (() => void)[] = []; let cursor = 0, writes = 0;
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
    return {
        reset() { cells.length = 0; effects.length = 0; cursor = 0; writes = 0; }, begin() { cursor = 0; },
        get writes() { return writes; },
        useState(initial?: unknown) {
            const i = cursor++; if (!cells[i]) cells[i] = { value: initial };
            return [cells[i].value, (next: unknown) => { writes += 1; cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
        },
        useRef(value?: unknown) { const i = cursor++; if (!cells[i]) cells[i] = { value: { current: value } }; return cells[i].value; },
        useCallback(callback: unknown, deps: unknown[]) {
            const i = cursor++; if (!cells[i] || !same(cells[i].deps, deps)) cells[i] = { value: callback, deps }; return cells[i].value;
        },
        effect(callback: () => void | (() => void), deps?: unknown[]) {
            const i = cursor++, previous = cells[i];
            if (!previous || !same(previous.deps, deps)) {
                cells[i] = { deps, cleanup: previous?.cleanup };
                effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); }, unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useLayoutEffect: hooks.effect, useEffect: hooks.effect }));
// The real save lock and error handling run below; SW lifetime is outside this focused UI test.
vi.mock('../../pwa', () => ({ holdPwaUpdateForCriticalPersistence: () => () => undefined }));
import { runIslandMilestoneLearningAction, useIslandMilestoneNotice } from './useIslandMilestoneNotice';
import { useIslandActions } from './useIslandActions';
import { getIslandGrowthMilestone } from '../../domain/island/growth';

const east = { id: 'completed-east', habitats: ['garden' as const], expansion: 'east' as const };
const west = { id: 'completed-west', habitats: ['village' as const], expansion: 'west' as const };
beforeEach(() => { hooks.reset(); vi.useFakeTimers(); });
afterEach(() => { hooks.unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function harness() {
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    let profile = 'child', active = true, blocked = false, api!: ReturnType<typeof useIslandMilestoneNotice>;
    let actions!: ReturnType<typeof useIslandActions>;
    const RenderNotice = () => ({ notice: useIslandMilestoneNotice(profile, active, blocked), actions: useIslandActions() });
    const render = (next: { profile?: string; active?: boolean; blocked?: boolean } = {}) => {
        profile = next.profile ?? profile; active = next.active ?? active; blocked = next.blocked ?? blocked;
        // A layout-effect state update is flushed before exposing the committed UI.
        hooks.begin(); RenderNotice(); hooks.commit();
        hooks.begin(); const current = RenderNotice(); api = current.notice; actions = current.actions; hooks.commit();
        return api;
    };
    render();
    return { render, get api() { return api; }, get actions() { return actions; }, hidden(value: boolean) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); } };
}

describe('earned learning-header milestone lifetime', () => {
    it('starts only when the successful receipt arrives and expires after six seconds across ordinary rerenders', () => {
        const h = harness(), receipt = h.api.receipt();
        vi.advanceTimersByTime(8000); expect(h.render().milestone).toBeUndefined();
        receipt(east); expect(h.render().milestone).toBe(east);
        vi.advanceTimersByTime(5999); expect(h.render().milestone).toBe(east);
        vi.advanceTimersByTime(1); expect(h.render().milestone).toBeUndefined();
        h.api.receipt()(east); expect(h.render().milestone).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });
    it('replaces the current announcement instead of queueing it or letting its old timeout hide the new one', () => {
        const h = harness(); h.api.receipt()(east); h.render(); vi.advanceTimersByTime(3000);
        h.api.receipt()(west); expect(h.render().milestone).toBe(west);
        vi.advanceTimersByTime(3000); expect(h.render().milestone).toBe(west);
        vi.advanceTimersByTime(3000); expect(h.render().milestone).toBeUndefined();
        vi.advanceTimersByTime(6000); expect(h.render().milestone).toBeUndefined();
    });
    it.each(['exit', 'inactive', 'profile', 'error', 'hidden'] as const)('discards visible and in-flight announcements across %s and return', boundary => {
        const h = harness(); h.api.receipt()(east); h.render(); const pending = h.api.receipt();
        if (boundary === 'exit' || boundary === 'inactive') { h.render({ active: false }); h.render({ active: true }); }
        else if (boundary === 'profile') { h.render({ profile: 'other' }); h.render({ profile: 'child' }); }
        else if (boundary === 'error') { h.render({ blocked: true }); h.render({ blocked: false }); }
        else { h.hidden(true); h.hidden(false); }
        pending(west); expect(h.render().milestone).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
        h.api.receipt()(west); expect(h.render().milestone).toBe(west);
    });
    it('dismisses for retry/help without replay, but a later supported completion may earn a fresh milestone', () => {
        const h = harness(); h.api.receipt()(east); h.render(); h.api.dismiss();
        expect(h.render().milestone).toBeUndefined(); h.api.receipt()(east); expect(h.render().milestone).toBeUndefined();
        // Growth is identical for independent and supported completion; only a
        // new committed major change, rather than opening help, is announced.
        const progress = { garden: 6, village: 5, grove: 0, waterside: 0 };
        const milestone = getIslandGrowthMilestone({ completedSets: 8, growth: { progress, expansionLevel: 1 } },
            { completedSets: 9, growth: { progress: { ...progress, village: 6 }, expansionLevel: 2 } });
        expect(milestone).toEqual({ habitats: ['village'], expansion: 'west' });
        h.api.receipt()({ id: west.id, ...milestone! }); expect(h.render().milestone).toEqual(west);
    });
    it('clears timers on unmount and ignores a late receipt without state writes', () => {
        const h = harness(); h.api.receipt()(east); h.render(); const pending = h.api.receipt();
        hooks.unmount(); const writes = hooks.writes;
        pending(west); vi.advanceTimersByTime(6000);
        expect(vi.getTimerCount()).toBe(0); expect(hooks.writes).toBe(writes);
    });
    it('allows a new successful retry after clearing a prior save error, while an old receipt stays invalid', () => {
        const h = harness(), old = h.api.receipt(); h.render({ blocked: true });
        const retry = h.api.receipt(); h.render({ blocked: false });
        old(east); expect(h.render().milestone).toBeUndefined();
        retry(east); expect(h.render().milestone).toBe(east);
    });
    it.each(['answer', 'support_opened', 'model_opened', 'skipped'] as const)('does not let a same-tick ignored %s suppress the real in-flight successful receipt', async type => {
        const h = harness(); h.api.receipt()(east); h.render();
        let finish!: (value: string) => void;
        const saved = new Promise<string>(resolve => { finish = resolve; });
        const firstSave = vi.fn(() => saved), ignoredSave = vi.fn(async () => 'should not run');
        const first = runIslandMilestoneLearningAction(h.actions.run, h.api, { type: 'answer', answer: 1 }, firstSave, 0);
        const ignored = await runIslandMilestoneLearningAction(h.actions.run, h.api,
            type === 'answer' ? { type, answer: 1 } : { type }, ignoredSave, 0);
        expect(firstSave).toHaveBeenCalledTimes(1); expect(ignoredSave).not.toHaveBeenCalled();
        expect(ignored).toEqual({ result: undefined, announce: undefined });
        expect(h.render().milestone).toBe(east);
        finish('committed'); const completed = await first;
        expect(completed.result).toBe('committed'); completed.announce!(west);
        expect(h.render().milestone).toBe(west);
    });
    it('dismisses an admitted help request immediately and an admitted save failure without replaying either', async () => {
        const h = harness(); h.api.receipt()(east); h.render();
        let finish!: (value: string) => void;
        const helpSave = new Promise<string>(resolve => { finish = resolve; });
        const help = runIslandMilestoneLearningAction(h.actions.run, h.api, { type: 'support_opened' }, () => helpSave, 0);
        expect(h.render().milestone).toBeUndefined(); finish('help persisted'); await help;
        h.api.receipt()(west); h.render();
        const failed = await runIslandMilestoneLearningAction(h.actions.run, h.api, { type: 'answer', answer: 1 },
            async () => { throw new Error('save unavailable'); }, 0);
        expect(failed.result).toBeUndefined(); expect(failed.announce).toBeTypeOf('function');
        expect(h.render().milestone).toBeUndefined(); expect(h.actions.error).toContain('ほぞんできなかった');
        expect(vi.getTimerCount()).toBe(0);
    });
});
