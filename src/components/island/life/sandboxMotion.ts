import { routeDuration } from '../../../domain/islandLife/walkingSpace';
import * as T from 'three';
import { activityPhase } from '../../../domain/islandLife/activity';
import { type LifeState } from '../../../domain/islandLife/model';
import { smoothArrival } from './residentWalk';
import type { SandScene } from './sandboxGeometry';
export function makeSandboxMotion(sandboxes: Map<string, SandScene>, heads: T.Group[], point: (cell: { x: number; z: number }) => T.Vector3) {
    return (visible: LifeState, now: number, reduced: boolean) => {
        const result = new Map<string, { form: 'mountain' | 'castle'; partnerId?: string; progress: number }>();
        sandboxes.forEach((sand, id) => {
            sand.mountain.visible = sand.castle.visible = false;
            const item = visible.items.find(i => i.id === id && i.cell); if (!item) return;
            const users = visible.residents.filter(r => r.visit?.itemId === id && now < r.visit.end && activityPhase(visible, r, now) === 'sandbox');
            if (!users.length) return;
            const form = users.length > 1 ? 'castle' : 'mountain';
            const start = Math.max(...users.map(r => r.visit!.start + routeDuration(r.visit!.path) + 900));
            const progress = reduced ? 1 : smoothArrival((now - start) / 3500);
            sand[form].visible = true; sand[form].scale.y = .15 + .85 * progress;
            for (const user of users) {
                const index = visible.residents.indexOf(user), head = heads[index];
                const local = head.parent!.worldToLocal(point(item.cell!).add(new T.Vector3(0, .25, 0))).sub(head.position);
                head.rotation.order = 'YXZ'; head.rotation.y = Math.atan2(local.x, local.z);
                head.rotation.x = T.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -.3, .6);
                result.set(user.id, { form, partnerId: users.find(r => r !== user)?.id, progress });
            }
        });
        return result;
    };
}
