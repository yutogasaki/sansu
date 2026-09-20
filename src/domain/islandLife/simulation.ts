import { assertDiagonalCutover } from './diagonalMigration';
import { diagonalRoamRoute } from './diagonalRoam';
import { enableHeroVisits, expireHeroWait, heroWaitDeadline, HERO_WAIT_MS, isHeroTargetVisit } from './heroVisit';
import { assertHeroVisitCutover } from './heroVisitMigration';
import { cadenceReplayKey, cachedLifeState, rememberLifeState } from './replayCache';
import { accrueCadenceUse, CADENCE_REST_MS, enableCadence, shortenCadenceVisit, usesCadence } from './cadence';
import { assertCadenceCutover } from './cadenceMigration';
import { planPlacementClearance, PLACEMENT_CLEARANCE_PREFIX, PLACEMENT_CLEARANCE_HOLD_MS } from './placementClearance';
import { assertPlacementCutover } from './placementMigration';
import { remainingRoute, routeDuration, routeLength, sampleRoute } from './walkingSpace';
import { applyRelationObservation } from './relationObservation';
import { assertRelationCutover } from './relationMigration';
import { assertFacilityCutover } from './facilityMigration';
import { beginBenchTrip, beginFacilityTrip, departFacilityTrip, reservedActivityCells, reservesItem } from './facilityTrips';
import { isFacility, occupiesCell } from './footprint';
import { applyLandExpansion, landReceipt } from './landRules';
import { assertTourCutover } from './tourMigration';
import { playTourMembers, planPlayTourDepartures, advancePlayTourCursor } from './playTours';
import { assertCheckpointBoundary, checkpointLegacyRecord } from './economyMigration';
import { effectiveGrowthHours, issueFiniteLight, GROWTH_WINDOW_MS } from './economyRules';
import { placementUndo } from './placementUndo';
import { observationVisit } from './observationVisit';
import { plantThresholds, readableLifeVersion, CATALOG, HOUR, LIFE_RULES, LIFE_STEP_MS, ROAM_VISIT_PREFIX, isRoamVisit, vigor, type LifeAction, type LifeCommand, type LifeRecord, type LifeState, type LifeResident, type Cell } from './model';
import { blocksWalking, cellKey, districts, homeCell, isHouse, isolatedItems, landCells, route, sameCell, usablePlacement, pathToActivity, walkable } from './space';
import { isWindArch, isPlantsWater, commandFingerprint, paidDrops, purchaseReceipt, removalRefund } from './purchases';

function initial(now: number): LifeState {
    return { now, activityVersion: 1, drops: 0, light: 0, items: [], styles: ['original'], heroStyle: 'original', days: {},
        residents: (['pokomoko', 'rabbit', 'otter'] as const).map((id, index) => ({ id, cell: index === 0 ? { ...homeCell } : { x: 3, z: index }, enjoyed: 0, enjoyedBy: {} })) };
}
function hash(s: string) { let n = 2166136261; for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619); return n >>> 0; }
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export const favorite = (r: LifeResident) => r.id === 'rabbit' ? 'flower' : r.id === 'otter' ? 'swing' : 'bench';
export function residentCell(r: LifeResident, now: number, fine = false) {
    if (fine && r.visit) return sampleRoute(r.visit.path, now - r.visit.start);
    return r.visit ? r.visit.path[Math.min(r.visit.path.length - 1, Math.max(0, Math.floor((now - r.visit.start) / LIFE_STEP_MS)))] : r.cell;
}

/**
 * Quiet ground walks are deliberately derived from the current state. They do
 * not become commands or saved objects, so replaying an island at the same
 * clock still produces the same visible walk without creating another reward
 * source. The style only changes where we look first; route() remains the
 * single authority for legal ground movement.
 */
export type LifeRoamStyle = 'nearby' | 'wide' | 'crossing';
export function lifeRoamStyle(residentIndex: number, turn: number): LifeRoamStyle {
    if (![residentIndex, turn].every(Number.isFinite)) return 'nearby';
    return (['nearby', 'wide', 'crossing'] as const)[Math.abs(Math.trunc(residentIndex + turn)) % 3];
}

function roamDestinationScore(origin: Cell, target: Cell, style: LifeRoamStyle) {
    const targetDistance = distance(origin, target);
    const preferredDistance = style === 'nearby' ? 2 : style === 'wide' ? 6 : 4;
    let score = Math.abs(targetDistance - preferredDistance);
    if (style === 'crossing') {
        const crossesCenter = origin.x <= 2 && target.x >= 3 || origin.x >= 3 && target.x <= 2 || target.x === 2 || target.x === 3;
        if (!crossesCenter) score += 3;
    }
    return score;
}

/** Pick a vacant ground cell for one resident's non-interactive stroll. */
export function planLifeResidentRoam(state: LifeState, resident: LifeResident, turn: number) {
    if (state.activityVersion !== 2 || !Number.isFinite(turn)) return undefined;
    const origin = residentCell(resident, state.now, Boolean(state.placementVersion));
    const residentIndex = Math.max(0, state.residents.indexOf(resident));
    const occupied = new Set<string>();
    for (const other of state.residents) if (other !== resident) {
        occupied.add(cellKey(residentCell(other, state.now, Boolean(state.placementVersion))));
        (state.diagonalVersion && other.visit ? remainingRoute(other.visit.path, state.now - other.visit.start) : other.visit?.path)?.forEach(point => occupied.add(cellKey(point)));
        if (other.facilityTrip) occupied.add(cellKey(other.facilityTrip.path[other.facilityTrip.path.length - 1]));
    }
    const candidates = landCells(state).filter(target => {
        const key = cellKey(target);
        return !isHouse(target) && !occupied.has(key) && !state.items.some(item => occupiesCell(item, target))
            && distance(origin, target) >= 2;
    });
    if (!candidates.length) return undefined;
    const style = lifeRoamStyle(residentIndex, turn);
    const ranked = candidates.map((target, index) => ({ target, index, score: roamDestinationScore(origin, target, style) }))
        .sort((a, b) => a.score - b.score || a.target.z - b.target.z || a.target.x - b.target.x || a.index - b.index);
    const offset = Math.abs(Math.trunc(turn * 7 + residentIndex * 11)) % ranked.length;
    for (let i = 0; i < ranked.length; i++) {
        const target = ranked[(offset + i) % ranked.length].target;
        const avoid = [...occupied].map(key => { const [x, z] = key.split(',').map(Number); return { x, z }; });
        const path = state.diagonalVersion ? diagonalRoamRoute(state, origin, target, avoid) : route(state, origin, target);
        if (path && path.length >= 2 && path.every(point => sameCell(point, origin)
            || !isHouse(point) && !occupied.has(cellKey(point)))) return { target, path, style };
    }
    return undefined;
}

function arrangeRoam(state: LifeState) {
    if (state.activityVersion !== 2 || state.residents.some(resident => resident.visit && isRoamVisit(resident.visit))) return;
    const touring = state.cadenceVersion || state.tourVersion && state.residents.some(r => r.playTour);
    const turn = touring ? state.roamRound ?? 0 : Math.floor(state.now / LIFE_RULES.activityMs);
    const count = state.residents.length;
    if (!count) return;
    const start = ((turn % count) + count) % count;
    for (let offset = 0; offset < count; offset++) {
        const resident = state.residents[(start + offset) % count];
        // An explicitly chosen destination keeps Pokomoko available to wait
        // for that place; another resident can still take the quiet walk.
        if (resident.visit || resident.playTour || resident.id === 'pokomoko' && state.target) continue;
        const plan = planLifeResidentRoam(state, resident, turn);
        if (!plan) continue;
        resident.visit = { itemId: `${ROAM_VISIT_PREFIX}${resident.id}:${turn}`, path: plan.path,
            from: { ...resident.cell }, start: state.now, end: state.now + (touring ? (state.diagonalVersion ? Math.ceil(routeDuration(plan.path)) : routeDuration(plan.path)) + CADENCE_REST_MS : LIFE_RULES.activityMs) };
        if (touring) state.roamRound = turn + 1;
        return;
    }
}

function arrangeTours(s: LifeState) {
    if (!s.tourVersion) return;
    const planned = planPlayTourDepartures(s, s.residents.flatMap(r => r.playTour ? [{ residentId: r.id, cursor: r.playTour }] : []));
    for (const id of planned.cancelled) {
        const resident = s.residents.find(r => r.id === id)!;
        resident.cell = residentCell(resident, s.now, Boolean(s.placementVersion)); resident.visit = undefined; resident.playTour = undefined; resident.facilityTrip = undefined;
    }
    for (const departure of planned.departures) {
        const resident = s.residents.find(r => r.id === departure.residentId)!;
        resident.playTour = { ...resident.playTour!, ...advancePlayTourCursor(resident.playTour!, departure.itemId) };
        resident.visit = { itemId: departure.itemId, path: departure.path, from: { ...resident.cell }, start: s.now,
            end: s.now + routeDuration(departure.path) + 8000 };
    }
}
export function arrangeVisits(s: LifeState) {
    expireHeroWait(s);
    arrangeTours(s);
    const developed = s.activityVersion === 2 ? new Set(districts(s).flatMap(d => d.ids)) : new Set<string>();
    // A fixed assignment order lets the first two residents monopolize two seats.
    // An explicit hero destination comes first; otherwise give less-served residents a turn.
    const order = s.activityVersion === 1 ? s.residents : [...s.residents].sort((a, b) => {
        if (s.target && a.id === 'pokomoko') return -1;
        if (s.target && b.id === 'pokomoko') return 1;
        const newFavorite = (r: LifeResident) => Number(Boolean(r.discovery && s.now - r.discovery.at < 15000
            && s.items.some(i => i.id === r.discovery!.itemId && i.kind === favorite(r))));
        return a.enjoyed - b.enjoyed || newFavorite(b) - newFavorite(a)
            || hash(`${a.id}:${Math.floor(s.now / LIFE_RULES.activityMs)}`) - hash(`${b.id}:${Math.floor(s.now / LIFE_RULES.activityMs)}`);
    });
    for (const r of order) {
        if (r.visit && !isRoamVisit(r.visit) && !s.items.some(i => i.id === r.visit!.itemId && i.cell)) { r.visit = undefined; r.cell = { ...homeCell }; }
        if (r.visit || r.playTour) continue;
        const choices = s.items.filter(i => i.cell && i.kind !== 'lantern' && i.kind !== 'pinwheel').flatMap(i => {
            if (usesCadence(s, r) && r.cadence?.lastItemId === i.id && !(r.id === 'pokomoko' && s.target === i.id)) return [];
            if (i.kind === 'flower-arch' && (r.archCooldownUntil ?? 0) > s.now) return [];
            const reserved = s.activityVersion === 2 || i.kind === 'picnic-table' || i.kind === 'flower-arch' || i.kind === 'sandbox' || isFacility(i.kind) ? reservedActivityCells(s, r.id) : [];
            const path = pathToActivity(s, r.cell, i, reserved); if (!path) return [];
            const crowd = s.residents.filter(other => other !== r && reservesItem(other, i.id)).length;
            if (crowd >= (isFacility(i.kind) || isPlantsWater(i.kind) || i.kind === 'flower-arch' || i.kind === 'swing' || s.activityVersion === 2 && i.kind === 'bench' ? 1 : 2)) return [];
            const like = r.id === 'rabbit' ? i.kind === 'flower' : r.id === 'otter' ? i.kind === 'swing' : i.kind === 'bench';
            const lamp = s.items.some(l => l.kind === 'lantern' && l.cell && Math.abs(l.cell.x - i.cell!.x) + Math.abs(l.cell.z - i.cell!.z) <= 2);
            if (s.activityVersion === 1) return [{ item: i, path, weight: 2 + (like ? 5 : 0) + (i.id === s.target ? r.id === 'pokomoko' ? 100 : 3 : 0) + (lamp ? 2 : 0) - (s.placementVersion ? routeLength(path) + 1 : path.length) * .08 }];
            const nearFavorite = i.kind === 'bench' && s.items.some(n => n.cell && n.kind === favorite(r) && distance(n.cell, i.cell!) <= 2);
            const heroPlace = s.items.find(n => n.id === s.residents[0].visit?.itemId)?.cell;
            const nearHero = r.id !== 'pokomoko' && heroPlace && distance(heroPlace, i.cell!) <= 2;
            const discovered = r.discovery && s.now - r.discovery.at < 15000 ? s.items.find(n => n.id === r.discovery!.itemId)?.cell : undefined;
            const newPlace = discovered ? i.id === r.discovery!.itemId ? 12 : distance(discovered, i.cell!) <= 2 ? 5 : 0 : 0;
            return [{ item: i, path, weight: 2 + (like ? 8 : 0) + (nearFavorite ? 5 : 0) + (nearHero ? 7 : 0)
                + newPlace + (developed.has(i.id) ? 2 : 0) + (lamp ? 2 : 0) - (s.placementVersion ? routeLength(path) + 1 : path.length) * .08 }];
        });
        if (!choices.length) continue;
        let dice = hash(`${r.id}:${r.enjoyed}:${r.cadence ? r.cadence.round : Math.floor(s.now / LIFE_RULES.activityMs)}`) / 2 ** 32 * choices.reduce((n, c) => n + c.weight, 0);
        const requested = r.id === 'pokomoko' && s.target ? choices.find(c => c.item.id === s.target) : undefined;
        if (r.id === 'pokomoko' && s.target && !requested) continue;
        const chosen = requested ? requested
            : choices.find(c => (dice -= c.weight) <= 0) ?? choices[0];
        r.visit = { ...(s.relationSelectionVersion ? { relationSelectionVersion: 1 as const } : {}), itemId: chosen.item.id, path: chosen.path, from: { ...r.cell }, start: s.now, end: s.now + (chosen.item.kind === 'flower-arch' ? routeDuration(chosen.path) + 400 : LIFE_RULES.activityMs) };
        beginFacilityTrip(s, r, chosen.item);
        beginBenchTrip(s, r, chosen.item);
        const members = s.tourVersion && !requested ? playTourMembers(s, chosen.item.id) : undefined;
        if (members) {
            r.playTour = { memberIds: members, lastItemId: chosen.item.id, remainingMs: LIFE_RULES.activityMs };
            r.visit.end = s.now + routeDuration(chosen.path) + 8000;
        }
        shortenCadenceVisit(s, r);
    }
    arrangeRoam(s);
}
function awardUse(s: LifeState, r: LifeResident, kind: typeof s.items[number]['kind'] | undefined) {
    if (kind) r.enjoyedBy[kind] = (r.enjoyedBy[kind] ?? 0) + 1;
    r.enjoyed++;
    if (s.economy) {
        const issued = issueFiniteLight(s.light, s.economy.lightRemainingBudget, 1);
        s.light = issued.light; s.economy.lightRemainingBudget = issued.lightRemainingBudget;
    } else s.light++;
}
export function settleCadenceUse(s: LifeState, from: number, to: number) {
    if (!s.cadenceVersion) return;
    for (const r of s.residents) {
        const earned = accrueCadenceUse(s, r, from, to);
        if (earned) for (let i = 0; i < earned.count; i++) awardUse(s, r, earned.kind);
    }
}
export function advanceLifeState(s: LifeState, to: number) {
    if (!Number.isFinite(to) || to < s.now) throw new Error('Invalid world time');
    arrangeVisits(s);
    while (s.now < to) {
        let next = to;
        const waitDeadline = heroWaitDeadline(s);
        if (waitDeadline !== undefined && waitDeadline > s.now) next = Math.min(next, waitDeadline);
        if (s.lastAchievement !== undefined) for (const boundary of [24, 72].map(h => s.lastAchievement! + h * HOUR)) if (boundary > s.now) next = Math.min(next, boundary);
        for (const r of s.residents) if ((r.archCooldownUntil ?? 0) > s.now) next = Math.min(next, r.archCooldownUntil!);
        for (const r of s.residents) if (r.visit) {
            next = Math.min(next, r.visit.end);
            if (r.playTour) next = Math.min(next, s.now + r.playTour.remainingMs);
        }
        for (const r of s.residents) if (r.playTour && r.visit) r.playTour.remainingMs -= next - s.now;
        const hours = s.economy ? effectiveGrowthHours(s.economy.completionTimes, s.now, next) : (next - s.now) / HOUR * vigor(s);
        for (const i of s.items) {
            const thresholds = plantThresholds(i.kind);
            if (thresholds && i.cell) i.growth = Math.min(thresholds[1], i.growth + hours);
        }
        settleCadenceUse(s, s.now, next);
        s.now = next;
        for (const r of s.residents) if (r.playTour && r.playTour.remainingMs <= 0) {
            awardUse(s, r, 'swing'); r.playTour.remainingMs = LIFE_RULES.activityMs;
        }
        for (const r of s.residents) if (r.visit && r.visit.end <= next) {
            if (departFacilityTrip(s, r)) continue;
            if (s.heroVisitVersion && isHeroTargetVisit(s, r)) { s.target = undefined; s.heroWaitUntil = undefined; }
            const visit = r.visit, kind = s.items.find(i => i.id === visit.itemId)?.kind;
            r.cell = visit.path[visit.path.length - 1]; r.visit = undefined;
            r.facilityTrip = undefined;
            if (kind === 'flower-arch') {
                r.archCooldownUntil = s.now + LIFE_RULES.activityMs;
                if (r.id === 'pokomoko' && s.target === visit.itemId) s.target = undefined;
                continue;
            }
            if (s.cadenceVersion && !visit.observationTest) {
                r.cadence ??= { round: 0, useMs: {} };
                r.cadence.round++;
                r.cadence.lastItemId = isRoamVisit(visit) ? undefined : visit.itemId;
            }
            if (visit.cadence || isRoamVisit(visit) || visit.observationTest) continue;
            if (!r.playTour) awardUse(s, r, kind);
        }
        arrangeVisits(s);
    }
}
function fail(message: string): never { throw new Error(message); }
export function applyCommand(s: LifeState, event: LifeAction) {
    const c = event.command;
    if (c.type === 'clear-placement') {
        const plan = planPlacementClearance(s, c);
        for (const move of plan.moves) {
            const resident = s.residents.find(r => r.id === move.residentId)!;
            resident.cell = move.from; resident.playTour = undefined; resident.facilityTrip = undefined; resident.discovery = undefined;
            resident.visit = { itemId: `${PLACEMENT_CLEARANCE_PREFIX}${event.id}:${resident.id}`, from: move.from, path: move.path,
                start: s.now, end: s.now + plan.durationMs + PLACEMENT_CLEARANCE_HOLD_MS };
        }
        return;
    }
    // A spatial edit never puts a solid object through a resident. This check
    // precedes every mutation so a retry preserves both the item and the wallet.
    if (s.placementVersion && (c.type === 'buy' || c.type === 'move')) {
        const candidate = c.type === 'buy'
            ? { id: event.id, kind: c.kind, cell: c.cell, growth: 0, style: 'original' as const }
            : { ...s.items.find(i => i.id === c.itemId)!, cell: c.cell };
        if (!candidate.kind) fail('その ものが みつからないよ。');
        const trial = { ...s, items: [...s.items.filter(i => i.id !== candidate.id), candidate] };
        if (s.residents.some(r => !walkable(trial, residentCell(r, s.now, Boolean(s.placementVersion))))) {
            fail('そこを あるいているよ。すこし まって もういちど おこう。');
        }
    }
    if (c.type === 'buy') {
        if (!CATALOG[c.kind]) fail('この どうぐは まだ ないよ。');
        const price = paidDrops(event);
        if (s.drops < price) fail('しずくが もうすこし いるよ。');
        if (isFacility(c.kind) && s.items.some(i => i.kind === c.kind)) fail('この たてものは もう もっているよ。');
        if (s.items.length >= LIFE_RULES.maxItems) fail('もちものが いっぱいだよ。');
        const item = { id: event.id, kind: c.kind, cell: undefined, growth: 0, style: 'original' as const, paidDrops: price,
            access: s.activityVersion === 2 && ['bench', 'swing'].includes(c.kind) ? 'front' as const : undefined };
        s.items.push(item);
        if (!usablePlacement(s, item.id, c.cell)) { s.items.pop(); fail('そこには おけないよ。べつの ばしょを えらぼう。'); }
        s.items[s.items.length - 1] = { ...item, cell: c.cell }; s.drops -= price;
        if (s.activityVersion === 2) for (const r of s.residents) {
            const likes = favorite(r) === c.kind;
            const close = distance(residentCell(r, s.now, Boolean(s.placementVersion)), c.cell) <= 3;
            const interested = hash(`${event.id}:${r.id}`) % 10 < (likes ? 10 : close ? 7 : 3);
            if (!interested || r.id === 'pokomoko' && s.target) continue;
            r.discovery = { itemId: item.id, at: s.now, mood: likes || close ? 'notice' : 'curious' };
            r.cell = residentCell(r, s.now, Boolean(s.placementVersion)); r.visit = undefined; r.playTour = undefined; r.facilityTrip = undefined;
        }
    } else if (c.type === 'expand') {
        applyLandExpansion(s, event);
    } else if (c.type === 'style') {
        if (!['original', 'sunshine', 'starlight'].includes(c.style)) fail('その いろは まだ ないよ。');
        const item = c.itemId ? s.items.find(i => i.id === c.itemId) : undefined;
        if (c.itemId && !item) fail('もう しまってある ものかも。');
        if (!s.styles.includes(c.style)) { if (s.light < LIFE_RULES.stylePrice) fail('ひかりが もうすこし いるよ。'); s.light -= LIFE_RULES.stylePrice; s.styles.push(c.style); }
        if (item) item.style = c.style; else s.heroStyle = c.style;
    } else {
        const item = s.items.find(i => i.id === c.itemId);
        if (!item) fail('その ものが みつからないよ。');
        if (c.type === 'observe-relation') applyRelationObservation(s, c.itemId, c.residentId, c.targetId);
        else if (c.type === 'observe') {
            const plan = observationVisit(s, item.id);
            if (plan.kind === 'busy') fail('いまは、ほかのことを しているよ。');
            if (plan.kind === 'unavailable') fail('いまは ここで ためせないよ。');
            if (plan.kind === 'ready') {
                const resident = s.residents.find(resident => resident.id === plan.residentId)!;
                resident.playTour = undefined; resident.facilityTrip = undefined;
                resident.visit = { ...(s.relationSelectionVersion ? { relationSelectionVersion: 1 as const } : {}), itemId: item.id, from: { ...resident.cell }, path: plan.path,
                    start: s.now, end: s.now + plan.duration, observationTest: true };
                beginFacilityTrip(s, resident, item);
                beginBenchTrip(s, resident, item);
            }
        } else if (c.type === 'visit') {
            if (!item.cell || (item.kind === 'lantern' || item.kind === 'pinwheel') || !pathToActivity(s, homeCell, item)) fail('ここでは あそべないよ。');
            if (item.kind === 'flower-arch') s.residents[0].archCooldownUntil = undefined;
            const changed = s.target !== item.id;
            s.target = item.id;
            if (s.heroVisitVersion && changed) s.heroWaitUntil = s.now + HERO_WAIT_MS;
            const hero = s.residents[0];
            if (hero.visit?.itemId !== item.id && !(s.heroVisitVersion && isHeroTargetVisit(s, hero))) {
                if (hero.visit) hero.cell = residentCell(hero, s.now, Boolean(s.placementVersion));
                hero.visit = undefined; hero.playTour = undefined; hero.facilityTrip = undefined;
            }
            if (changed && s.activityVersion === 2) for (const other of s.residents.slice(1)) {
                // One invitation per new destination. The resident still chooses
                // their own reachable, uncrowded place; no instant light is paid.
                const interested = hash(`${event.id}:${other.id}`) % 10 < 7;
                if (interested && other.visit?.itemId !== item.id) { other.cell = residentCell(other, s.now, Boolean(s.placementVersion)); other.visit = undefined; other.playTour = undefined; other.facilityTrip = undefined; }
            }
        } else {
            if (c.type === 'move' && !usablePlacement(s, item.id, c.cell)) fail('そこには おけないよ。べつの ばしょを えらぼう。');
            // Reroute all walkers after any edit; interrupted visits never yield light.
            for (const r of s.residents) { r.cell = s.activityVersion === 2 ? residentCell(r, s.now, Boolean(s.placementVersion)) : { ...homeCell }; r.visit = undefined; r.playTour = undefined; r.facilityTrip = undefined; r.discovery = undefined; }
            if (c.type === 'remove') { s.items = s.items.filter(i => i.id !== item.id); s.drops += removalRefund(item); }
            else item.cell = c.type === 'move' ? c.cell : undefined;
            if (c.type === 'move' && s.activityVersion === 2 && ['bench', 'swing'].includes(item.kind)) item.access = 'front';
            if (s.target === item.id) s.target = undefined;
        }
    }
    // Edits must also invalidate paths planned before a new obstacle was bought.
    const isolated = s.placementVersion ? new Set(isolatedItems(s).map(i => i.id)) : undefined;
    for (const r of s.residents) {
        const occupied = (p: typeof r.cell) => s.placementVersion ? !walkable(s, p) : s.items.some(i => blocksWalking(i) && occupiesCell(i, p));
        const ahead = r.visit && (s.placementVersion ? remainingRoute(r.visit.path, s.now - r.visit.start) : r.visit.path);
        if (r.visit && (ahead!.some(occupied) || r.facilityTrip && (!s.placementVersion || r.facilityTrip.phase === 'collect') && r.facilityTrip.path.some(occupied)
            || isolated?.has(r.visit.itemId) || r.facilityTrip && (isolated?.has(r.facilityTrip.facilityId) || isolated?.has(r.facilityTrip.targetId)))) {
            r.cell = residentCell(r, s.now, Boolean(s.placementVersion));
            r.visit = undefined; r.playTour = undefined; r.facilityTrip = undefined;
        }
        if (!s.placementVersion && occupied(r.cell)) { r.cell = { ...homeCell }; r.visit = undefined; r.playTour = undefined; r.facilityTrip = undefined; }
    }
    arrangeVisits(s);
}
export function replayLife(record: LifeRecord, to = record.now): LifeState {
    if (!readableLifeVersion(record.version)) throw new Error('この島のデータは新しい版で開いてください。');
    if (record.version < 15 && record.actions.some(a => a.command.type === 'clear-placement')) throw new Error('配置の切替記録が見つかりません。');
    if (record.version < 14 && record.actions.some(a => a.command.type === 'observe-relation')) throw new Error('この観察は新しい版で開いてください。');
    const facilityIds = new Set(record.actions.filter(a => a.command.type === 'buy' && isFacility(a.command.kind)).map(a => a.id));
    if (record.version < 12 && record.actions.some(a => a.command.type === 'observe' && facilityIds.has(a.command.itemId))) throw new Error('この観察は新しい版で開いてください。');
    const checkpoint = record.economyCheckpoint;
    assertCheckpointBoundary(record); assertTourCutover(record); assertFacilityCutover(record); assertRelationCutover(record); assertPlacementCutover(record); assertCadenceCutover(record); assertHeroVisitCutover(record); assertDiagonalCutover(record);
    if (record.actions.some(action => action.command.type === 'buy' && action.command.kind === 'sandbox') && record.version < 9) throw new Error('砂場の保存版を確認できません。');
    if (record.actions.some(action => action.command.type === 'buy' && isFacility(action.command.kind)) && record.version < 10) throw new Error('建物の保存版を確認できません。');
    if (record.actions.some(action => action.landReceipt) && ![5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(record.version)) throw new Error('土地の保存版を確認できません。');
    if (record.actions.some(action => action.command.type === 'buy' && isWindArch(action.command.kind)) && record.version < 8) throw new Error('風車とアーチの保存版を確認できません。');
    if (record.actions.some(action => action.command.type === 'buy' && action.command.kind === 'picnic-table') && record.version < 7) throw new Error('テーブルの保存版を確認できません。');
    if (record.actions.some(action => action.command.type === 'buy' && isPlantsWater(action.command.kind)) && record.version < 6) throw new Error('新しい物の保存版を確認できません。');
    if (checkpoint && to < checkpoint.cutoverAt) return replayLife(checkpointLegacyRecord(checkpoint), to);
    const cacheKey = cadenceReplayKey(record, to), cached = cachedLifeState(cacheKey, to);
    if (cached) {
        if (to > cached.now) advanceLifeState(cached, to);
        rememberLifeState(cacheKey, cached);
        return cached;
    }
    const s = checkpoint ? structuredClone(checkpoint.state) : initial(record.createdAt);
    const known = new Set(checkpoint?.projectedCreditIds ?? []);
    const credits = checkpoint ? record.credits.filter(credit => !known.has(credit.id)) : record.credits;
    if (checkpoint && credits.some(credit => credit.at <= checkpoint.cutoverAt)) throw new Error('以前の学習を反映してから島を開いてね。');
    const actions = checkpoint ? record.actions.slice(checkpoint.actionCount) : record.actions;
    const events = [...credits.map(c => ({ at: c.at, credit: c, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 0 })),
        ...actions.map((a, index) => ({ at: a.at, credit: undefined, action: a, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false,
            rank: record.tourCutover && a.at === record.tourCutover.at && index + (checkpoint?.actionCount ?? 0) < record.tourCutover.actionCount ? 1.25 : record.facilityCutover && a.at === record.facilityCutover.at && index + (checkpoint?.actionCount ?? 0) < record.facilityCutover.actionCount ? 1.75 : record.relationCutover && a.at === record.relationCutover.at && index + (checkpoint?.actionCount ?? 0) < record.relationCutover.actionCount ? 1.9 : record.placementCutover && a.at === record.placementCutover.at && index + (checkpoint?.actionCount ?? 0) < record.placementCutover.actionCount ? 1.96 : record.cadenceCutover && a.at === record.cadenceCutover.at && index + (checkpoint?.actionCount ?? 0) < record.cadenceCutover.actionCount ? 1.98 : record.heroVisitCutover && a.at === record.heroVisitCutover.at && index + (checkpoint?.actionCount ?? 0) < record.heroVisitCutover.actionCount ? 1.992 : record.diagonalCutover && a.at === record.diagonalCutover.at && index + (checkpoint?.actionCount ?? 0) < record.diagonalCutover.actionCount ? 1.996 : a.at === record.activitiesV2At && index < (record.activitiesV2After ?? 0) ? .5 : 2 })),
        ...(checkpoint || record.activitiesV2At === undefined ? [] : [{ at: record.activitiesV2At, credit: undefined, action: undefined, switchVersion: true, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 1 }]),
        ...(record.tourCutover ? [{ at: record.tourCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: true, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 1.5 }] : []),
        ...(record.facilityCutover ? [{ at: record.facilityCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: true, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 1.875 }] : []),
        ...(record.relationCutover ? [{ at: record.relationCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: true, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 1.95 }] : []),
        ...(record.placementCutover ? [{ at: record.placementCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: true, switchCadence: false, switchHeroVisit: false, switchDiagonal: false, rank: 1.975 }] : []),
        ...(record.cadenceCutover ? [{ at: record.cadenceCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: true, switchHeroVisit: false, switchDiagonal: false, rank: 1.99 }] : []),
        ...(record.heroVisitCutover ? [{ at: record.heroVisitCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: true, switchDiagonal: false, rank: 1.995 }] : []),
        ...(record.diagonalCutover ? [{ at: record.diagonalCutover.at, credit: undefined, action: undefined, switchVersion: false, switchTour: false, switchFacility: false, switchRelation: false, switchPlacement: false, switchCadence: false, switchHeroVisit: false, switchDiagonal: true, rank: 1.997 }] : [])]
        .sort((a, b) => a.at - b.at || a.rank - b.rank);
    const credited = new Set<string>();
    let lastWasPlacementCutover = false;
    for (const event of events) {
        if (event.at > to) break;
        lastWasPlacementCutover = event.switchPlacement || event.switchCadence || event.switchHeroVisit || event.switchDiagonal;
        advanceLifeState(s, Math.max(s.now, event.at));
        if (event.credit) {
            const c = event.credit; if (credited.has(c.id)) continue; credited.add(c.id);
            s.drops += LIFE_RULES.dropsPerProblem;
            if (s.economy) s.economy.completionTimes = [...s.economy.completionTimes.filter(at => at > s.now - GROWTH_WINDOW_MS), c.at];
            s.days[c.day] = (s.days[c.day] ?? 0) + 1;
            if (s.days[c.day] === LIFE_RULES.dailyGoal) s.lastAchievement = c.at;
        } else if (event.switchVersion) {
            s.activityVersion = 2;
            for (const r of s.residents) { r.cell = residentCell(r, s.now, Boolean(s.placementVersion)); r.visit = undefined; }
            arrangeVisits(s);
        } else if (event.switchTour) { s.tourVersion = 1; s.roamRound = 0; }
        else if (event.switchFacility) { s.facilityTripVersion = 1; }
        else if (event.switchRelation) { s.relationSelectionVersion = 1; }
        else if (event.switchPlacement) { s.placementVersion = 1; }
        else if (event.switchCadence) enableCadence(s);
        else if (event.switchHeroVisit) enableHeroVisits(s);
        else if (event.switchDiagonal) s.diagonalVersion = 1;
        else if (event.action) applyCommand(s, event.action);
    }
    // Enabling new routes alone must not reassign residents in the frozen cutover state.
    // A later clock tick or a same-time action resumes normal scheduling.
    if (!lastWasPlacementCutover || to > s.now) advanceLifeState(s, Math.max(s.now, to));
    rememberLifeState(cacheKey, s);
    return s;
}
export function commandLife(record: LifeRecord, command: LifeCommand, id: string, now: number, undoOf?: string): LifeRecord {
    if (!readableLifeVersion(record.version)) throw new Error('この島のデータは新しい版で開いてください。');
    if (command.type === 'clear-placement' && record.version < 15) throw new Error('配置の切替記録が見つかりません。');
    const existing = record.actions.find(a => a.id === id);
    if (existing) {
        if (existing.undoOf !== undoOf || commandFingerprint(existing.command) !== commandFingerprint(command)) throw new Error('同じ操作の内容が変わっています。');
        return record;
    }
    if (record.tourCutover && now < record.now) throw new Error('以前の時刻には操作を追加できません。');
    if (undoOf !== undefined) {
        const inverse = placementUndo(record, undoOf);
        if (!inverse || commandFingerprint(inverse) !== commandFingerprint(command)) throw new Error('しまが かわったよ。もういちど えらんでね。');
    }
    const event: LifeAction = { id, at: now, command, ...(undoOf === undefined ? {} : { undoOf }) };
    if (command.type === 'buy' && (isPlantsWater(command.kind) || command.kind === 'picnic-table' || isWindArch(command.kind) || command.kind === 'sandbox' || isFacility(command.kind)) && !record.tourCutover) throw new Error('島をよみなおしてから えらんでね。');
    if (command.type === 'buy') event.purchaseReceipt = purchaseReceipt(event);
    const state = replayLife(record, now);
    if (command.type === 'expand' && record.tourCutover) event.landReceipt = landReceipt(state, event);
    applyCommand(state, event);
    const facilityObservation = command.type === 'observe' && state.items.some(i => i.id === command.itemId && isFacility(i.kind));
    return { ...record, version: record.version === 18 ? 18 : record.version === 17 ? 17 : record.version === 16 ? 16 : record.version === 15 ? 15 : record.version === 14 || command.type === 'observe-relation' ? 14 : record.version === 13 ? 13 : record.version === 12 || facilityObservation ? 12 : record.version === 11 ? 11 : record.version === 10 || command.type === 'buy' && isFacility(command.kind) ? 10 : record.version === 9 || command.type === 'buy' && command.kind === 'sandbox' ? 9 : record.version === 8 || command.type === 'buy' && isWindArch(command.kind) ? 8 : record.version === 7 || command.type === 'buy' && command.kind === 'picnic-table' ? 7 : record.version === 6 || command.type === 'buy' && isPlantsWater(command.kind) ? 6 : event.landReceipt ? 5 : command.type === 'observe' && record.version === 1 ? 2 : record.version, now, revision: record.revision + 1, actions: [...record.actions, event] };
}
