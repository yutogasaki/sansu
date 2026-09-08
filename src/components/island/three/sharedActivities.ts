import type { IslandLandAccess } from '../../../domain/island/catalog';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import { planResidentPointRoute, planResidentRoute, type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export type SharedActivityKind = 'flower' | 'star' | 'bubble';
export interface SharedActivityResident {
    position: GroundPoint;
    visible: boolean;
    itemId?: string;
    departingId?: string;
}
export interface SharedActivityPlan {
    kind: SharedActivityKind;
    pairId: string;
    selectedItemId: string;
    source: IslandStageItem;
    seat: IslandStageItem;
    receiver: number;
    carrier: number;
    receiverRoute: ResidentRoute;
    gatherRoute: ResidentRoute;
    deliveryRoute: ResidentRoute;
    handoffPoint: GroundPoint;
}

/** Ephemeral preference from the immediately preceding settled activity.
 * Routes, hand choices and camera frames are deliberately not retained. */
export interface SharedActivityReplayPreference {
    kind: SharedActivityKind;
    source: IslandStageItem;
    seat: IslandStageItem;
    receiver: number;
    carrier: number;
}

interface ActivityPair {
    kind: SharedActivityKind;
    source: IslandStageItem & { position: GroundPoint };
    seat: IslandStageItem & { position: GroundPoint };
    distance: number;
}
const COMBINATIONS = [
    { kind: 'flower', source: 'flower', seat: 'bench' },
    { kind: 'star', source: 'lantern', seat: 'mushroom' },
    { kind: 'bubble', source: 'fountain', seat: 'swing' },
] as const;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const placed = (item: IslandStageItem): item is IslandStageItem & { position: GroundPoint } => Boolean(item.position);

function matchingPairs(items: readonly IslandStageItem[], selectedId: string): ActivityPair[] {
    const selected = items.find(item => item.id === selectedId);
    if (!selected || !placed(selected)) return [];
    const combination = COMBINATIONS.find(candidate => candidate.source === selected.kind || candidate.seat === selected.kind);
    if (!combination) return [];
    const pairs: ActivityPair[] = [];
    for (const other of items) {
        if (other.id === selectedId || !placed(other)) continue;
        const source: ActivityPair['source'] = selected.kind === combination.source ? selected : other;
        const seat: ActivityPair['seat'] = selected.kind === combination.seat ? selected : other;
        if (source.kind !== combination.source || seat.kind !== combination.seat) continue;
        const d = distance(source.position, seat.position);
        if (!d || d > ISLAND_ITEMS[source.kind].radius + ISLAND_ITEMS[seat.kind].radius + 1.4) continue;
        const facing = (Math.sin(seat.rotation) * (source.position.x - seat.position.x)
            + Math.cos(seat.rotation) * (source.position.z - seat.position.z)) / d;
        if (!Number.isFinite(facing) || facing < .5) continue;
        pairs.push({ kind: combination.kind, source, seat, distance: d });
    }
    return pairs.sort((a, b) => a.distance - b.distance
        || compareId(a.source.id, b.source.id) || compareId(a.seat.id, b.seat.id));
}

function roleOrder(residents: readonly SharedActivityResident[], roundRobin: number[], pair: ActivityPair) {
    return roundRobin.flatMap((receiver, receiverTurn) => roundRobin.filter(carrier => carrier !== receiver)
        .map(carrier => ({ receiver, carrier, receiverTurn, carrierTurn: roundRobin.indexOf(carrier),
            receiverPriority: residents[receiver].itemId === pair.seat.id ? 0 : 1,
            carrierPriority: residents[carrier].itemId === pair.source.id ? 0 : 1,
        }))).sort((a, b) => a.receiverPriority - b.receiverPriority || a.carrierPriority - b.carrierPriority
            || a.receiverTurn - b.receiverTurn || a.carrierTurn - b.carrierTurn);
}

function samePlacement(current: IslandStageItem, previous: IslandStageItem) {
    return current.id === previous.id && current.kind === previous.kind && current.rotation === previous.rotation
        && placed(current) && placed(previous)
        && current.position.x === previous.position.x && current.position.z === previous.position.z;
}

function seatHandoffPoints(seat: ActivityPair['seat']): GroundPoint[] {
    const reach = ISLAND_ITEMS[seat.kind].radius + .54;
    return [0, 35, -35].map(degrees => {
        const angle = seat.rotation + degrees * Math.PI / 180;
        return { x: seat.position.x + Math.sin(angle) * reach, z: seat.position.z + Math.cos(angle) * reach };
    });
}

/** Keep the chosen pair and roles. Only the two remaining existing handoff
 * candidates can change, each with a real delivery preflight from the same
 * source approach around the receiver's seat and every visible third resident. */
export function sharedActivityDeliveryPlans(plan: SharedActivityPlan, items: readonly IslandStageItem[],
    residents: readonly SharedActivityResident[], landAccess: IslandLandAccess): [SharedActivityPlan, ...SharedActivityPlan[]] {
    const plans: [SharedActivityPlan, ...SharedActivityPlan[]] = [plan];
    if (!placed(plan.source) || !placed(plan.seat)) return plans;
    const gatherPoint = plan.gatherRoute.points[plan.gatherRoute.points.length - 1];
    const receiverPoint = plan.receiverRoute.points[plan.receiverRoute.points.length - 1];
    if (!gatherPoint || !receiverPoint) return plans;
    const occupied = [receiverPoint, ...residents.filter((resident, index) => resident.visible
        && index !== plan.carrier && index !== plan.receiver).map(resident => resident.position)];
    for (const handoffPoint of seatHandoffPoints(plan.seat)) {
        if (distance(handoffPoint, plan.handoffPoint) < 1e-8) continue;
        const deliveryRoute = planResidentPointRoute(gatherPoint, handoffPoint, items, landAccess, {
            departingId: plan.source.id, occupied,
            yaw: Math.atan2(receiverPoint.x - handoffPoint.x, receiverPoint.z - handoffPoint.z),
        });
        if (deliveryRoute) plans.push({ ...plan, handoffPoint, deliveryRoute });
    }
    return plans;
}

/** Preflight only: the scene moves neither furniture nor residents unless all
 * three sequential routes succeed. Search is limited to the selected item's
 * matching partners, ordered resident pairs, and three handoff points. */
export function chooseSharedActivity(items: readonly IslandStageItem[], residents: readonly SharedActivityResident[],
    landAccess: IslandLandAccess, selectedId: string, afterIndex = -1,
    previous?: SharedActivityReplayPreference): SharedActivityPlan | undefined {
    const count = residents.length;
    if (count < 2) return undefined;
    const roundRobin = Array.from({ length: count }, (_, i) => (Math.max(-1, afterIndex) + 1 + i) % count)
        .filter(index => residents[index].visible);
    if (roundRobin.length < 2) return undefined;
    const savedItems = [...items];
    const pairs = matchingPairs(items, selectedId);
    const candidates: { pair: ActivityPair; receiver: number; carrier: number }[] = pairs.flatMap(pair =>
        roleOrder(residents, roundRobin, pair).map(({ receiver, carrier }) => ({ pair, receiver, carrier })));
    const replayPair = previous && previous.receiver !== previous.carrier
        && roundRobin.includes(previous.receiver) && roundRobin.includes(previous.carrier)
        ? pairs.find(pair => pair.kind === previous.kind && samePlacement(pair.source, previous.source)
            && samePlacement(pair.seat, previous.seat)) : undefined;
    if (replayPair && previous) {
        const replayIndex = candidates.findIndex(candidate => candidate.pair === replayPair
            && candidate.receiver === previous.receiver && candidate.carrier === previous.carrier);
        if (replayIndex > 0) candidates.unshift(...candidates.splice(replayIndex, 1));
    }
    for (const { pair, receiver, carrier } of candidates) {
        const third = roundRobin.filter(index => index !== receiver && index !== carrier)
            .map(index => residents[index].position);
        const receiverRoute = planResidentRoute(residents[receiver].position, pair.seat, savedItems, landAccess,
                residents[receiver].itemId || residents[receiver].departingId, { occupied: [residents[carrier].position, ...third] });
        if (!receiverRoute) continue;
        const receiverPoint = receiverRoute.points[receiverRoute.points.length - 1];
        const occupied = [receiverPoint, ...third];
        const gatherRoute = planResidentRoute(residents[carrier].position, pair.source, savedItems, landAccess,
                residents[carrier].itemId || residents[carrier].departingId, { occupied });
        if (!gatherRoute) continue;
        const gatherPoint = gatherRoute.points[gatherRoute.points.length - 1];
        for (const handoffPoint of seatHandoffPoints(pair.seat)
            .sort((a, b) => distance(a, pair.source.position) - distance(b, pair.source.position))) {
            const deliveryRoute = planResidentPointRoute(gatherPoint, handoffPoint, savedItems, landAccess, {
                departingId: pair.source.id, occupied,
                yaw: Math.atan2(receiverPoint.x - handoffPoint.x, receiverPoint.z - handoffPoint.z),
            });
            if (deliveryRoute) return {
                kind: pair.kind, pairId: JSON.stringify([pair.kind, pair.source.id, pair.seat.id]), selectedItemId: selectedId,
                source: pair.source, seat: pair.seat, receiver, carrier, receiverRoute, gatherRoute, deliveryRoute, handoffPoint,
            };
        }
    }
    return undefined;
}
