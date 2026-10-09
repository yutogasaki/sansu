import * as T from 'three';
import { makePokomokoRig } from '../three/islandCharacters';
import { IslandMaterials } from '../three/primitives';
import { buildGardenGround } from '../three/garden/garden';
import { buildGardenCottage } from '../three/garden/cottage';
import { applyGardenLight } from '../three/garden/lighting';
import type { GardenTime } from '../three/garden/presentation';
import { soilAt } from '../../../domain/growingIsland/environment';
import type { GrowingState } from '../../../domain/growingIsland';
import { wrapPokomoko } from './actors';
import { GrowingLife } from './growingLife';
import { sceneLayout, type SceneLayout } from './sceneLayout';

/** Lights, sea, garden ground, Pokomoko's cottage and the living layer, shared by one world. */
export function createWorldScene(renderer: T.WebGLRenderer) {
    const scene = new T.Scene();
    const hemi = new T.HemisphereLight('#fff7ea', '#63806c', 1.15); scene.add(hemi);
    const sun = new T.DirectionalLight('#fff4e0', 2.3); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7 });
    sun.shadow.normalBias = .025; sun.shadow.bias = -.0002; scene.add(sun);
    // Build the same original hero without the old world's unused rabbit/otter rigs.
    // Life owns the hero geometry; this scene owns the shared material cache.
    const m = new IslandMaterials('moon-garden');
    const hero = makePokomokoRig(m);
    const life = new GrowingLife(m, wrapPokomoko(hero.hero, hero.heroBody, hero.heroFeet));
    scene.add(life.root);
    const cottage = buildGardenCottage();
    let ground: ReturnType<typeof buildGardenGround> | undefined, groundKey = '';
    let time: GardenTime = 'day';

    const setGround = (state: GrowingState, layout: SceneLayout) => {
        if (layout.key === groundKey && ground) return;
        ground?.root.removeFromParent(); ground?.dispose();
        ground = buildGardenGround({ bounds: layout.bounds, moisture: cell => soilAt(state, cell) }, layout.point);
        // The shared garden's 40-unit sea was sized for the old five expansions.
        // Larger districts still need sea behind the whole zoomed-out camera.
        if (layout.width + layout.depth > 26) {
            const sea = ground.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
            const size = (layout.width + layout.depth) * 12;
            sea.geometry.dispose(); sea.geometry = new T.PlaneGeometry(size, size);
            // Keep waves at the original world scale when widening the water plane.
            sea.material.vertexShader = sea.material.vertexShader.replace('p=uv;', 'p=position.xy/40.+.5;');
            sea.material.needsUpdate = true;
        }
        groundKey = layout.key; scene.add(ground.root); ground.setTime(time);
        cottage.root.position.set(2.5 - layout.center, .035, -1.5); cottage.root.scale.setScalar(.8);
        if (!cottage.root.parent) scene.add(cottage.root);
        cottage.root.traverse(o => { o.userData.objectId = 'house'; });
    };

    return {
        scene, m, life, hemi, sun,
        layout: (state: GrowingState) => { const layout = sceneLayout(state); setGround(state, layout); return layout; },
        setTime(next: GardenTime) {
            time = next; applyGardenLight(scene, renderer, hemi, sun, next);
            ground?.setTime(next); cottage.setTime(next);
        },
        animate(at: number, reduced: boolean) { ground?.animate(at, reduced); },
        dispose() {
            life.dispose(); ground?.dispose(); cottage.dispose(); m.dispose();
        },
    };
}
export type WorldScene = ReturnType<typeof createWorldScene>;
