import { shadowResident } from './shadowMagic';
import { isFacility } from './footprint';
import { itemComponents as components } from './itemComponents';
import { extendedGatherings } from './extendedGatherings';
import { growthStage, LIFE_STEP_MS, type Cell, type LifeItem, type LifeState } from './model';
import { cellKey, homeCell, route, sameCell, vacant } from './space';

export const DISCOVERY_RULE_VERSION = 'discovery-v3.0-rc1';
export type DiscoveryRuleId = 'G0' | 'GF3' | 'GF6' | 'GP2' | 'GP3' | 'GT3' | 'GT6' | 'GW2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'M2' | 'M3' | 'M4';
export interface RuleEligibility {
    ruleId: DiscoveryRuleId;
    ruleVersion: typeof DISCOVERY_RULE_VERSION;
    participantIds: string[];
    semanticSignature: string;
    distance?: number;
}

/** Structural facts only: no event, reward, or presentation evidence is created. */
function eligibility(profileId: string, ruleId: DiscoveryRuleId, items: LifeItem[], distance?: number): RuleEligibility {
    const ordered = [...items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return { ruleId, ruleVersion: DISCOVERY_RULE_VERSION, participantIds: ordered.map(item => item.id),
        semanticSignature: JSON.stringify([profileId, DISCOVERY_RULE_VERSION, ruleId,
            ordered.map(item => [item.id, item.kind, item.cell?.x, item.cell?.z,
                ruleId === 'GF3' || ruleId === 'GF6' || ruleId === 'GT3' || ruleId === 'GT6' || ruleId === 'R2' || ruleId === 'M2' ? growthStage(item) : null,
                ruleId === 'R1' || ruleId === 'R3' || ruleId === 'R4' || ruleId === 'R2' || ruleId === 'R5' || ruleId === 'R6' ? item.access ?? 'adjacent' : null])]), ...(distance === undefined ? {} : { distance }) };
}

/** Actual usable ground points, including the front-only legacy access contract. */
export function discoveryAccessPoints(state: LifeState, item: LifeItem): Cell[] {
    if (!item.cell) return [];
    const directions = isFacility(item.kind) ? [{ x: 0, z: 2 }] : (item.kind === 'picnic-table' || item.kind === 'sandbox') ? [{ x: 0, z: 1 }, { x: 0, z: -1 }] : item.access === 'front' ? [{ x: 0, z: 1 }]
        : [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
    return directions.map(d => ({ x: item.cell!.x + d.x, z: item.cell!.z + d.z }))
        .filter(point => vacant(state, point) && Boolean(route(state, homeCell, point)));
}

export function relationDistance(state: LifeState, a: LifeItem, b: LifeItem): number | undefined {
    const distances = discoveryAccessPoints(state, a).flatMap(from => discoveryAccessPoints(state, b).flatMap(to => {
        const path = route(state, from, to);
        return path ? [path.length - 1] : [];
    }));
    return distances.length ? Math.min(...distances) : undefined;
}

export function evaluateDiscovery(state: LifeState, profileId: string): RuleEligibility[] {
    const result: RuleEligibility[] = [];
    const flowers = state.items.filter(item => item.kind === 'flower' && item.cell);
    for (const group of plantGatherings(state)) result.push(eligibility(profileId, 'G0', group));
    for (const group of components(flowers.filter(item => growthStage(item) === 2))) {
        if (group.length < 3) continue;
        result.push(eligibility(profileId, 'GF3', group));
        const xs = group.map(item => item.cell!.x), zs = group.map(item => item.cell!.z);
        if (group.length >= 6 && Math.max(...xs) - Math.min(...xs) >= 2 && Math.max(...zs) - Math.min(...zs) >= 1) {
            result.push(eligibility(profileId, 'GF6', group));
        }
    }
    for (const group of components(state.items.filter(item => (item.kind === 'swing' || item.kind === 'sandbox')))) {
        if (group.length >= 2) result.push(eligibility(profileId, 'GP2', group));
        if (group.length >= 3) result.push(eligibility(profileId, 'GP3', group));
    }
    for (const group of extendedGatherings(state)) {
        result.push(eligibility(profileId, group.kind === 'trees' ? 'GT3' : 'GW2', group.items));
        if (group.kind === 'trees' && group.wide) result.push(eligibility(profileId, 'GT6', group.items));
    }
    for (const bench of state.items.filter(item => item.kind === 'bench' && item.cell)) {
        for (const target of state.items.filter(item => item.cell && (item.kind === 'flower' || (item.kind === 'swing' || item.kind === 'sandbox') || ((state.relationVersion === 'water-bench-v1' || state.relationSelectionVersion) && item.kind === 'water-bowl')))) {
            const distance = relationDistance(state, bench, target);
            if (distance !== undefined && distance <= 4) result.push(eligibility(profileId, target.kind === 'flower' ? 'R1' : target.kind === 'water-bowl' ? 'R4' : 'R3', [bench, target], distance));
        }
    }
    for (const table of state.items.filter(item => item.kind === 'picnic-table' && item.cell)) {
        for (const tree of state.items.filter(item => item.kind === 'sapling' && item.cell && growthStage(item) === 2)) {
            const distance = relationDistance(state, table, tree);
            if (distance !== undefined && distance <= 4) result.push(eligibility(profileId, 'R2', [table, tree], distance));
        }
    }
    if (state.facilityTripVersion) for (const facility of state.items.filter(item => item.cell && isFacility(item.kind))) {
        for (const target of state.items.filter(item => item.cell && (facility.kind === 'library' ? item.kind === 'bench' : item.kind === 'flower' || item.kind === 'sapling'))) {
            const distance = relationDistance(state, facility, target);
            if (distance !== undefined && distance <= 4) result.push(eligibility(profileId, facility.kind === 'library' ? 'R5' : 'R6', [facility, target], distance));
        }
    }
    if (state.shadowMagicVersion) for (const bench of state.items.filter(i => i.kind === 'bench' && i.cell)) {
        if (shadowResident(state, bench.id)) result.push(eligibility(profileId, 'M3', [bench]));
    }
    if (state.waterMagicVersion) for (const water of state.items.filter(item => item.kind === 'water-bowl' && item.cell)) {
        for (const lamp of state.items.filter(item => item.kind === 'lantern' && item.cell)) {
            const distance = relationDistance(state, water, lamp);
            if (distance !== undefined && distance <= 4) result.push(eligibility(profileId, 'M4', [water, lamp], distance));
        }
    }
    for (const flower of state.items.filter(item => item.cell && (item.kind === 'flower' || item.kind === 'sapling'))) result.push(eligibility(profileId, 'M2', [flower]));
    return result.sort((a, b) => a.semanticSignature < b.semanticSignature ? -1 : a.semanticSignature > b.semanticSignature ? 1 : 0);
}

/** Ground rendering shares the G0 grouping without evaluating every relation. */
export function plantGatherings(state: LifeState): LifeItem[][] {
    return (['flower', 'sapling'] as const).flatMap(kind => components(state.items.filter(item => item.kind === kind && item.cell)).filter(group => group.length >= 3));
}

/** Select the current relation, or a touched real object, without a recipe menu. */
export function benchRelation(state: LifeState, profileId: string, benchId: string, targetId?: string): RuleEligibility | undefined {
    if (state.relationSelectionVersion && state.residents.some(r => r.visit?.itemId === benchId && !r.visit.relationSelectionVersion && state.now < r.visit.end)) {
        return benchRelation({ ...state, relationSelectionVersion: undefined }, profileId, benchId, targetId);
    }
    if (state.relationSelectionVersion) {
        const selected = activityRelation(state, profileId, benchId, targetId);
        return selected?.ruleId === 'R5' ? undefined : selected;
    }
    return evaluateDiscovery(state, profileId).filter(rule => (rule.ruleId === 'R1' || rule.ruleId === 'R2' || rule.ruleId === 'R3' || rule.ruleId === 'R4')
        && rule.participantIds.includes(benchId) && (!targetId || rule.participantIds.includes(targetId)))
        .sort((a, b) => a.distance! - b.distance! || (['R1', 'R4', 'R3', 'R2'].indexOf(a.ruleId) - ['R1', 'R4', 'R3', 'R2'].indexOf(b.ruleId))
            || (a.semanticSignature < b.semanticSignature ? -1 : a.semanticSignature > b.semanticSignature ? 1 : 0))[0];
}

export function relationAvailability(state: LifeState, rule: RuleEligibility): 'eligible' | 'waiting-for-resident' | 'blocked-path' | 'active' {
    const participants = rule.participantIds.map(id => state.items.find(item => item.id === id));
    if (participants.some(item => !item?.cell || !discoveryAccessPoints(state, item).length)) return 'blocked-path';
    const bench = participants.find(item => item?.kind === 'bench' || item?.kind === 'picnic-table');
    if (bench && state.residents.some(resident => resident.visit?.itemId === bench.id
        && state.now >= resident.visit.start + (resident.visit.path.length - 1) * LIFE_STEP_MS)) return 'active';
    if (!bench) return 'eligible';
    const reserved = new Set(state.residents.flatMap(resident => resident.visit ? [cellKey(resident.visit.path[resident.visit.path.length - 1])] : []));
    const points = bench ? discoveryAccessPoints(state, bench).filter(point => !reserved.has(cellKey(point))) : [];
    const free = state.residents.some(resident => !resident.visit && points.some(point => sameCell(resident.cell, point) || route(state, resident.cell, point)));
    return free ? 'eligible' : 'waiting-for-resident';
}

/** New scheduling and explicit-object selection share distance, rule and actual
 * partner ID ordering. An unavailable selected role is not silently substituted. */
export function activityRelation(state: LifeState, profileId: string, itemId: string, targetId?: string) {
    const order = ['R5', 'R1', 'R4', 'R3', 'R2', 'R6'];
    const partner = (rule: RuleEligibility) => rule.participantIds.find(id => id !== itemId)!;
    return evaluateDiscovery(state, profileId).filter(rule => order.includes(rule.ruleId)
        && rule.participantIds.includes(itemId) && (!targetId || partner(rule) === targetId))
        .sort((a, b) => a.distance! - b.distance! || order.indexOf(a.ruleId) - order.indexOf(b.ruleId)
            || (partner(a) < partner(b) ? -1 : partner(a) > partner(b) ? 1 : 0))[0];
}

/** A trial target belongs to its resident's visit, never to another table user. */
export function visitRelation(state: LifeState, profileId: string, visit: import('./model').Visit) {
    return benchRelation(state, profileId, visit.itemId, visit.relationTargetId
        ?? (state.relationTarget?.benchId === visit.itemId ? state.relationTarget.targetId : undefined));
}
