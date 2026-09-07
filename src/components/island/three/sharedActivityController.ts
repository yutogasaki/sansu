import * as THREE from 'three';
import { getFurnitureAnchors } from './furnitureVisuals';
import type { IslandResident } from './animals';
import type { SharedActivityPlan } from './sharedActivities';
import type { SharedActivityVisuals } from './sharedActivityVisuals';
import type { IslandStageItem } from './types';

type Phase = 'receiver-walk' | 'gather-walk' | 'gather' | 'carry' | 'share' | 'enjoy' | 'settled';
export type SharedActivityHands = { carrier: 'left' | 'right'; receiver: 'left' | 'right' };
export const SHARED_ACTIVITY_TIMING = { gather: 650, share: 1100, enjoy: 1200 } as const;
const CAPTIONS = {
    flower: ['おはなを おすそわけ', 'いっしょに くんくん'],
    star: ['ほしの ひかりを おすそわけ', 'ふたりで きらり'],
    bubble: ['みずたまを おすそわけ', 'みずたま、ふわり'],
} as const;
const OBJECT_NAMES = { flower: 'おはな', star: 'ほしの ひかり', bubble: 'みずたま' } as const;

/** A transient, sequential visit. Delivery is fixed before the first pickup
 * frame; cancellation preserves actual ground positions and legitimate seats. */
export class SharedActivityController {
    private current?: { plan: SharedActivityPlan; phase: Phase; startedAt: number; activityStartedAt: number; reduced: boolean;
        items: IslandStageItem[]; completedSets: number; hands: SharedActivityHands; presentationChosen: boolean; lastUpdatedAt: number };
    private readonly source = new THREE.Vector3();
    private readonly carrierHand = new THREE.Vector3();
    private readonly receiverHand = new THREE.Vector3();
    private readonly carryTarget = new THREE.Vector3();
    private readonly enjoyTarget = new THREE.Vector3();
    private readonly offerTarget = new THREE.Vector3();
    private readonly holdRotation = new THREE.Euler();
    private readonly holdQuaternion = new THREE.Quaternion();

    constructor(private readonly residents: IslandResident[], private readonly visuals: SharedActivityVisuals,
        private readonly caption: (text: string) => void) {}

    get plan() { return this.current?.plan; }
    get phase() { return this.current?.phase; }
    get active() { return Boolean(this.current && this.current.phase !== 'settled'); }
    get presentationHands() { return this.current?.presentationChosen ? { ...this.current.hands } : undefined; }
    /** The view chooses once before the first pickup frame. Resizes and later
     * phases retain those same physical paws throughout the activity. */
    setPresentationHands(hands: SharedActivityHands) {
        return this.setPresentation(this.current?.plan, hands);
    }
    /** A legal alternative may replace only the not-yet-started delivery leg.
     * Reduced motion must choose its plan before start has moved anyone. */
    setPresentation(plan: SharedActivityPlan | undefined, hands: SharedActivityHands) {
        return this.applyPresentation(plan, hands, false);
    }
    /** A preference change may finish pending walks on the next update. Lock
     * their still-unstarted delivery first, without moving either actor here. */
    prepareReducedPresentation(plan: SharedActivityPlan, hands: SharedActivityHands) {
        const current = this.current;
        if (!current || current.reduced || !['receiver-walk', 'gather-walk'].includes(current.phase)) return false;
        return this.applyPresentation(plan, hands, true);
    }
    private applyPresentation(plan: SharedActivityPlan | undefined, hands: SharedActivityHands, beforeReduced: boolean) {
        const current = this.current;
        if (!current || !plan || current.presentationChosen || (!beforeReduced && !current.reduced
            && (current.phase !== 'gather' || current.lastUpdatedAt !== current.startedAt))) return false;
        const previous = current.plan;
        if (plan !== previous && (current.reduced || plan.pairId !== previous.pairId || plan.kind !== previous.kind
            || plan.selectedItemId !== previous.selectedItemId || plan.source !== previous.source || plan.seat !== previous.seat
            || plan.carrier !== previous.carrier || plan.receiver !== previous.receiver
            || plan.receiverRoute !== previous.receiverRoute || plan.gatherRoute !== previous.gatherRoute)) return false;
        current.plan = plan;
        current.hands = { ...hands }; current.presentationChosen = true;
        return true;
    }
    continuesFor(itemId: string) {
        return this.active && (this.plan?.source.id === itemId || this.plan?.seat.id === itemId);
    }

    start(plan: SharedActivityPlan, now: number, reduced: boolean, items: IslandStageItem[], completedSets: number,
        hands?: SharedActivityHands) {
        this.cancel(now);
        // Preflight assumed everyone else stayed at these actual positions.
        this.residents.forEach(resident => resident.stopWalking(now));
        this.current = { plan, phase: 'receiver-walk', startedAt: now, activityStartedAt: now, reduced, items, completedSets,
            hands: { ...(hands ?? { carrier: 'right', receiver: 'left' }) }, presentationChosen: Boolean(hands), lastUpdatedAt: now };
        const receiver = this.residents[plan.receiver];
        if (receiver.itemId !== plan.seat.id || receiver.action === 'walk') {
            if (!receiver.visit(plan.seat, now, reduced, items, completedSets, plan.receiverRoute)) {
                this.cancel(now); return false;
            }
        }
        this.caption(CAPTIONS[plan.kind][0]);
        this.update(now, reduced);
        return true;
    }

    cancel(now: number) {
        if (this.current) for (const index of [this.current.plan.receiver, this.current.plan.carrier]) {
            this.residents[index].stopWalking(now);
            this.residents[index].clearSharedPose();
        }
        this.current = undefined;
        this.visuals.update();
    }

    private holdTarget(resident: IslandResident, hand: 'left' | 'right', out: THREE.Vector3, upright: boolean) {
        out.set(hand === 'left' ? -.55 : .55, .65, .35);
        if (!upright) return resident.body.localToWorld(out);
        // The carrying layer removes the source's forward lean. Construct the
        // same upright body transform without temporarily changing the live rig.
        this.holdRotation.copy(resident.body.rotation); this.holdRotation.x = 0;
        this.holdQuaternion.setFromEuler(this.holdRotation);
        out.multiply(resident.body.scale).applyQuaternion(this.holdQuaternion).add(resident.body.position);
        return resident.body.parent!.localToWorld(out);
    }

    /** Call after the residents' base animation, before furniture motion/render. */
    update(now: number, reduced: boolean) {
        const current = this.current;
        if (!current) return false;
        current.lastUpdatedAt = now;
        const { plan, items, completedSets, hands } = current;
        const carrier = this.residents[plan.carrier], receiver = this.residents[plan.receiver];
        current.reduced = reduced;
        // Reduced motion finishes the same already-preflighted route decisions,
        // in sequence, and renders a static shared outcome on this very frame.
        for (let transitions = 0; transitions < 7; transitions++) {
            const phase = current.phase;
            if (reduced && (phase === 'receiver-walk' || phase === 'gather-walk' || phase === 'carry')) {
                (phase === 'receiver-walk' ? receiver : carrier).update(now + 20000);
            }
            if (phase === 'receiver-walk' && receiver.action !== 'walk') {
                if (!carrier.visit(plan.source, now, reduced, items, completedSets, plan.gatherRoute)) { this.cancel(now); return false; }
                current.phase = 'gather-walk'; current.startedAt = now;
            } else if (phase === 'gather-walk' && carrier.action !== 'walk') {
                current.phase = 'gather'; current.startedAt = now;
                this.caption(`${OBJECT_NAMES[plan.kind]}を そっと てに`);
            } else if (phase === 'gather' && (reduced || now - current.startedAt >= SHARED_ACTIVITY_TIMING.gather)) {
                if (!carrier.walkToPoint(plan.deliveryRoute, now, reduced, completedSets)) { this.cancel(now); return false; }
                current.phase = 'carry'; current.startedAt = now;
                this.caption(`${OBJECT_NAMES[plan.kind]}を ともだちへ`);
            } else if (phase === 'carry' && carrier.action !== 'walk') {
                current.phase = 'share'; current.startedAt = now;
                this.caption('はい、どうぞ');
            } else if (phase === 'share' && (reduced || now - current.startedAt >= SHARED_ACTIVITY_TIMING.share)) {
                current.phase = 'enjoy'; current.startedAt = now;
                receiver.replayUse(now, reduced);
                this.caption(CAPTIONS[plan.kind][1]);
            } else if (phase === 'enjoy' && (reduced || now - current.startedAt >= SHARED_ACTIVITY_TIMING.enjoy)) {
                current.phase = 'settled'; current.startedAt = now;
            } else break;
        }
        const phase = current.phase;
        if (phase === 'receiver-walk' || phase === 'gather-walk') {
            this.visuals.update(); return true;
        }
        const anchor = getFurnitureAnchors(plan.source.kind).light ?? getFurnitureAnchors(plan.source.kind).look;
        const cosine = Math.cos(plan.source.rotation), sine = Math.sin(plan.source.rotation);
        this.source.set(plan.source.position!.x + anchor.x * cosine + anchor.z * sine, anchor.y,
            plan.source.position!.z - anchor.x * sine + anchor.z * cosine);
        carrier.group.updateWorldMatrix(true, true); receiver.group.updateWorldMatrix(true, true);
        this.holdTarget(carrier, hands.carrier, this.carryTarget, true);
        receiver.handAnchor(this.receiverHand, hands.receiver);
        const duration = phase === 'gather' ? SHARED_ACTIVITY_TIMING.gather : phase === 'share' ? SHARED_ACTIVITY_TIMING.share
            : phase === 'enjoy' ? SHARED_ACTIVITY_TIMING.enjoy : 1;
        const progress = phase === 'settled' ? 1 : Math.min(1, (now - current.startedAt) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        const offering = phase === 'share' || phase === 'enjoy' || phase === 'settled';
        const enjoying = phase === 'enjoy' || phase === 'settled';
        this.offerTarget.copy(this.carryTarget).lerp(this.receiverHand, phase === 'share' ? eased : offering ? 1 : 0);
        if (phase === 'gather') this.offerTarget.copy(this.source).lerp(this.carryTarget, eased);
        // Use one joint mode across the handoff boundary; both its target and
        // strength blend continuously. A smooth prop alone cannot hide a hand jump.
        carrier.setSharedPose('offer', phase === 'gather' ? eased : enjoying ? 1 - eased : 1, this.offerTarget, hands.carrier);
        carrier.handAnchor(this.carrierHand, hands.carrier);
        this.holdTarget(receiver, hands.receiver, this.enjoyTarget, false);
        if (plan.kind === 'flower' && phase === 'enjoy') this.enjoyTarget.y += Math.sin(progress * Math.PI * 2) * .10;
        this.offerTarget.copy(this.carrierHand).lerp(this.enjoyTarget, enjoying ? eased : 0);
        receiver.setSharedPose('receive', phase === 'gather' ? .35 * eased : phase === 'carry' ? .35 : phase === 'share' ? .35 + .65 * eased : 1,
            this.offerTarget, hands.receiver);
        receiver.handAnchor(this.receiverHand, hands.receiver);
        this.visuals.update({ kind: plan.kind, phase, progress,
            source: this.source, carrier: this.carrierHand, receiver: this.receiverHand, reduced });
        return phase !== 'settled';
    }

    snapshot() {
        const current = this.current;
        return current ? { kind: current.plan.kind, pairId: current.plan.pairId, phase: current.phase, startedAt: current.startedAt,
            activityStartedAt: current.activityStartedAt,
            sourceId: current.plan.source.id, seatId: current.plan.seat.id, receiver: current.plan.receiver, carrier: current.plan.carrier,
            hands: { ...current.hands },
            reduced: current.reduced, active: this.active, handoffPoint: current.plan.handoffPoint,
            carrierHand: this.carrierHand.toArray(), receiverHand: this.receiverHand.toArray(), prop: this.visuals.snapshot() } : null;
    }
}
