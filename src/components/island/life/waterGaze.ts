import * as T from 'three';
import { extendedGatherings } from '../../../domain/islandLife/extendedGatherings';
import { LIFE_STEP_MS, type Cell, type LifeState } from '../../../domain/islandLife/model';
import { smoothArrival } from './residentWalk';

/** Compare adjacent bowls with the existing head rig; feet and body keep using
 * the original bowl. Reduced motion holds the neighboring surface in view. */
export function makeWaterGaze(state: LifeState, heads: T.Group[], point: (cell: Cell) => T.Vector3) {
    const neighbors = new Map(extendedGatherings(state).filter(group => group.kind === 'water').flatMap(group => group.items.map(item => {
        const next = group.items.filter(other => other.id !== item.id && Math.abs(other.cell!.x - item.cell!.x) + Math.abs(other.cell!.z - item.cell!.z) === 1)
            .sort((a, b) => a.cell!.z - b.cell!.z || a.cell!.x - b.cell!.x || a.id.localeCompare(b.id))[0];
        return [item.id, { item, next }] as const;
    })));
    return (visible: LifeState, now: number, reduced: boolean, index: number) => {
        const head = heads[index]; delete head.userData.waterLook;
        const visit = visible.residents[index].visit, pair = visit && neighbors.get(visit.itemId);
        if (!visit || !pair?.next || now >= visit.end) return;
        const elapsed = now - visit.start - (visit.path.length - 1) * LIFE_STEP_MS - 900;
        if (elapsed < 0) return;
        const other = reduced || Math.floor(elapsed / 3200) % 2 === 1, phase = elapsed % 3200;
        const blend = reduced ? 1 : smoothArrival(phase / 600);
        const current = other ? pair.next : pair.item, prior = !reduced && elapsed < 3200 ? pair.item : other ? pair.item : pair.next;
        const captured = state.scenePose === 'captured-v1' ? state.waterFocus?.find(focus => focus.residentId === visible.residents[index].id && focus.itemId === visit.itemId) : undefined;
        const focus = captured ? new T.Vector3().fromArray(captured.focus) : point(prior.cell!).lerp(point(current.cell!), blend).add(new T.Vector3(0, .23, 0));
        const local = head.parent!.worldToLocal(focus.clone()).sub(head.position);
        head.rotation.order = 'YXZ'; head.rotation.y = Math.atan2(local.x, local.z);
        head.rotation.x = T.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.45, .55);
        const audit = { itemId: pair.item.id, targetId: captured?.targetId ?? current.id, ready: captured?.ready ?? (other && blend === 1), focus: focus.toArray() };
        head.userData.waterLook = audit; return audit;
    };
}
