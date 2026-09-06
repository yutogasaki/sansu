import { describe, expect, it } from 'vitest';
import { simulateCourse } from '../../../domain/park/simulation';
import type { PartKind } from '../../../domain/park/types';
import { contact, sampleToy, TOY } from './choreography';
import { supportsThreePark } from './config';

const options: (PartKind | null)[] = [null, 'slide', 'trampoline', 'bubble'];
describe('Three.js display contract, independent of learning and persistence', () => {
    it('keeps route endpoints continuous for every supported layout and every permutation', () => {
        for (const a of options) for (const b of options) for (const c of options) {
            const layout = [a, b, c], beats = simulateCourse(layout);
            for (let i = 1; i < beats.length; i++) {
                const previous = sampleToy(layout, beats[i - 1], 1);
                const next = sampleToy(layout, beats[i], 0);
                expect(next.point.x, `${layout}: ${beats[i].action}`).toBeCloseTo(previous.point.x, 5);
                expect(next.point.y, `${layout}: ${beats[i].action}`).toBeCloseTo(previous.point.y, 5);
            }
        }
    });
    it('A skips the actual gate with clearance; B keeps its bubble until physical landing', () => {
        const a: PartKind[] = ['slide', 'trampoline', 'bubble'];
        const jumpA = simulateCourse(a).find(b => b.action === 'jump')!;
        expect(jumpA.skipped).toBe(2);
        const gateX = 2 * TOY.spacing;
        const progress = .23 + .53 * (gateX - TOY.spacing) / (TOY.finish - TOY.spacing);
        const above = sampleToy(a, jumpA, progress);
        expect(above.point.y).toBeGreaterThan(TOY.gateTop + .25);
        expect(above.bubble).toBe(false);
        const b: PartKind[] = ['slide', 'bubble', 'trampoline'];
        const jumpB = simulateCourse(b).find(b => b.action === 'jump')!;
        for (const t of [0, .15, .3, .5, .759]) expect(sampleToy(b, jumpB, t).bubble).toBe(true);
        for (const t of [.76, .83, 1]) expect(sampleToy(b, jumpB, t).bubble).toBe(false);
        expect(sampleToy(b, jumpB, .76).point).toEqual(contact(b, 3));
    });
    it('weak hops stay in place, membrane compression and feet have the same height', () => {
        const layout: (PartKind | null)[] = ['trampoline', 'bubble', null];
        const hop = simulateCourse(layout).find(b => b.action === 'hop')!;
        for (const t of [0, .1, .16, .2, .5, .8, 1]) {
            const frame = sampleToy(layout, hop, t);
            expect(frame.point.x).toBe(0);
            if (frame.contactSlot === 0) expect(frame.point.y).toBeCloseTo(TOY.trampoline - frame.compression);
        }
        expect(sampleToy(layout, hop, .495).point.y).toBeLessThan(.8);
    });
    it('bubble remains at a ground finish and while entering a second gate, even when sampling skips frames', () => {
        const layout: (PartKind | null)[] = ['bubble', 'bubble', null];
        const beats = simulateCourse(layout);
        const gate = beats.find(b => b.action === 'bubble' && b.to === 1)!;
        expect(sampleToy(layout, gate, 0).bubble).toBe(true);
        for (const t of [0, .96, 1, 100]) expect(sampleToy(layout, beats.at(-1), t).bubble).toBe(true);
    });
    it('the simulation still triggers a landed-on part, never the skipped part', () => {
        const beats = simulateCourse(['slide', 'trampoline', 'bubble', 'bubble', 'trampoline', null]);
        expect(beats.filter(b => b.action === 'bubble').map(b => b.to)).toEqual([3]);
        expect(beats.find(b => b.action === 'hop')).toMatchObject({ from: 4, to: 4, popped: true });
    });
    it('preserves larger courses and unsupported saved parts through legacy fallback', () => {
        expect(supportsThreePark(['slide', 'trampoline', null])).toBe(true);
        expect(supportsThreePark(['slide', 'trampoline', null, null, null, null])).toBe(false);
        expect(supportsThreePark(['slide', 'paint', 'trampoline'])).toBe(false);
    });
});
