import { describe, expect, it, vi } from 'vitest';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { displayedGatherings } from './gatheringVisibility';
import { GatheringCollector } from './gatheringCollector';
const state = { ...replayLife(newLife('p', 100)), items: [0, 1, 2].map(x => ({ id: `f${x}`, kind: 'flower' as const, cell: { x, z: 2 }, growth: 0, style: 'original' as const })) };
const rules = displayedGatherings(state, 'p');
describe('live gathering collection', () => {
    it('requires actual display, preserves live source and emits once across ordinary refreshes', async () => {
        const presented = vi.fn(), collector = new GatheringCollector('p', presented);
        for (let t = 0; t < 2000; t += 100) collector.sample(state, rules, () => false, t, 10000 + t);
        expect(presented).not.toHaveBeenCalled();
        let t = 2000;
        await vi.waitFor(() => { collector.sample(state, rules, () => true, t, 10000 + t); t += 100; expect(presented).toHaveBeenCalledTimes(1); }, { timeout: 2000, interval: 10 });
        const [event, evidence] = presented.mock.calls[0];
        expect(event.source).toBe('live'); expect(event.snapshot.scene.items).toEqual(state.items); expect(evidence.visibleDurationMs).toBeGreaterThanOrEqual(1000);
        for (let i = 0; i < 30; i++) { t += 100; collector.sample({ ...state, now: t }, rules, () => true, t, 10000 + t); }
        expect(presented).toHaveBeenCalledTimes(1);
    });
    it('does not count pauses or accept an asynchronously prepared scene after removal', async () => {
        const presented = vi.fn(), collector = new GatheringCollector('p', presented);
        collector.sample(state, rules, () => true, 0, 10000); collector.sample(state, [], () => true, 100, 10100);
        await new Promise(resolve => setTimeout(resolve, 20));
        collector.pause(); collector.sample(state, [], () => true, 100000, 110000);
        expect(presented).not.toHaveBeenCalled();
        collector.sample(state, rules, () => true, 100100, 110100); collector.cancel();
        await new Promise(resolve => setTimeout(resolve, 20)); expect(presented).not.toHaveBeenCalled();
    });
});
