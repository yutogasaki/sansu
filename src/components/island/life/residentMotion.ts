import * as T from 'three';
import { makeLifeHeroHead, makeRelationGaze } from './relationGaze';
import type { buildHomeJourney } from '../homeJourney/scene';
import { easeResident, poseResidentTail, RESIDENT_SCALE, residentSeatContactY, sampleResidentStride, turnResidentToward } from '../three/residentRig';
import { isRoamVisit, LIFE_STEP_MS, type Cell, type LifeState } from '../../../domain/islandLife/model';
import { activityPhase, favoriteReactionElapsed, residentReaction } from '../../../domain/islandLife/activity';
import { sampleResidentInterest } from '../three/residentInterest';
import { smoothArrival, turnToward } from './residentWalk';
import { makeLifeStateProjection } from './stateProjection';

export type LifeSeat = { seat: T.Mesh; pivot?: T.Group };
export function makeLifeMotion(content: ReturnType<typeof buildHomeJourney>, state: LifeState,
    point: (cell: Cell) => T.Vector3, seats: Map<string, LifeSeat>) {
    const project = makeLifeStateProjection(state);
    let visible = state, renderedAt = state.now;
    const actors = [content.hero, content.rabbit.pose, content.otter.pose];
    const bodies = [content.heroBody, content.rabbit.body, content.otter.body];
    const heads = [makeLifeHeroHead(content.heroBody), content.rabbit.head, content.otter.head];
    const gaze = makeRelationGaze(state, heads, point);
    const feet = [content.heroFeet, content.rabbit.feet, content.otter.feet];
    const neutralFeet = feet.map(pair => pair.map(foot => foot.position.clone()));
    let audit: { id: string; itemId?: string; phase: string; position: number[]; seatGap?: number; reaction?: string; hop: number; headPitch: number; headRoll: number; headYaw?: number; relation?: ReturnType<ReturnType<typeof makeRelationGaze>> }[] = [];
    return {
        audit: () => audit,
        snapshot: () => ({ ...(state.tourVersion ? visible : state), now: renderedAt }),
        animate(now: number, reduced: boolean, decorationAt = now) {
            if (state.scenePose === 'captured-v1') now = state.now;
            visible = project(now); renderedAt = now;
            heads.forEach(head => { head.rotation.order = 'XYZ'; });
            heads[0].rotation.set(0, 0, 0);
            for (const { pivot } of seats.values()) if (pivot) pivot.rotation.x = 0;
            audit = visible.residents.map((resident, index) => {
                const actor = actors[index], body = bodies[index], visit = resident.visit;
                const item = state.items.find(i => i.id === visit?.itemId && i.cell);
                const phase = activityPhase(state, resident, now);
                const scale = actor.scale.x;
                body.position.y = 0; body.rotation.set(0, 0, 0); actor.rotation.set(0, 0, 0);
                feet[index].forEach((foot, n) => { foot.position.copy(neutralFeet[index][n]); foot.rotation.set(0, 0, 0); });
                const rig = index === 1 ? content.rabbit : index === 2 ? content.otter : undefined;
                if (rig) { rig.head.rotation.set(0, 0, 0); rig.shoulders.forEach(shoulder => { shoulder.rotation.x = 0; }); poseResidentTail(rig.tail, index === 1 ? 'rabbit' : 'otter', 0); }
                let position = point(resident.cell), seatGap: number | undefined, flowerLean = 0;
                if (visit && (item || isRoamVisit(visit))) {
                    const length = visit.path.length - 1;
                    const step = length ? easeResident((now - visit.start) / (length * LIFE_STEP_MS)) * length : 0;
                    const n = Math.min(length, Math.floor(step));
                    const a = point(visit.path[n]), b = point(visit.path[Math.min(n + 1, visit.path.length - 1)]);
                    position = a.clone().lerp(b, step - n);
                    if (a.distanceTo(b) > .01) {
                        const heading = Math.atan2(b.x - a.x, b.z - a.z);
                        const previous = point(visit.path[Math.max(0, n - 1)]);
                        const from = n > 0 ? Math.atan2(a.x - previous.x, a.z - previous.z) : 0;
                        actor.rotation.y = reduced ? heading : turnResidentToward(from, heading, (step - n) * LIFE_STEP_MS);
                        if (!reduced) {
                            const stride = sampleResidentStride(step * RESIDENT_SCALE / scale, length * RESIDENT_SCALE / scale);
                            body.position.y = stride.bob;
                            feet[index].forEach((foot, f) => {
                                foot.position.y += stride.feet[f].lift;
                                foot.position.z += stride.feet[f].z - .12;
                            });
                            rig?.shoulders.forEach((shoulder, f) => { shoulder.rotation.x = stride.feet[f].arm; });
                        }
                    } else if (item) {
                        const target = point(item.cell!), walkedAt = visit.start + (visit.path.length - 1) * LIFE_STEP_MS;
                        const duration = item.kind === 'flower' ? 400 : 900;
                        const settling = smoothArrival((now - walkedAt) / duration);
                        const previous = point(visit.path[Math.max(0, visit.path.length - 2)]);
                        const heading = previous.distanceTo(position) > .01
                            ? Math.atan2(position.x - previous.x, position.z - previous.z) : 0;
                        if (item.kind === 'flower' || item.kind === 'water-bowl') {
                            const facing = Math.atan2(target.x - position.x, target.z - position.z);
                            actor.rotation.y = reduced ? facing : turnToward(heading, facing, (now - walkedAt) / duration);
                            position.lerp(target, (item.kind === 'water-bowl' ? .38 : .48) * settling);
                            body.rotation.x = (.18 + (reduced ? 0 : Math.sin((now - walkedAt) / 950) * .045)) * settling;
                            flowerLean = settling;
                        } else if (item.kind === 'sapling') {
                            const facing = Math.atan2(target.x - position.x, target.z - position.z);
                            actor.rotation.y = reduced ? facing : turnToward(heading, facing, (now - walkedAt) / duration);
                        } else {
                            actor.rotation.y = reduced ? 0 : turnToward(heading, 0, (now - walkedAt) / duration);
                            const furniture = seats.get(item.id);
                            if (furniture) {
                                const usingMs = Math.max(0, now - walkedAt - duration);
                                const angle = item.kind === 'swing' && !reduced ? Math.sin((usingMs + decorationAt - now) / 1250) * .18 * Math.min(1, usingMs / 500) : 0;
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
                    } else if (isRoamVisit(visit) && visit.path.length > 1) {
                        const previous = point(visit.path[visit.path.length - 2]);
                        actor.rotation.y = Math.atan2(position.x - previous.x, position.z - previous.z);
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
                        rig.head.rotation.z = Math.sin(decorationAt / 1800 + index) * .035;
                    }
                    if (flowerLean > 0) {
                        // The muzzle lowers as the feet settle, then makes two
                        // small sniffs during the existing favorite reply.
                        const sniff = elapsed === undefined || reduced ? 0
                            : Math.sin(Math.min(1, elapsed / 1200) * Math.PI * 4)
                                * Math.sin(Math.min(1, elapsed / 1200) * Math.PI) * .045;
                        rig.head.rotation.x += (.09 + sniff) * flowerLean;
                    }
                }
                const scarf = content.hero.getObjectByName('life-scarf');
                if (index === 0 && scarf) scarf.position.y = .59 + body.position.y;
                return { id: resident.id, itemId: visit?.itemId, phase, position: actor.position.toArray(), seatGap, reaction: reaction?.symbol, hop,
                    headPitch: rig?.head.rotation.x ?? 0, headRoll: rig?.head.rotation.z ?? 0 };
            });
            content.world.updateMatrixWorld(true);
            audit.forEach((pose, index) => {
                pose.relation = gaze(visible, now, reduced, index);
                pose.headYaw = heads[index].rotation.y;
                pose.headPitch = heads[index].rotation.x;
            });
        },
    };
}
