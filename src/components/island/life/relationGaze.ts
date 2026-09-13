import { routeDuration } from '../../../domain/islandLife/walkingSpace';
import * as T from 'three';
import { visitRelation } from '../../../domain/islandLife/discovery';
import { growthStage, type LifeState } from '../../../domain/islandLife/model';
import { activityPhase } from '../../../domain/islandLife/activity';
import { smoothArrival } from './residentWalk';

/** The existing patchwork head, face and ears become one pivot. Their neutral
 * positions and materials remain identical; body, arms and feet stay on the seat. */
export function makeLifeHeroHead(body: T.Group) {
    const head = new T.Group(); head.name = 'life-hero-head'; head.position.y = .68;
    const parts = body.children.filter(part => part.position.y >= .7);
    body.add(head);
    for (const part of parts) { part.position.y -= head.position.y; head.add(part); }
    return head;
}

export function makeRelationGaze(state: LifeState, heads: T.Group[], point: (cell: { x: number; z: number }) => T.Vector3) {
    const relations = new Map<string, ReturnType<typeof visitRelation>>();
    return (visible: LifeState, now: number, reduced: boolean, index: number) => {
        const resident = visible.residents[index], visit = resident.visit;
        if (!visit || now >= visit.end || activityPhase(state, resident, now) !== 'bench') return;
        const key = JSON.stringify([visit.itemId, visit.start, visit.relationTargetId, visit.relationSelectionVersion]);
        if (!relations.has(key)) relations.set(key, visitRelation(visible, '', visit));
        const relation = relations.get(key); if (!relation) return;
        const target = state.items.find(item => relation.participantIds.includes(item.id) && item.id !== visit.itemId && item.cell);
        if (!target?.cell) return;
        const other = relation.ruleId === 'R3' ? visible.residents.findIndex(other => other.id !== resident.id
            && other.visit?.itemId === target.id && now < other.visit.end && ['swing', 'sandbox'].includes(activityPhase(state, other, now))) : -1;
        const focus = other >= 0 ? heads[other].getWorldPosition(new T.Vector3())
            : point(target.cell).add(new T.Vector3(0, target.kind === 'flower' ? [ .16, .32, .49 ][growthStage(target)] : target.kind === 'water-bowl' ? .23 : .7, 0));
        const head = heads[index];
        const local = head.parent!.worldToLocal(focus.clone()).sub(head.position);
        const settledAt = visit.start + routeDuration(visit.path) + 900;
        const blend = reduced ? 1 : smoothArrival((now - settledAt) / 500);
        head.rotation.order = 'YXZ';
        head.rotation.y = Math.atan2(local.x, local.z) * blend;
        head.rotation.x += T.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.45, .55) * blend;
        return { ruleId: relation.ruleId, targetId: target.id, targetResidentId: other >= 0 ? visible.residents[other].id : undefined,
            focus: focus.toArray(), ready: blend === 1 };
    };
}
