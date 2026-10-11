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
import { buildPlaceGround } from './placeGround';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import { buildNativeGrowingGround } from './native/nativeGrowingGround';
import { nativeGrowingLighting } from './native/nativeGrowingLighting';

/** Lights, sea, garden ground, Pokomoko's cottage and the living layer, shared by one world. */
export function createWorldScene(renderer: T.WebGLRenderer, native?: NativeGrowingKit) {
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
    const nativeCottage = native?.cottage();
    const lighting = native ? nativeGrowingLighting(scene, renderer, hemi, sun) : undefined;
    let ground: ReturnType<typeof buildGardenGround> | undefined, groundKey = '';
    let terrain: ReturnType<typeof buildPlaceGround> | undefined;
    let time: GardenTime = 'day';
    const nativeSeaTime = () => {
        if (!native || !ground) return;
        const sea = ground.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
        sea.material.uniforms.deep.value.set(time === 'night' ? '#527ba7' : time === 'dusk' ? '#658cb7' : '#388daf');
        sea.material.uniforms.shallow.value.set(time === 'night' ? '#86b9d3' : '#79d4d0');
        sea.material.uniforms.magic.value = .22;
    };

    const setGround = (state: GrowingState, layout: SceneLayout) => {
        if (layout.key === groundKey && ground) return;
        ground?.root.removeFromParent(); ground?.dispose();
        terrain?.root.removeFromParent(); terrain?.dispose();
        ground = buildGardenGround({ bounds: layout.bounds, moisture: cell => soilAt(state, cell), shelterTree: !native && layout.artMargin <= 1.1, heightAt: layout.heightAt }, layout.point);
        terrain = native ? buildNativeGrowingGround(layout, native.manifest.shoreProfile) : buildPlaceGround(layout); scene.add(terrain.root);
        if (layout.artMargin > 1.1 || native) {
            // The named decorative pedestal is separate from sea and floor planting.
            // The shared triangulated floor and its irregular bank now carry the island.
            ground.root.getObjectByName('garden-island-pedestal')!.visible = false;

        }
        const shadowSpan = Math.max(9, layout.width / 2 + layout.artMargin, layout.depth / 2 + layout.artMargin);
        Object.assign(sun.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan });
        sun.shadow.camera.updateProjectionMatrix();
        // The shared garden's 40-unit sea was sized for the old five expansions.
        // Larger districts still need sea behind the whole zoomed-out camera.
        if (native || layout.artMargin > 1.1 || layout.width + layout.depth > 26) {
            const sea = ground.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
            const size = Math.max(160, (layout.width + layout.depth + layout.artMargin * 2) * 12);
            sea.geometry.dispose(); sea.geometry = new T.PlaneGeometry(size, size);
            // Keep waves at the original world scale when widening the water plane.
            sea.material.vertexShader = sea.material.vertexShader.replace('p=uv;', 'p=position.xy/40.+.5;');
            sea.material.needsUpdate = true;
        }
        groundKey = layout.key; scene.add(ground.root); ground.setTime(time);
        nativeSeaTime();
        const house = nativeCottage ?? cottage.root;
        house.position.set(2.5 - layout.center, .035, -1.5); if (!nativeCottage) house.scale.setScalar(.8);
        if (!house.parent) scene.add(house);
        house.traverse(o => { o.userData.objectId = 'house'; });
    };

    return {
        scene, m, life, hemi, sun,
        groundAt(ray: T.Raycaster) { return terrain ? ray.intersectObject(terrain.floor, false)[0]?.point : undefined; },
        layout: (state: GrowingState) => {
            const layout = sceneLayout(state); layout.nativeArt = Boolean(native); setGround(state, layout);
            // ObjectLayer is attached immediately after layout(). Resolve it lazily
            // so this new frame contains the newly built owners and derived rooms.
            layout.cameraObjects = () => [terrain?.root, nativeCottage ?? cottage.root,
                ground?.root.getObjectByName('garden-ground-details'), scene.getObjectByName('growing-objects')]
                .filter((object): object is T.Object3D => Boolean(object));
            return layout;
        },
        setTime(next: GardenTime) {
            time = next; applyGardenLight(scene, renderer, hemi, sun, next);
            lighting?.setTime(next);
            ground?.setTime(next); cottage.setTime(next);
            nativeSeaTime();
        },
        animate(at: number, reduced: boolean) { ground?.animate(at, reduced); },
        dispose() {
            life.dispose(); ground?.dispose(); terrain?.dispose(); cottage.dispose(); m.dispose(); lighting?.dispose(); native?.dispose();
        },
    };
}
export type WorldScene = ReturnType<typeof createWorldScene>;
