import { describe, expect, it } from 'vitest';
import { newLife, LIFE_STEP_MS, type LifeItem } from './model';
import { replayLife } from './simulation';
import { homeCell, pathToActivity, route } from './space';
import { canStand, routeDuration, routeLength, sampleRoute } from './walkingSpace';

const fixture = () => ({ ...replayLife(newLife('walking-space', 0)), placementVersion: 1 as const, items: [] as LifeItem[] });
const item = (id: string, kind: LifeItem['kind'], x: number, z: number): LifeItem => ({ id, kind, cell: { x, z }, style: 'original', growth: 0, plantedAt: 0 } as LifeItem);

describe('fine walking space', () => {
    it('reaches every flower in a packed two by three flowerbed through visible gaps', () => {
        const state = fixture();
        state.items = [0, 1, 2].flatMap(x => [2, 3].map(z => item(`${x}:${z}`, 'flower', x, z)));
        for (const flower of state.items) {
            const path = pathToActivity(state, homeCell, flower)!;
            expect(path).toBeDefined();
            expect(path.every(point => canStand(state, point))).toBe(true);
            for (let elapsed = 0; elapsed < routeDuration(path); elapsed += 20) expect(canStand(state, sampleRoute(path, elapsed))).toBe(true);
        }
    });
    it('keeps adjacent buildings solid and connects their exposed front entrances', () => {
        const state = fixture(); state.items = [item('a', 'library', 0, 2), item('b', 'library', 2, 2)];
        expect(canStand(state, { x: 1.5, z: 2.5 })).toBe(false);
        for (const building of state.items) expect(pathToActivity(state, homeCell, building)).toBeDefined();
        const path = route(state, { x: 4, z: 2 }, { x: 0, z: 4 })!;
        expect(path).toBeDefined();
        for (let elapsed = 0; elapsed < routeDuration(path); elapsed += 20) expect(canStand(state, sampleRoute(path, elapsed))).toBe(true);
    });
    it('rejects activity in a disconnected pocket even when a resident starts inside it', () => {
        const state = fixture();
        state.items = [0, 1, 2, 3, 4, 5].map(x => item(`wall${x}`, 'bench', x, 2));
        const flower = item('flower', 'flower', 2, 4); state.items.push(flower);
        expect(pathToActivity(state, { x: 3, z: 4 }, flower)).toBeUndefined();
    });
    it('walks through the arch opening without crossing its diagonal posts', () => {
        const state = fixture(), arch = item('arch', 'flower-arch', 3, 3); state.items = [arch];
        expect(canStand(state, { x: 3.43, z: 3.43 })).toBe(false);
        expect(canStand(state, { x: 3, z: 3 })).toBe(true);
        const path = pathToActivity(state, homeCell, arch)!;
        expect(path).toBeDefined();
        for (let elapsed = 0; elapsed < routeDuration(path); elapsed += 20) expect(canStand(state, sampleRoute(path, elapsed))).toBe(true);
    });
    it('invalidates reused routes for in-place placement, type, storage and land edits', () => {
        const state = fixture(), from = { x: 0, z: 3 }, to = { x: 1, z: 3 };
        const clear = route(state, from, to)!;
        state.items.push(item('movable', 'flower', 1, 3));
        expect(route(state, from, to)).toBeUndefined();
        state.items[0].cell!.x = 2;
        expect(route(state, from, to)).toEqual(clear);
        state.items[0].kind = 'library';
        expect(canStand(state, { x: 3, z: 3 })).toBe(false);
        delete state.items[0].cell;
        expect(canStand(state, { x: 3, z: 3 })).toBe(true);
        expect(canStand(state, { x: -2, z: 3 })).toBe(false);
        state.expanded = 'west';
        expect(canStand(state, { x: -2, z: 3 })).toBe(true);
        state.extraLand = ['east'];
        expect(canStand(state, { x: 7, z: 3 })).toBe(true);
        state.extraLand[0] = 'south';
        expect(canStand(state, { x: 7, z: 3 })).toBe(false);
        expect(canStand(state, { x: 0, z: 7 })).toBe(true);
        state.extraLand = ['east'];
        expect(canStand(state, { x: 8, z: 3 })).toBe(true);
    });
    it('keeps returned paths independent and separates avoid cells and different worlds', () => {
        const state = fixture(), from = { x: 0, z: 3 }, to = { x: 1, z: 3 };
        const expected = route(state, from, to)!;
        const borrowed = route(state, from, to)!; borrowed[0].x = 99;
        expect(route(state, from, to)).toEqual(expected);
        expect(route(state, from, to, [to])).toBeUndefined();
        const other = fixture(); other.items = [item('wall', 'bench', 1, 3)];
        expect(route(other, from, to)).toBeUndefined();
        expect(route(state, from, to)).toEqual(expected);
        state.now += 12345;
        expect(route(state, from, to)).toEqual(expected);
    });
    it('measures physical distance and safely resumes fractional origins', () => {
        const state = fixture(), path = route(state, { x: 4.125, z: 3 }, { x: 5, z: 3 })!;
        expect(routeLength(path)).toBe(.875);
        expect(routeDuration(path)).toBe(.875 * LIFE_STEP_MS);
        expect(sampleRoute(path, .375 * LIFE_STEP_MS)).toEqual({ x: 4.5, z: 3 });
        const legacy = { ...state, placementVersion: undefined };
        expect(route(legacy, { x: 4, z: 3 }, { x: 5, z: 3 })).toEqual([{ x: 4, z: 3 }, { x: 5, z: 3 }]);
    });
});
