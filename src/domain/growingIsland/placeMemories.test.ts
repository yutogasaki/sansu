import { expect, it } from 'vitest';
import { newIsland } from './island';
import { memoryDestination, placeMemories } from './placeMemories';
import { experienceFixture } from '../../prototypes/placeQa/experienceFixture';
import { derivePlaces } from './places';
import type { PlaceUseEvidence } from './placeTypes';

it('shows first family/actor facts without deleting old revisions, and keeps memory when current owners disappear', () => {
    const state = newIsland('memory-projection', 0);
    const fact = (at: number, ruleId: 'P01' | 'P02', revision: string): PlaceUseEvidence => ({ at, ruleId, anchorId: 'tree', memberIds: ['tree'], variant: 'lane', revision, actorId: 'pokomoko', targetId: 'ground' });
    state.placeProgress!.milestones = { P01: fact(10, 'P01', 'one'), P02: fact(20, 'P02', 'two') };
    state.placeProgress!.useHistory = [fact(30, 'P01', 'one'), fact(40, 'P02', 'two')];
    const before = structuredClone(state), memories = placeMemories(state);
    expect(memories).toEqual([{ id: 'grown:grove', kind: 'grown', family: 'grove', at: 10, memberIds: ['tree'], variant: 'lane' }, { id: 'used:grove:pokomoko', kind: 'used', family: 'grove', at: 30, actorId: 'pokomoko', memberIds: ['tree'], variant: 'lane' }]);
    expect(state).toEqual(before);
    state.landmarks = []; expect(placeMemories(state)).toEqual(memories);
});

it('returns only to a usable current place containing original main owners, with stable split selection', () => {
    const state = experienceFixture('forest'), places = derivePlaces(state);
    const grove = places.find(place => place.ruleId === 'P01')!;
    const memory = { id: 'grown:grove', kind: 'grown' as const, family: 'grove' as const, at: 1, memberIds: [...grove.memberIds], variant: grove.variant };
    expect(memoryDestination(memory, places)).toBe(grove.anchorId);
    expect(memoryDestination(memory, places.map(place => ({ ...place, stage: 'connected' })))).toBeUndefined();
    expect(memoryDestination(memory, places.map(place => ({ ...place, useTargets: [] })))).toBeUndefined();
    expect(memoryDestination({ ...memory, memberIds: ['stored-owner'] }, places)).toBeUndefined();
    expect(memoryDestination({ ...memory, memberIds: grove.memberIds.filter(id => !grove.mainIds.includes(id)) }, places)).toBeUndefined();
    const partA = { ...grove, id: 'a', anchorId: 'a-owner', mainIds: grove.mainIds.slice(0, 1) };
    const partB = { ...grove, id: 'b', anchorId: 'b-owner', mainIds: grove.mainIds.slice(1, 3) };
    expect(memoryDestination(memory, [partA, partB])).toBe('b-owner');
    expect(memoryDestination(memory, [partB, { ...partA, mainIds: partB.mainIds }])).toBe('a-owner');
    expect(memory.variant).toBe(grove.variant);
});
