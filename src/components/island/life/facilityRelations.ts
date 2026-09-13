import { Vector3, type Camera } from 'three';
import { discoveryAccessPoints, evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { sameCell } from '../../../domain/islandLife/space';
import type { LifeState } from '../../../domain/islandLife/model';
import type { LiveDiscoveryCandidate } from './gatheringCollector';
import type { buildLifeScene } from './scene';
import { visibleRelationObject } from './relationVisibility';

/** A destination alone is not R5/R6: retain the actual carrier, origin, route,
 * held object and settled use. The same check supports live and test views;
 * callers keep their provenance separate. */
export function facilityRelations(state: LifeState, profileId: string, content: ReturnType<typeof buildLifeScene>, camera: Camera,
    onScreen: (point: Vector3) => boolean, includeTests = false): LiveDiscoveryCandidate[] {
    if (!state.facilityTripVersion || !state.residents.some(r => r.facilityTrip?.phase === 'carry')) return [];
    const rules = evaluateDiscovery(state, profileId).filter(r => r.ruleId === 'R5' || r.ruleId === 'R6');
    return content.audit().flatMap(pose => {
        const resident = state.residents.find(r => r.id === pose.id), trip = resident?.facilityTrip, visit = resident?.visit;
        if (!resident || !trip || !visit || trip.phase !== 'carry' || !pose.facilityUse || pose.facilityUse.action === 'carrying'
            || pose.facilityUse.kind !== trip.kind || visit.itemId !== trip.targetId || pose.itemId !== trip.targetId
            || state.now >= visit.end || visit.observationTest && !includeTests) return [];
        const facility = state.items.find(i => i.id === trip.facilityId && i.cell && i.kind === trip.kind);
        if (!facility || !discoveryAccessPoints(state, facility).some(p => sameCell(p, visit.from))
            || JSON.stringify(visit.path) !== JSON.stringify(trip.path)) return [];
        const rule = rules.find(r => r.ruleId === (trip.kind === 'library' ? 'R5' : 'R6')
            && r.participantIds.includes(trip.facilityId) && r.participantIds.includes(trip.targetId));
        if (!rule) return [];
        const actor = content.root.getObjectByName(`life-resident-${resident.id}`);
        const head = actor?.getObjectByName(resident.id === 'pokomoko' ? 'life-hero-head' : 'resident-head');
        const held = actor?.getObjectByName(trip.kind === 'library' ? 'life-held-book' : 'life-held-tools');
        const origin = content.root.getObjectByName(`life-item-${trip.facilityId}`), target = content.root.getObjectByName(`life-item-${trip.targetId}`);
        const core = Boolean(actor && head && held?.visible && origin && target
            && visibleRelationObject(actor, content.root, camera, onScreen, head.getWorldPosition(new Vector3()))
            && [held, origin, target].every(object => visibleRelationObject(object, content.root, camera, onScreen)));
        return [{ rule, key: JSON.stringify([rule.semanticSignature, resident.id, trip.facilityId, visit.start, visit.end]), core, focalResidentIds: [resident.id] }];
    });
}
