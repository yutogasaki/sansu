import { Vector3, type Camera } from 'three';
import { benchRelation } from '../../../domain/islandLife/discovery';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { LiveDiscoveryCandidate } from './gatheringCollector';
import type { buildLifeScene } from './scene';
import { visibleRelationObject } from './relationVisibility';

/** Candidates come from the rendered, settled gaze, never placement eligibility alone. */
export function liveRelations(state: LifeState, profileId: string, content: ReturnType<typeof buildLifeScene>, camera: Camera,
    onScreen: (point: Vector3) => boolean): LiveDiscoveryCandidate[] {
    return content.audit().flatMap(pose => {
        if (pose.phase !== 'bench' || !pose.itemId || !pose.relation?.ready) return [];
        const relation = pose.relation, rule = benchRelation(state, profileId, pose.itemId,
            state.relationTarget?.benchId === pose.itemId ? state.relationTarget.targetId : undefined);
        if (!rule || rule.ruleId !== relation.ruleId || !rule.participantIds.includes(relation.targetId)) return [];
        const focalResidentIds = [pose.id, ...(relation.targetResidentId ? [relation.targetResidentId] : [])] as ResidentId[];
        // A free observation visit keeps its test provenance after closing the panel.
        if (focalResidentIds.some(id => state.residents.find(resident => resident.id === id)?.visit?.observationTest)) return [];
        const visits = focalResidentIds.map(id => {
            const visit = state.residents.find(resident => resident.id === id)?.visit;
            return [id, visit?.itemId, visit?.start, visit?.end];
        });
        const target = content.root.getObjectByName(`life-item-${relation.targetId}`);
        const core = Boolean(target && visibleRelationObject(target, content.root, camera, onScreen)
            && focalResidentIds.every(id => {
                const actor = content.root.getObjectByName(`life-resident-${id}`);
                const head = actor?.getObjectByName(id === 'pokomoko' ? 'life-hero-head' : 'resident-head');
                return Boolean(actor && head && visibleRelationObject(actor, content.root, camera, onScreen, head.getWorldPosition(new Vector3())));
            }));
        return [{ rule, key: JSON.stringify([rule.semanticSignature, visits]), core, focalResidentIds }];
    });
}
