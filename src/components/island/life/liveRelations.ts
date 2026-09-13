import { facilityRelations } from './facilityRelations';
import { Vector3, type Camera } from 'three';
import { visitRelation } from '../../../domain/islandLife/discovery';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { LiveDiscoveryCandidate } from './gatheringCollector';
import type { buildLifeScene } from './scene';
import { visibleRelationObject } from './relationVisibility';

/** Candidates come from the rendered, settled gaze, never placement eligibility alone. */
export function liveRelations(state: LifeState, profileId: string, content: ReturnType<typeof buildLifeScene>, camera: Camera,
    onScreen: (point: Vector3) => boolean): LiveDiscoveryCandidate[] {
    return [...facilityRelations(state, profileId, content, camera, onScreen), ...content.audit().flatMap(pose => {
        if ((pose.phase !== 'bench' && pose.phase !== 'picnic-table') || !pose.itemId || !pose.relation?.ready) return [];
        // Two table partners describe one shared episode, not one per head.
        if (pose.phase === 'picnic-table' && pose.relation.targetResidentId && pose.id > pose.relation.targetResidentId) return [];
        const relation = pose.relation, visit = state.residents.find(r => r.id === pose.id)?.visit;
        const rule = visit ? visitRelation(state, profileId, visit) : undefined;
        if (!rule || rule.ruleId !== relation.ruleId || !rule.participantIds.includes(relation.targetId)) return [];
        const focalResidentIds = [pose.id, ...(relation.targetResidentId ? [relation.targetResidentId] : [])] as ResidentId[];
        // A free observation visit keeps its test provenance after closing the panel.
        if (focalResidentIds.some(id => state.residents.find(resident => resident.id === id)?.visit?.observationTest)) return [];
        if (pose.phase === 'picnic-table') focalResidentIds.sort();
        const visits = focalResidentIds.map(id => {
            const visit = state.residents.find(resident => resident.id === id)?.visit;
            return [id, visit?.itemId, visit?.start, visit?.end];
        });
        const target = content.root.getObjectByName(`life-item-${relation.targetId}`);
        const table = pose.phase === 'picnic-table' ? content.root.getObjectByName(`life-item-${pose.itemId}`) : undefined;
        const snackVisible = pose.phase !== 'picnic-table' || Boolean(table && [1, -1].some(side => {
            const snack = table.getObjectByName(`life-picnic-snack-${side}`);
            return Boolean(snack?.visible && visibleRelationObject(snack, content.root, camera, onScreen));
        }));
        const core = Boolean(snackVisible && target && visibleRelationObject(target, content.root, camera, onScreen)
            && focalResidentIds.every(id => {
                const actor = content.root.getObjectByName(`life-resident-${id}`);
                const head = actor?.getObjectByName(id === 'pokomoko' ? 'life-hero-head' : 'resident-head');
                return Boolean(actor && head && visibleRelationObject(actor, content.root, camera, onScreen, head.getWorldPosition(new Vector3())));
            }));
        return [{ rule, key: JSON.stringify([rule.semanticSignature, visits]), core, focalResidentIds }];
    })];
}
