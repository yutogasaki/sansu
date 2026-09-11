import * as T from 'three';
import type { buildHomeJourney } from '../homeJourney/scene';
import { poseResidentTail, residentSeatContactY } from '../three/residentRig';
import { LIFE_STEP_MS, type Cell, type LifeState } from '../../../domain/islandLife/model';
import { activityPhase, favoriteReactionElapsed, residentReaction } from '../../../domain/islandLife/activity';
import { sampleResidentInterest } from '../three/residentInterest';

export type LifeSeat = { seat: T.Mesh; pivot?: T.Group };
export function makeLifeMotion(content: ReturnType<typeof buildHomeJourney>, state: LifeState,
    point: (cell: Cell) => T.Vector3, seats: Map<string, LifeSeat>) {
    const actors = [content.hero, content.rabbit.pose, content.otter.pose];
    const bodies = [content.heroBody, content.rabbit.body, content.otter.body];
    const feet = [content.heroFeet, content.rabbit.feet, content.otter.feet];
    const neutralFeet = feet.map(pair => pair.map(foot => foot.position.clone()));
    let audit: { id: string; itemId?: string; phase: string; position: number[]; seatGap?: number; reaction?: string; hop: number; headPitch: number; headRoll: number }[] = [];
    return {
        audit: () => audit,
        animate(now: number, reduced: boolean) {
            for (const { pivot } of seats.values()) if (pivot) pivot.rotation.x = 0;
            audit = state.residents.map((resident, index) => {
                const actor = actors[index], body = bodies[index], visit = resident.visit;
                const item = state.items.find(i => i.id === visit?.itemId && i.cell);
                const phase = activityPhase(state, resident, now);
                const scale = actor.scale.x;
                body.position.y = 0; body.rotation.set(0, 0, 0); actor.rotation.set(0, 0, 0);
                feet[index].forEach((foot, n) => { foot.position.copy(neutralFeet[index][n]); foot.rotation.set(0, 0, 0); });
                const rig = index === 1 ? content.rabbit : index === 2 ? content.otter : undefined;
                if (rig) { rig.head.rotation.set(0, 0, 0); poseResidentTail(rig.tail, index === 1 ? 'rabbit' : 'otter', 0); }
                let position = point(resident.cell), seatGap: number | undefined;
                if (visit && item) {
                    const step = Math.max(0, (now - visit.start) / LIFE_STEP_MS), n = Math.min(visit.path.length - 1, Math.floor(step));
                    const a = point(visit.path[n]), b = point(visit.path[Math.min(n + 1, visit.path.length - 1)]);
                    position = a.clone().lerp(b, step - Math.floor(step));
                    if (a.distanceTo(b) > .01) {
                        actor.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
                        if (!reduced) feet[index].forEach((foot, f) => {
                            const stride = Math.sin(step * Math.PI * 2 + f * Math.PI);
                            foot.position.y += Math.max(0, stride) * .07;
                            foot.position.z += stride * .08;
                        });
                    } else {
                        const target = point(item.cell!), walkedAt = visit.start + (visit.path.length - 1) * LIFE_STEP_MS;
                        const duration = item.kind === 'flower' ? 400 : 900;
                        const settling = Math.max(0, Math.min(1, (now - walkedAt) / duration));
                        if (item.kind === 'flower') {
                            actor.rotation.y = Math.atan2(target.x - position.x, target.z - position.z);
                            position.lerp(target, .48 * settling);
                            body.rotation.x = (.18 + (reduced ? 0 : Math.sin((now - walkedAt) / 950) * .045)) * settling;
                        } else {
                            const furniture = seats.get(item.id);
                            if (furniture) {
                                const usingMs = Math.max(0, now - walkedAt - duration);
                                const angle = item.kind === 'swing' && !reduced ? Math.sin(usingMs / 1250) * .18 * Math.min(1, usingMs / 500) : 0;
                                if (furniture.pivot) furniture.pivot.rotation.x = angle;
                                body.position.y = -.08 * settling;
                                actor.rotation.x = angle;
                                if (rig) poseResidentTail(rig.tail, index === 1 ? 'rabbit' : 'otter', settling);
                                feet[index].forEach((foot, f) => {
                                    foot.position.lerp(new T.Vector3(neutralFeet[index][f].x, -.06, .3), settling);
                                    foot.rotation.x = -.6 * settling;
                                });
                                content.world.updateMatrixWorld(true);
                                const top = furniture.seat.localToWorld(new T.Vector3(0, .05, 0));
                                const contactY = index === 0 ? .05 : residentSeatContactY(index === 1 ? 'rabbit' : 'otter');
                                const offset = new T.Vector3(0, contactY * scale, 0).applyEuler(actor.rotation);
                                const seated = top.clone().sub(offset);
                                position.lerp(seated, settling);
                                actor.position.copy(position); actor.updateMatrixWorld(true);
                                if (settling === 1) seatGap = new T.Vector3(0, contactY, 0).applyMatrix4(actor.matrixWorld).distanceTo(top);
                            }
                        }
                    }
                }
                const reaction = residentReaction(state, resident, now), hop = reduced ? 0 : reaction?.hop ?? 0;
                position.y += hop;
                actor.position.copy(position);
                if (rig) {
                    const elapsed = reaction?.symbol === '♪' ? favoriteReactionElapsed(state, resident, now) : undefined;
                    const interest = elapsed === undefined ? undefined
                        : sampleResidentInterest(index === 1 ? 'rabbit' : 'otter', elapsed / 2400, reduced);
                    if (interest) {
                        rig.head.rotation.x = interest.headPitch;
                        rig.head.rotation.z = interest.headRoll;
                    } else if (!reduced && phase !== 'walking') {
                        rig.head.rotation.z = Math.sin(now / 1800 + index) * .035;
                    }
                }
                const scarf = content.hero.getObjectByName('life-scarf');
                if (index === 0 && scarf) scarf.position.y = .59 + body.position.y;
                return { id: resident.id, itemId: visit?.itemId, phase, position: actor.position.toArray(), seatGap, reaction: reaction?.symbol, hop,
                    headPitch: rig?.head.rotation.x ?? 0, headRoll: rig?.head.rotation.z ?? 0 };
            });
        },
    };
}
