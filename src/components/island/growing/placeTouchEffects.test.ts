import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { PlaceTouchEffects } from './placeTouchEffects';
import { sceneLayout } from './sceneLayout';
import { newIsland } from '../../../domain/growingIsland/island';

it('bounds replies and audio, restores real leaves on replacement/cancel and keeps reduced motion still', () => {
    const scene = new T.Scene(), tone = vi.fn(), effects = new PlaceTouchEffects(scene, tone), state = newIsland('reply', 0), layout = sceneLayout(state);
    const owners = new T.Group(), leaf = new T.Mesh(new T.PlaneGeometry(.2, .3), new T.MeshBasicMaterial());
    leaf.name = 'real leaf'; leaf.position.copy(layout.point({ x: 0, z: 3 }, 1)); leaf.rotation.z = .2; owners.add(leaf);
    const play = { kind: 'leaves' as const, source: 'tree', replies: [{ id: 'tree', cell: { x: 0, z: 3 }, step: 0, delay: 0 }] };
    effects.start(play, layout, 0, () => true, false, owners); effects.tick(100, false);
    expect(leaf.rotation.z).not.toBe(.2); expect(tone).toHaveBeenCalledTimes(1);
    effects.tick(110, false); expect(tone).toHaveBeenCalledTimes(1);
    effects.clear(); expect(leaf.rotation.z).toBe(.2); expect(effects.root.children).toHaveLength(0);
    effects.start(play, layout, 200, () => true, true, owners); effects.tick(300, true); expect(leaf.rotation.z).toBe(.2);
    effects.tick(1100, true); expect(effects.root.children).toHaveLength(0);
    effects.start(play, layout, 1200, () => false, false, owners); effects.tick(1300, false); expect(effects.root.children).toHaveLength(0);
    effects.dispose(); expect(scene.children).toHaveLength(0); leaf.geometry.dispose(); leaf.material.dispose();
});
