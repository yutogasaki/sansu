import { terrainFootingError, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { HOME_CELL, landBounds, walkableCells } from '../../../src/domain/growingIsland/space';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import type { Cell, GrowingState, OccupiedPlaceTarget } from '../../../src/domain/growingIsland/types';
import { shapeOf, type PlaceShape, type ShapeState } from './directional-field';
import { flatBodyFootprintSupported } from './flat-support';

export interface Safety { actors: Cell[]; occupiedPlaceTargets: OccupiedPlaceTarget[] }

/** Reach the usable top, which may have furniture in its centre. The explicit
 * platform supplies the target area; the outer blended shoulder is not a top.
 * Test the actual .18-radius body support and the real navigation graph. */
export function reachablePlacePlatform(world: IslandWorld, open: Set<string>, shape: PlaceShape): Cell | undefined {
    const onTop = (cell: Cell) => shape.flatRadius === undefined
        ? Math.hypot(cell.x - shape.center.x, cell.z - shape.center.z) <= .6
        : Math.hypot(cell.x - shape.center.x, (cell.z - shape.center.z) / .8) <= shape.flatRadius
            && Math.abs((world.floorAt(cell)?.point.y ?? Infinity) - shape.height) <= 1e-6
            && flatBodyFootprintSupported(world, cell);
    return world.walkSites.find(site => open.has(`${site.cell.x},${site.cell.z}`) && onTop(site.cell)
        && world.route(HOME_CELL, site.cell, open))?.cell;
}

export function replacePlace(state: GrowingState, shape: PlaceShape | undefined, safety: Safety): GrowingState & ShapeState {
    const b = landBounds(state);
    if (shape && (!Number.isFinite(shape.center.x) || !Number.isFinite(shape.center.z)
        || shape.center.x < b.minX || shape.center.x > b.maxX || shape.center.z < 0 || shape.center.z >= b.depth
        || ![shape.radius, shape.height, shape.entrance].every(Number.isFinite)
        || shape.radius < 1 || shape.radius > 3 || shape.height < -.6 || shape.height > 1.4 || shape.entrance < .3 || shape.entrance > 2.4
        || shape.rampDirection !== undefined && (!['north', 'west', 'east', 'south'].includes(shape.rampDirection) || shape.height < 0)
        || shape.flatRadius !== undefined && (!Number.isFinite(shape.flatRadius) || shape.flatRadius < .5 || shape.flatRadius > 2)))
        throw Error('取得した土地の中で、場所の大きさを選んでね。');
    if (safety.occupiedPlaceTargets.length) throw Error('なかまが上で遊んでいるよ。おりてから変えよう。');
    const next = { ...state, trialPlace: shape && structuredClone(shape) };
    validateTerrain(next);
    const error = terrainFootingError(state, next, safety.actors);
    if (error) throw Error(error);
    if (shape && shape.height >= 0) {
        const world = editableIslandWorld(next)!;
        const open = walkableCells(next, world);
        const usable = reachablePlacePlatform(world, open, shape);
        if (!usable) throw Error('高台へ登る道がつながらないよ。入口や場所を変えてみよう。');
    }
    return next;
}
export function samePlace(a: PlaceShape | undefined, b: PlaceShape | undefined) { return JSON.stringify(a) === JSON.stringify(b); }
export { shapeOf };
