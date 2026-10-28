import { afterEach, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { setTerrainForm } from '../../../domain/growingIsland/terraceTerrain';
import { terracePlanOf } from '../../../domain/growingIsland/editableTerrainWorld';
import type { Cell } from '../../../domain/growingIsland/types';
import { IslandMaterials } from '../three/primitives';
import { GrowingLife } from './growingLife';
import { sceneLayout } from './sceneLayout';
import { buildObjectLayer } from './objectLayer';

afterEach(() => setTerrainForm('continuous'));

it('climbs the stair ramp onto a bench that fills a three-step pad instead of jumping up', () => {
    setTerrainForm('terrace');
    const state = newIsland('terrace-seat', 0);
    state.tutorial = 'done'; state.plots = []; state.keepsakes = [];
    state.landmarks = [{ id: 'pad-bench', kind: 'bench', cell: { x: 4, z: 3 } }];
    state.terrain = { version: 1, heights: { '4,3': 3 }, undo: [], redo: [] };
    const m = new IslandMaterials('moon-garden');
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(m, actor), layout = sceneLayout(state, true), layer = buildObjectLayer(m, state, layout);
    try {
        life.sync(state, layout, layer);
        const walker = (life as unknown as { walkers: Map<string, { at: Cell; path: Cell[]; mode: string; until: number; choice?: string }> }).walkers.get('pokomoko')!;
        // The only way onto the pad is its stair; the walk ends at the stair's foot.
        const [stair] = terracePlanOf(layout.world)!.stairs, foot = stair.lower;
        expect(stair.upper).toEqual({ x: 4, z: 3 });
        walker.at = { x: foot.x + (foot.x - 4) * .2, z: foot.z + (foot.z - 3) * .2 }; walker.path = [{ ...foot }]; walker.mode = 'walk'; walker.choice = 'seat:4,3';
        life.tick(10, 0, true, false);
        const heights = [actor.root.position.y];
        for (let frame = 1; frame <= 90; frame++) { life.tick(10 + frame * 16, 16, true, false); heights.push(actor.root.position.y); }
        expect(walker.mode).toBe('seat');
        const top = layout.heightAt({ x: 4, z: 3 }), ground = heights[0];
        const steps = heights.slice(1).map((y, i) => Math.abs(y - heights[i]));
        // Sitting lifts the body by the seat (.16) as on flat ground; the three steps (.54) come along the ramp.
        expect(Math.max(...steps)).toBeLessThan(.17);
        expect(heights.filter(y => y > ground + .17 && y < top + .15).length).toBeGreaterThan(10);
        expect(heights.at(-1)!).toBeGreaterThan(top);
    } finally { life.dispose(); layer.dispose(); m.dispose(); }
});

it('jumps a two-step cliff in an arc instead of sliding up the wall (spec 52 §1.5)', () => {
    setTerrainForm('terrace');
    const state = newIsland('terrace-jump', 0);
    state.tutorial = 'done'; state.plots = []; state.keepsakes = []; state.landmarks = [];
    state.terrain = { version: 1, heights: { '4,3': 2 }, undo: [], redo: [] };
    const m = new IslandMaterials('moon-garden');
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(m, actor), layout = sceneLayout(state, true), layer = buildObjectLayer(m, state, layout);
    try {
        life.sync(state, layout, layer);
        expect(terracePlanOf(layout.world)!.stairs).toEqual([]);
        expect(layout.world.neighbors({ x: 4, z: 3 }, 'walk')).toContainEqual({ x: 3, z: 3 });
        const walker = (life as unknown as { walkers: Map<string, { at: Cell; path: Cell[]; mode: string; until: number }> }).walkers.get('pokomoko')!;
        walker.at = { x: 3, z: 3 }; walker.path = [{ x: 4, z: 3 }]; walker.mode = 'walk'; walker.until = Infinity;
        const low = layout.heightAt({ x: 3, z: 3 }), high = layout.heightAt({ x: 4, z: 3 }), heights: number[] = [];
        for (let frame = 0; frame <= 60 && walker.path.length; frame++) { life.tick(10 + frame * 16, 16, false, false); heights.push(actor.root.position.y); }
        expect(walker.at).toEqual({ x: 4, z: 3 });
        // Mid-jump the body is above the top, then it lands on it: no step up the cliff face.
        expect(Math.max(...heights)).toBeGreaterThan(high + .1);
        const steps = heights.slice(1).map((y, i) => Math.abs(y - heights[i]));
        expect(Math.max(...steps)).toBeLessThan((high - low) * .6);
    } finally { life.dispose(); layer.dispose(); m.dispose(); }
});
