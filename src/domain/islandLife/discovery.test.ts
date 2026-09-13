import { describe, expect, it } from 'vitest';
import { newLife, type LifeItem } from './model';
import { replayLife } from './simulation';
import { benchRelation, evaluateDiscovery, relationAvailability, relationDistance } from './discovery';

function item(id: string, kind: LifeItem['kind'], x: number, z: number, growth = 0): LifeItem {
    return { id, kind, cell: { x, z }, growth, style: 'original', ...(kind === 'bench' || kind === 'swing' ? { access: 'front' as const } : {}) };
}
function world(items: LifeItem[]) { return { ...replayLife(newLife('p', 100)), items }; }

describe('current discovery conditions, separate from shown scenes', () => {
    it('connects young flowers without creating maturity, and restores the exact condition after splitting', () => {
        const state = world([item('a', 'flower', 0, 2), item('b', 'flower', 1, 2), item('c', 'flower', 2, 2)]);
        const before = structuredClone(state);
        const rules = evaluateDiscovery(state, 'p');
        expect(rules.filter(rule => rule.ruleId === 'G0')).toHaveLength(1);
        expect(rules.some(rule => rule.ruleId === 'GF3')).toBe(false);
        expect(state).toEqual(before);
        state.items[2].cell = { x: 5, z: 3 };
        expect(evaluateDiscovery(state, 'p').some(rule => rule.ruleId === 'G0')).toBe(false);
        state.items[2].cell = before.items[2].cell;
        expect(evaluateDiscovery(state, 'p')).toEqual(rules);
    });
    it('does not connect diagonals or bridge a component with another kind or a stored plant', () => {
        const state = world([item('a', 'flower', 0, 2), item('b', 'flower', 1, 3), item('c', 'flower', 2, 3), item('water', 'lantern', 1, 2)]);
        expect(evaluateDiscovery(state, 'p').some(rule => rule.ruleId === 'G0')).toBe(false);
        state.items[0].cell = undefined;
        expect(evaluateDiscovery(state, 'p').filter(rule => rule.ruleId === 'M2')).toHaveLength(2);
    });
    it('retains lower conditions alongside a six-flower field and requires width and depth', () => {
        const state = world(Array.from({ length: 6 }, (_, i) => item(`f${i}`, 'flower', i % 3, 2 + Math.floor(i / 3), 6)));
        expect(evaluateDiscovery(state, 'p').filter(rule => rule.ruleId.startsWith('G')).map(rule => rule.ruleId).sort()).toEqual(['G0', 'GF3', 'GF6']);
        state.items.forEach((flower, i) => { flower.cell = { x: i, z: 2 }; });
        expect(evaluateDiscovery(state, 'p').some(rule => rule.ruleId === 'GF6')).toBe(false);
        state.items.forEach(flower => { flower.kind = 'swing'; });
        expect(evaluateDiscovery(state, 'p').filter(rule => rule.ruleId.startsWith('GP')).map(rule => rule.ruleId)).toEqual(['GP2', 'GP3']);
    });
    it('keeps signatures stable across item ordering, money, clock, styles, and unrelated resident state', () => {
        const state = world([item('f', 'flower', 0, 2), item('b', 'bench', 1, 2)]);
        const first = evaluateDiscovery(state, 'p');
        state.items.reverse(); state.now += 30000; state.drops += 900; state.items[0].style = 'sunshine';
        state.residents[0].enjoyed += 10;
        expect(evaluateDiscovery(state, 'p')).toEqual(first);
        expect(evaluateDiscovery(state, 'another')).not.toEqual(first);
        state.items.find(i => i.id === 'f')!.growth = 6;
        expect(evaluateDiscovery(state, 'p').find(r => r.ruleId === 'M2')!.semanticSignature).not.toBe(first.find(r => r.ruleId === 'M2')!.semanticSignature);
    });
    it('uses walking distance and rejects a near object behind an impassable wall', () => {
        const a = item('b', 'bench', 0, 2), b = item('f', 'flower', 4, 2);
        const state = world([a, b]);
        expect(relationDistance(state, a, b)).toBe(4);
        expect(benchRelation(state, 'p', 'b')?.ruleId).toBe('R1');
        state.items.push(...Array.from({ length: 5 }, (_, z) => item(`wall${z}`, 'lantern', 3, z)));
        expect(relationDistance(state, a, b)).toBeUndefined();
        expect(benchRelation(state, 'p', 'b')).toBeUndefined();
    });
    it('selects a deterministic nearest relation and lets the actual touched object select another', () => {
        const state = world([item('b', 'bench', 2, 2), item('f', 'flower', 1, 2), item('s', 'swing', 3, 2)]);
        expect(benchRelation(state, 'p', 'b')?.ruleId).toBe('R1');
        expect(benchRelation(state, 'p', 'b', 's')?.ruleId).toBe('R3');
        const rule = benchRelation(state, 'p', 'b')!;
        expect(relationAvailability(state, rule)).toBe('eligible');
        state.residents.forEach(resident => { resident.visit = { itemId: 's', start: 100, end: 10000, from: resident.cell, path: [resident.cell] }; });
        expect(benchRelation(state, 'p', 'b')).toEqual(rule);
        expect(relationAvailability(state, rule)).toBe('waiting-for-resident');
        state.residents[0].visit = { itemId: 'b', start: 100, end: 10000, from: { x: 2, z: 3 }, path: [{ x: 2, z: 3 }] };
        expect(relationAvailability(state, rule)).toBe('active');
    });
});
