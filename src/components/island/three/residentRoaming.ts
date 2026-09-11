import { islandPlacementCandidates, type IslandLandAccess } from '../../../domain/island/catalog';
import { planResidentPointRoute, residentObstacles, residentPointIsClear, RESIDENT_FOOTPRINT,
    type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export type ResidentRoamDistrict = 'all' | 'home' | 'east' | 'west';

export interface ResidentRoamOptions {
    occupied?: readonly GroundPoint[];
    obstacles?: readonly { x: number; z: number; radius: number }[];
    district?: ResidentRoamDistrict;
    departingId?: string;
}

export interface ResidentRoamPlan {
    target: GroundPoint;
    route: ResidentRoute;
}

const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);

function belongsToDistrict(point: GroundPoint, district: ResidentRoamDistrict) {
    if (district === 'home') return point.x > -4.8 && point.x < 4.6;
    if (district === 'east') return point.x >= 4.6;
    if (district === 'west') return point.x <= -4.8;
    return true;
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
    const furnitureObstacles = [...residentObstacles(items, ''), ...extra];
    const candidates = islandPlacementCandidates(landAccess).filter(candidate =>
        belongsToDistrict(candidate, district)
        && distance(origin, candidate) > 1.1
        && residentPointIsClear(candidate, landAccess, furnitureObstacles)
        && occupied.every(other => distance(candidate, other) >= RESIDENT_FOOTPRINT * 2));
    if (!candidates.length) return undefined;

    const offset = Math.abs(Math.trunc(turn * 7 + residentIndex * 11)) % candidates.length;
    for (let i = 0; i < candidates.length; i++) {
        const target = candidates[(offset + i) % candidates.length];
        const route = planResidentPointRoute(origin, target, items, landAccess, {
            navigation: 'roam', occupied, obstacles: extra, departingId: options.departingId,
        });
        if (route) return { target, route };
    }
    return undefined;
}
