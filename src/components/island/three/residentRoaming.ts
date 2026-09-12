import { islandPlacementCandidates, type IslandLandAccess } from '../../../domain/island/catalog';
import { planResidentPointRoute, residentObstacles, residentPointIsClear, RESIDENT_FOOTPRINT,
    type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export type ResidentRoamDistrict = 'all' | 'home' | 'east' | 'west';
/** A small set of deterministic strolling moods keeps the world varied while
 * leaving the child with no extra choice to manage. The mood only affects
 * destination preference; every route still uses the same safe navigation. */
export type ResidentRoamStyle = 'nearby' | 'wide' | 'crossing';

export interface ResidentRoamOptions {
    occupied?: readonly GroundPoint[];
    obstacles?: readonly { x: number; z: number; radius: number }[];
    district?: ResidentRoamDistrict;
    departingId?: string;
    style?: ResidentRoamStyle;
    /** Recently visited ground points are skipped when another legal point
     * exists. This is an ephemeral runtime hint, never saved to the island. */
    avoidTargets?: readonly GroundPoint[];
}

export interface ResidentRoamPlan {
    target: GroundPoint;
    route: ResidentRoute;
}

const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);

/** Rotate the available strolling moods by resident and turn. It is exported
 * so the runtime can keep the pattern deterministic and unit tests can pin the
 * variety contract without constructing a WebGL scene. */
export function residentRoamStyle(residentIndex: number, turn: number): ResidentRoamStyle {
    if (![residentIndex, turn].every(Number.isFinite)) return 'nearby';
    const styles: ResidentRoamStyle[] = ['nearby', 'wide', 'crossing'];
    return styles[Math.abs(Math.trunc(residentIndex + turn)) % styles.length];
}

/** Visit residents in a rotating order. One walker remains visible at a time,
 * but the next quiet stroll starts with the resident after the last one so a
 * distant or newly unlocked resident does not stay stuck behind the first. */
export function residentRoamOrder(startIndex: number, residentCount: number): number[] {
    if (!Number.isFinite(startIndex) || !Number.isFinite(residentCount) || residentCount <= 0) return [];
    const count = Math.trunc(residentCount), start = ((Math.trunc(startIndex) % count) + count) % count;
    return Array.from({ length: count }, (_, offset) => (start + offset) % count);
}

function belongsToDistrict(point: GroundPoint, district: ResidentRoamDistrict) {
    if (district === 'home') return point.x > -4.8 && point.x < 4.6;
    if (district === 'east') return point.x >= 4.6;
    if (district === 'west') return point.x <= -4.8;
    return true;
}

function destinationScore(origin: GroundPoint, target: GroundPoint, style: ResidentRoamStyle) {
    const targetDistance = distance(origin, target);
    const preferredDistance = style === 'nearby' ? 2.15 : style === 'wide' ? 4.2 : 3.25;
    let score = Math.abs(targetDistance - preferredDistance);
    if (style === 'crossing') {
        const crossesCenter = Math.abs(origin.x) < .45 || Math.abs(target.x) < .45
            || Math.sign(origin.x) !== Math.sign(target.x);
        if (!crossesCenter) score += 2.8;
    }
    return score;
}

/** Choose a quiet, deterministic destination for autonomous foot wandering.
 * Furniture is still a preferred obstacle; navigation itself decides whether
 * an impossible furniture pocket needs the soft escape fallback. */
export function planResidentRoam(origin: GroundPoint, residentIndex: number, turn: number,
    items: readonly IslandStageItem[], landAccess: IslandLandAccess, options: ResidentRoamOptions = {}): ResidentRoamPlan | undefined {
    if (![origin.x, origin.z, residentIndex, turn].every(Number.isFinite)) return undefined;
    const occupied = options.occupied ?? [];
    const extra = options.obstacles ?? [];
    const district = options.district ?? 'all';
    const style = options.style ?? residentRoamStyle(residentIndex, turn);
    const furnitureObstacles = [...residentObstacles(items, ''), ...extra];
    const candidates = islandPlacementCandidates(landAccess).filter(candidate =>
        belongsToDistrict(candidate, district)
        && distance(origin, candidate) > 1.1
        && residentPointIsClear(candidate, landAccess, furnitureObstacles)
        && occupied.every(other => distance(candidate, other) >= RESIDENT_FOOTPRINT * 2));
    if (!candidates.length) return undefined;

    const validAvoidTargets = (options.avoidTargets ?? []).filter(target =>
        Number.isFinite(target.x) && Number.isFinite(target.z));
    const fresh = candidates.filter(candidate => validAvoidTargets.every(previous => distance(candidate, previous) > .8));
    const pool = fresh.length ? fresh : candidates;
    const ranked = pool.map((candidate, index) => ({ candidate, index, score: destinationScore(origin, candidate, style) }))
        .sort((a, b) => a.score - b.score || a.index - b.index);
    const offset = Math.abs(Math.trunc(turn * 7 + residentIndex * 11)) % ranked.length;
    for (let i = 0; i < ranked.length; i++) {
        const target = ranked[(offset + i) % ranked.length].candidate;
        const route = planResidentPointRoute(origin, target, items, landAccess, {
            navigation: 'roam', occupied, obstacles: extra, departingId: options.departingId,
        });
        if (route) return { target, route };
    }
    return undefined;
}
