import * as T from 'three';
import type { LifeState } from '../../../domain/islandLife/model';
import { smoothArrival } from './residentWalk';

/** A passing glance has no furniture seat, visit, reward or discovery rule. */
export function makeWindGaze(state: LifeState, heads: T.Group[], point: (cell: { x: number; z: number }) => T.Vector3) {
    const wheels = state.items.filter(i => i.kind === 'pinwheel' && i.cell);
    return (now: number, reduced: boolean, index: number, phase: string) => {
        if (!['home', 'roaming', 'walking', 'waiting'].includes(phase)) return;
        const head = heads[index], origin = head.getWorldPosition(new T.Vector3());
        const nearest = wheels.map(item => ({ item, focus: point(item.cell!).add(new T.Vector3(0, 1.15, .025)) }))
            .filter(({ focus }) => Math.hypot(focus.x - origin.x, focus.z - origin.z) <= 1.8)
            .map(target => ({ ...target, local: head.parent!.worldToLocal(target.focus.clone()).sub(head.position) }))
            .filter(({ local }) => Math.abs(Math.atan2(local.x, local.z)) < 1)
            .sort((a, b) => a.focus.distanceToSquared(origin) - b.focus.distanceToSquared(origin) || a.item.id.localeCompare(b.item.id))[0];
        if (!nearest) return;
        const time = ((now % 12000) + 12000) % 12000;
        const blend = reduced ? 1 : time < 300 ? smoothArrival(time / 300) : time < 2900 ? 1 : time < 3200 ? smoothArrival((3200 - time) / 300) : 0;
        if (!blend) return;
        const { local } = nearest; head.rotation.order = 'YXZ';
        head.rotation.y = Math.atan2(local.x, local.z) * blend;
        head.rotation.x = T.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.6, .25) * blend;
        return { itemId: nearest.item.id, focus: nearest.focus.toArray(), ready: blend === 1 };
    };
}
