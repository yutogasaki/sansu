import * as T from 'three';
import { visitRelation } from '../../../domain/islandLife/discovery';
import { activityPhase } from '../../../domain/islandLife/activity';
import { LIFE_STEP_MS, type LifeItem, type LifeState, type Visit } from '../../../domain/islandLife/model';
import { smoothArrival } from './residentWalk';
import type { LifeSeat } from './residentMotion';

export const picnicRole = (item: LifeItem, visit: Visit) => visit.path[visit.path.length - 1].z < item.cell!.z ? 1 : 0;
/** Opposite approaches reserve separate physical seats. Only the current users'
 * plates appear; the existing resident rigs keep their own faces and clothes. */
export function makePicnicMotion(state: LifeState, heads: T.Group[], seats: Map<string, LifeSeat>, point: (cell: { x: number; z: number }) => T.Vector3) {
    const relations = new Map<string, ReturnType<typeof visitRelation>>();
    const relationFor = (visit: Visit) => {
        const key = JSON.stringify([visit.itemId, visit.start, visit.relationTargetId, visit.relationSelectionVersion]);
        if (!relations.has(key)) relations.set(key, visitRelation(state, '', visit));
        return relations.get(key);
    };
    const tree = (item: LifeItem, visit: Visit) => state.items.find(i => i.id !== item.id && relationFor(visit)?.participantIds.includes(i.id));
    return {
        clear() { seats.forEach(seat => seat.picnic?.snacks.forEach(snack => { snack.visible = false; })); },
        facing(item: LifeItem, visit: Visit) {
            const neutral = picnicRole(item, visit) ? 0 : Math.PI, target = tree(item, visit);
            if (!target?.cell) return neutral;
            const p = point(item.cell!), t = point(target.cell), toward = Math.atan2(t.x - p.x, t.z - p.z);
            return neutral + T.MathUtils.clamp(Math.atan2(Math.sin(toward - neutral), Math.cos(toward - neutral)), -.35, .35);
        },
        finish(visible: LifeState, now: number, index: number, reduced: boolean) {
            const resident = visible.residents[index], visit = resident.visit;
            if (!visit || now >= visit.end || activityPhase(visible, resident, now) !== 'picnic-table') return;
            const item = state.items.find(i => i.id === visit.itemId && i.cell); if (!item) return;
            const role = picnicRole(item, visit), furniture = seats.get(item.id)?.picnic;
            if (furniture) furniture.snacks[role].visible = true;
            const partner = visible.residents.findIndex((r, i) => i !== index && r.visit?.itemId === item.id && now < r.visit.end
                && activityPhase(visible, r, now) === 'picnic-table');
            const target = tree(item, visit), relation = relationFor(visit);
            const focus = partner >= 0 ? heads[partner].getWorldPosition(new T.Vector3())
                : target?.cell ? point(target.cell).add(new T.Vector3(0, .7, 0)) : point(item.cell!).add(new T.Vector3(0, .55, 0));
            const head = heads[index], local = head.parent!.worldToLocal(focus.clone()).sub(head.position);
            const blend = reduced ? 1 : smoothArrival((now - visit.start - (visit.path.length - 1) * LIFE_STEP_MS - 900) / 400);
            head.rotation.order = 'YXZ'; head.rotation.y = Math.atan2(local.x, local.z) * blend;
            head.rotation.x = T.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.45, .55) * blend;
            return { role, partnerId: partner >= 0 ? visible.residents[partner].id : undefined,
                relation: relation && target ? { ruleId: relation.ruleId, targetId: target.id,
                    targetResidentId: partner >= 0 ? visible.residents[partner].id : undefined, focus: focus.toArray(), ready: blend === 1 } : undefined };
        },
    };
}
