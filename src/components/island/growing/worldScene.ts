import * as T from 'three';
import { buildHomeJourney } from '../homeJourney/scene';
import { buildGardenGround } from '../life/fantasy/garden';
import { buildGardenCottage } from '../life/fantasy/cottage';
import { applyGardenLight } from '../life/fantasy/lighting';
import type { GardenTime } from '../life/fantasy/presentation';
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
    // Pokomoko's model and the shared material cache come from the existing home journey rig.
    const content = buildHomeJourney(undefined, { residentsOnly: true, naturalOtter: true });
    const m = content.m;
    const life = new GrowingLife(m, wrapPokomoko(content.hero, content.heroBody, content.heroFeet));
    content.rabbit.pose.removeFromParent(); content.otter.pose.removeFromParent();
    scene.add(life.root);
    const cottage = buildGardenCottage();
    let ground: ReturnType<typeof buildGardenGround> | undefined, groundKey = '';
    let time: GardenTime = 'day';

    const setGround = (state: GrowingState, layout: SceneLayout) => {
        if (layout.key === groundKey && ground) return;
        ground?.root.removeFromParent(); ground?.dispose();
        ground = buildGardenGround({ bounds: layout.bounds, moisture: cell => soilAt(state, cell) }, layout.point);
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
            life.dispose(); ground?.dispose(); cottage.dispose(); content.dispose();
        },
    };
}
export type WorldScene = ReturnType<typeof createWorldScene>;
