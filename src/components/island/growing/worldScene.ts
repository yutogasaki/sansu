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
import { buildEditableGround } from './editableGround';
import { editableGroundDecorationKey, editableGroundDetailSupported } from './editableGroundDetails';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import { buildNativeGrowingGround } from './native/nativeGrowingGround';
import { nativeGrowingLighting } from './native/nativeGrowingLighting';
import { curveGroundGeometry } from './curvedGeometry';
import type { IslandWorld as CompiledWorld } from '../../../domain/growingIsland/worldDefinition';
import { buildAuthoredGrowingGround, buildAuthoredGrowingSea, type AuthoredCoastSkin } from './native/authoredGrowingGround';
import { authoredWorldFrame } from '../../../domain/growingIsland/authoredWorldFrame';
import type { AuthoredWaterBridgeSkin } from './native/authoredWaterBridgeArt';
import type { AuthoredShoulderProfile } from '../../../domain/growingIsland/authoredShoulderWorld';
import type { NativeAuthoredShoulder } from './native/nativeAuthoredShoulder';
import type { AuthoredGrowthTerrainCatalog } from '../../../domain/growingIsland/authoredGrowthTerrain';

/** Lights, sea, garden ground, Pokomoko's cottage and the living layer, shared by one world. */
export function createWorldScene(renderer: T.WebGLRenderer, native?: NativeGrowingKit, authored?: CompiledWorld, coast?: AuthoredCoastSkin, waterAssembly = false, bridgeSkin?: AuthoredWaterBridgeSkin, coveAssembly = false, shoulder?: AuthoredShoulderProfile, shoulderArt?: NativeAuthoredShoulder, growthTerrain?: AuthoredGrowthTerrainCatalog) {
    const options = { water: waterAssembly, cove: coveAssembly, ...(shoulder ? { shoulder } : {}), ...(growthTerrain ? { growthTerrain } : {}) };
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
    const nativeCottage = native?.cottage(authored ? .45 : undefined);
    const lighting = native ? nativeGrowingLighting(scene, renderer, hemi, sun) : undefined;
    let ground: ReturnType<typeof buildGardenGround> | ReturnType<typeof buildAuthoredGrowingSea> | undefined, groundKey = '';
    let terrain: ReturnType<typeof buildPlaceGround> | ReturnType<typeof buildAuthoredGrowingGround> | undefined;
    let previewTerrain: ReturnType<typeof buildAuthoredGrowingGround> | undefined, previewKey = '';
    let time: GardenTime = 'day';
    const addShoulderSoil = (ground: ReturnType<typeof buildAuthoredGrowingGround>, layout: SceneLayout) => {
        const soil = shoulderArt?.instanceSoil(layout);
        if (soil) ground.root.add(soil);
    };
    const nativeSeaTime = () => {
        if (!native || !ground) return;
        const sea = ground.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
        sea.material.uniforms.deep.value.set(time === 'night' ? '#527ba7' : time === 'dusk' ? '#658cb7' : '#388daf');
        sea.material.uniforms.shallow.value.set(time === 'night' ? '#86b9d3' : '#79d4d0');
        sea.material.uniforms.magic.value = .22;
    };

    const setGround = (state: GrowingState, layout: SceneLayout) => {
        const nextGroundKey = layout.editable ? `${layout.key}:owners:${editableGroundDecorationKey(state)}` : layout.key;
        if (nextGroundKey === groundKey && ground) return;
        ground?.root.removeFromParent(); ground?.dispose();
        terrain?.root.removeFromParent(); terrain?.dispose();
        if (layout.authored) {
            ground = buildAuthoredGrowingSea(layout);
            terrain = buildAuthoredGrowingGround(layout, coast, bridgeSkin);
            addShoulderSoil(terrain, layout);
        } else {
            ground = buildGardenGround({ bounds: layout.bounds, moisture: cell => soilAt(state, cell), shelterTree: !native && !layout.editable && layout.artMargin <= 1.1, heightAt: layout.heightAt,
                ...(layout.editable ? { supportsDetail: (cell, radius) => editableGroundDetailSupported(layout, cell, radius, state) } : {}) }, layout.point);
            curveGroundGeometry(ground.root.getObjectByName('garden-ground-details')!, layout);
            terrain = layout.editable ? buildEditableGround(layout, native?.manifest.shoreProfile, state.bridge?.x) : native ? buildNativeGrowingGround(layout, native.manifest.shoreProfile) : buildPlaceGround(layout);
            if (layout.editable) {
                ground.root.getObjectByName('garden-island-pedestal')!.visible = false;
            }
        }
        scene.add(terrain.root);
        if (!layout.authored && (layout.artMargin > 1.1 || native)) {
            // The named decorative pedestal is separate from sea and floor planting.
            // The shared triangulated floor and its irregular bank now carry the island.
            ground.root.getObjectByName('garden-island-pedestal')!.visible = false;

        }
        const shadowSpan = Math.max(9, layout.width / 2 + layout.artMargin, layout.depth / 2 + layout.artMargin);
        Object.assign(sun.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan });
        sun.shadow.camera.updateProjectionMatrix();
        // The shared garden's 40-unit sea was sized for the old five expansions.
        // Larger districts still need sea behind the whole zoomed-out camera.
        if (!layout.authored && (native || layout.artMargin > 1.1 || layout.width + layout.depth > 26)) {
            const sea = ground.root.getObjectByName('life-sea') as T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
            const size = Math.max(160, (layout.width + layout.depth + layout.artMargin * 2) * 12);
            sea.geometry.dispose(); sea.geometry = new T.PlaneGeometry(size, size);
            // Keep waves at the original world scale when widening the water plane.
            sea.material.vertexShader = sea.material.vertexShader.replace('p=uv;', 'p=position.xy/40.+.5;');
            sea.material.needsUpdate = true;
        }
        groundKey = nextGroundKey; scene.add(ground.root); ground.setTime(time);
        nativeSeaTime();
        const house = nativeCottage ?? cottage.root;
        if (layout.authored) {
            const anchor = { x: 2.5, z: .5 };
            if (!layout.world.floorAt(anchor)) throw Error('Authored cottage has no physical floor');
            house.position.copy(layout.point(anchor, 0)); house.scale.setScalar(nativeCottage ? .45 : .8);
        } else {
            house.position.set(2.5 - layout.center, .035, -1.5); if (!nativeCottage) house.scale.setScalar(.8);
        }
        if (!house.parent) scene.add(house);
        house.traverse(o => { o.userData.objectId = 'house'; });
    };

    const clearPreview = () => {
        previewTerrain?.root.removeFromParent(); previewTerrain?.dispose(); previewTerrain = undefined; previewKey = '';
        if (terrain) terrain.root.visible = true;
        life.root.visible = true;
    };

    return {
        scene, m, life, hemi, sun, house: nativeCottage ?? cottage.root,
        hasWaterPreview: () => Boolean(previewTerrain),
        shoulderSoil: () => terrain?.root.getObjectByName('authored-shoulder-soil'),
        showWaterPreview(future?: GrowingState) {
            if (!authored || !(waterAssembly || coveAssembly || shoulder || growthTerrain) || !future) { clearPreview(); return undefined; }
            const frame = authoredWorldFrame(future, authored, options);
            if (`${frame.world.id}:${frame.revision}` === groundKey) { clearPreview(); return undefined; }
            if (previewKey === frame.revision) return previewKey;
            clearPreview();
            const layout = sceneLayout(future, Boolean(native), frame.world, frame.waterPlan, authored, { options, covePlan: frame.covePlan, revision: frame.revision });
            previewTerrain = buildAuthoredGrowingGround(layout, coast, bridgeSkin); previewKey = frame.revision;
            addShoulderSoil(previewTerrain, layout);
            scene.add(previewTerrain.root); if (terrain) terrain.root.visible = false;
            // A prospective floor is a static editing view. Live visitors retain
            // their committed routes and receipts and return unchanged on cancel.
            life.root.visible = false;
            return previewKey;
        },
        groundAt(ray: T.Raycaster) { return terrain ? ray.intersectObject(terrain.floor, false)[0]?.point : undefined; },
        layout: (state: GrowingState) => {
            clearPreview();
            const frame = authored && (waterAssembly || coveAssembly || shoulder || growthTerrain) ? authoredWorldFrame(state, authored, options) : undefined;
            const layout = sceneLayout(state, Boolean(native), frame?.world ?? authored, frame?.waterPlan, authored,
                frame ? { options, covePlan: frame.covePlan, revision: frame.revision } : undefined); layout.nativeArt = Boolean(native); setGround(state, layout);
            // ObjectLayer is attached immediately after layout(). Resolve it lazily
            // so this new frame contains the newly built owners and derived rooms.
            layout.cameraObjects = () => [previewTerrain?.root ?? terrain?.root, nativeCottage ?? cottage.root,
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
            clearPreview(); life.dispose(); ground?.dispose(); terrain?.dispose(); cottage.dispose(); m.dispose(); lighting?.dispose(); native?.dispose();
        },
    };
}
export type WorldScene = ReturnType<typeof createWorldScene>;
