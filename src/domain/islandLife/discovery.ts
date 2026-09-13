import { itemComponents as components } from './itemComponents';
import { extendedGatherings } from './extendedGatherings';
import { growthStage, LIFE_STEP_MS, type Cell, type LifeItem, type LifeState } from './model';
import { cellKey, homeCell, route, sameCell, vacant } from './space';

export const DISCOVERY_RULE_VERSION = 'discovery-v3.0-rc1';
export type DiscoveryRuleId = 'G0' | 'GF3' | 'GF6' | 'GP2' | 'GP3' | 'GT3' | 'GT6' | 'GW2' | 'R1' | 'R3' | 'M2';
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
                ruleId === 'GF3' || ruleId === 'GF6' || ruleId === 'GT3' || ruleId === 'GT6' || ruleId === 'M2' ? growthStage(item) : null,
                ruleId === 'R1' || ruleId === 'R3' ? item.access ?? 'adjacent' : null])]), ...(distance === undefined ? {} : { distance }) };
}

/** Actual usable ground points, including the front-only legacy access contract. */
export function discoveryAccessPoints(state: LifeState, item: LifeItem): Cell[] {
    if (!item.cell) return [];
    const directions = item.access === 'front' ? [{ x: 0, z: 1 }]
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
    for (const group of components(state.items.filter(item => item.kind === 'swing'))) {
        if (group.length >= 2) result.push(eligibility(profileId, 'GP2', group));
        if (group.length >= 3) result.push(eligibility(profileId, 'GP3', group));
    }
    for (const group of extendedGatherings(state)) {
        result.push(eligibility(profileId, group.kind === 'trees' ? 'GT3' : 'GW2', group.items));
        if (group.kind === 'trees' && group.wide) result.push(eligibility(profileId, 'GT6', group.items));
    }
    for (const bench of state.items.filter(item => item.kind === 'bench' && item.cell)) {
        for (const target of state.items.filter(item => item.cell && (item.kind === 'flower' || item.kind === 'swing'))) {
            const distance = relationDistance(state, bench, target);
            if (distance !== undefined && distance <= 4) result.push(eligibility(profileId, target.kind === 'flower' ? 'R1' : 'R3', [bench, target], distance));
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
export function benchRelation(state: LifeState, profileId: string, benchId: string, targetId?: string) {
    return evaluateDiscovery(state, profileId).filter(rule => (rule.ruleId === 'R1' || rule.ruleId === 'R3')
        && rule.participantIds.includes(benchId) && (!targetId || rule.participantIds.includes(targetId)))
        .sort((a, b) => a.distance! - b.distance! || (a.ruleId === b.ruleId ? 0 : a.ruleId === 'R1' ? -1 : 1)
            || (a.semanticSignature < b.semanticSignature ? -1 : a.semanticSignature > b.semanticSignature ? 1 : 0))[0];
}

export function relationAvailability(state: LifeState, rule: RuleEligibility): 'eligible' | 'waiting-for-resident' | 'blocked-path' | 'active' {
    const participants = rule.participantIds.map(id => state.items.find(item => item.id === id));
    if (participants.some(item => !item?.cell || !discoveryAccessPoints(state, item).length)) return 'blocked-path';
    const bench = participants.find(item => item?.kind === 'bench');
    if (bench && state.residents.some(resident => resident.visit?.itemId === bench.id
        && state.now >= resident.visit.start + (resident.visit.path.length - 1) * LIFE_STEP_MS)) return 'active';
    if (!bench) return 'eligible';
    const reserved = new Set(state.residents.flatMap(resident => resident.visit ? [cellKey(resident.visit.path[resident.visit.path.length - 1])] : []));
    const points = bench ? discoveryAccessPoints(state, bench).filter(point => !reserved.has(cellKey(point))) : [];
    const free = state.residents.some(resident => !resident.visit && points.some(point => sameCell(resident.cell, point) || route(state, resident.cell, point)));
    return free ? 'eligible' : 'waiting-for-resident';
}
