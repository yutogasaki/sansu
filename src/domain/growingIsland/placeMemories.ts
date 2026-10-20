import type { DerivedPlace, PlaceFamily, PlaceGoalId } from './placeTypes';
import type { GrowingState } from './types';

const familyOf: Partial<Record<PlaceGoalId, PlaceFamily>> = { P01: 'grove', P02: 'grove', P03: 'spring', P04: 'community', P05: 'flowers' };
export interface PlaceMemory { id: string; kind: 'grown' | 'used' | 'shared'; family: PlaceFamily; at: number; actorId?: string; memberIds: string[]; variant: string }
/** Project first facts from existing history. Never rewrite older raw receipts. */
export function placeMemories(state: GrowingState): PlaceMemory[] {
    const facts: PlaceMemory[] = [];
    for (const fact of Object.values(state.placeProgress?.milestones ?? {})) if (fact && familyOf[fact.ruleId])
        facts.push({ id: `grown:${familyOf[fact.ruleId]}`, kind: 'grown', family: familyOf[fact.ruleId]!, at: fact.at, memberIds: [...fact.memberIds], variant: fact.variant });
    const uses = [...(state.placeProgress?.useHistory ?? []), ...Object.values(state.placeProgress?.uses ?? {}).flatMap(actors => Object.values(actors ?? {}))];
    for (const fact of uses) if (fact && familyOf[fact.ruleId]) facts.push({ id: `used:${familyOf[fact.ruleId]}:${fact.actorId}`, kind: 'used', family: familyOf[fact.ruleId]!, at: fact.at, actorId: fact.actorId, memberIds: [...fact.memberIds], variant: fact.variant });
    for (const fact of state.experience?.shared ?? []) facts.push({ id: `shared:${fact.family}:${fact.actorId}`, kind: 'shared', family: fact.family, at: fact.at, actorId: fact.actorId, memberIds: [...fact.memberIds], variant: fact.variant });
    const first = new Map<string, PlaceMemory>();
    for (const fact of facts.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) if (!first.has(fact.id)) first.set(fact.id, fact);
    return [...first.values()];
}

/** A past snapshot may guide to today's place, but never to a stored owner or an unrelated bench. */
export function memoryDestination(memory: PlaceMemory, places: readonly DerivedPlace[]): string | undefined {
    return places.filter(place => place.family === memory.family && (place.stage === 'grown' || place.stage === 'lived') && place.useTargets.length)
        .map(place => ({ place, matches: place.mainIds.filter(id => memory.memberIds.includes(id)).length }))
        .filter(candidate => candidate.matches > 0)
        .sort((a, b) => b.matches - a.matches || a.place.id.localeCompare(b.place.id))[0]?.place.anchorId;
}
