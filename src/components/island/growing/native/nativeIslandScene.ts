import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extendNativeSea, reflectNativeSea } from './nativeWater';
import { guardNativeTransmission } from './nativeTransmission';
import { nativeIslandView, type NativeIslandLight, type NativeIslandView } from './nativeIslandViews';
import { NATIVE_ISLAND_ART_STATES, nativeMatureManifest as manifest, type NativeIslandArtState } from './nativeIslandArtAssets';

function disposeModel(root: T.Object3D, withMaterials: boolean) {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        geometries.add(object.geometry);
        if (withMaterials) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
        }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
}

/** Stage A: the actual app renders the authored whole island, before gameplay mapping. */
export function createNativeIslandScene(host: HTMLDivElement, onReady: () => void, onError: (error: unknown) => void,
    onView: (view: NativeIslandView) => void, state: NativeIslandArtState = 'grown') {
    const art = NATIVE_ISLAND_ART_STATES[state];
    const renderer = new T.WebGLRenderer({ antialias: true });
    const scene = new T.Scene(); scene.background = new T.Color('#b4c7df');
    const camera = new T.OrthographicCamera(-20, 20, 15, -15, .1, 180);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    renderer.info.autoReset = false;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0; canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', `${art.label}の3D美術。ドラッグで見回し、ピンチで拡大できます`);
    canvas.dataset.graphicsQuality = 'native-reference';
    host.append(canvas);
    host.dataset.artCandidate = art.candidate;
    host.dataset.sourceSha256 = manifest.sourceSha256; host.dataset.modelSha256 = art.sha256;
    delete host.dataset.loadedModelSha256;
    host.dataset.modulePackSha256 = manifest.modelSha256;
    host.dataset.artStage = state; host.dataset.gameplayMapped = 'false'; host.dataset.loading = 'true';
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false; controls.minZoom = .55; controls.maxZoom = 4;
    controls.minPolarAngle = .24; controls.maxPolarAngle = 1.37; controls.enablePan = true;
    const sky = new T.HemisphereLight('#d5e6ff', '#b9afb6', 1.4); scene.add(sky);
    const sun = new T.DirectionalLight('#ffdbc3', 1.8);
    sun.position.set(-16, 32, 22); sun.target.position.set(3, 2, -6); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 110 });
    sun.shadow.bias = -.00035; sun.shadow.normalBias = .03; sun.shadow.intensity = .55; scene.add(sun);
    const fill = new T.DirectionalLight('#b9d6ff', 1.1); fill.position.set(12, 18, -14); scene.add(fill);
    const skyPixels = new Float32Array(64 * 32 * 4), horizon = new T.Color('#e8c4d0'), zenith = new T.Color('#91bada'), lower = new T.Color('#9fbed1');
    for (let y = 0; y < 32; y++) {
        const elevation = Math.cos((y / 31) * Math.PI);
        const color = horizon.clone().lerp(elevation > 0 ? zenith : lower, Math.pow(Math.abs(elevation), .5));
        for (let x = 0; x < 64; x++) skyPixels.set([color.r, color.g, color.b, 1], (y * 64 + x) * 4);
    }
    const skyMap = new T.DataTexture(skyPixels, 64, 32, T.RGBAFormat, T.FloatType);
    skyMap.mapping = T.EquirectangularReflectionMapping; skyMap.colorSpace = T.LinearSRGBColorSpace; skyMap.needsUpdate = true;
    const pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromEquirectangular(skyMap);
    scene.environment = environment.texture; scene.environmentIntensity = .4; skyMap.dispose(); pmrem.dispose();
    const lamps: T.PointLight[] = [], glow = new Map<T.MeshStandardMaterial, number>(), reflectors: ReturnType<typeof reflectNativeSea>[] = [];
    const modules = new T.Group(); modules.name = 'native05-art-modules'; scene.add(modules);
    let alive = true, frame = 0, view: NativeIslandView = 'whole', lighting: NativeIslandLight = 'day', ready = false, failed = false;
    const abort = new AbortController();
    const draw = () => {
        if (!alive || failed || frame || document.visibilityState !== 'visible') return;
        frame = requestAnimationFrame(() => {
            frame = 0; if (!alive) return;
            try {
                renderer.info.reset();
                for (const reflector of reflectors) reflector.update();
                // Keep transmission and reflection in separate renders. The native
                // shape, materials, lights and camera do not depend on bloom.
                renderer.render(scene, camera);
                host.dataset.camera = JSON.stringify({ position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom,
                    frustum: [camera.left, camera.right, camera.top, camera.bottom] });
                host.dataset.renderStats = JSON.stringify({ scope: 'resources-only', materialBatches: modules.children.length,
                    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, ratio: renderer.getPixelRatio() });
                host.dataset.renderedView = view; host.dataset.renderedLight = lighting; host.dataset.renderedArtStage = state;
                if (!ready && modules.children.length) { ready = true; host.dataset.loading = 'false'; onReady(); }
            } catch (error) { failed = true; host.dataset.loading = 'failed'; onError(error); }
        });
    };
    const resize = () => {
        const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight), aspect = width / height;
        const span = nativeIslandView(view, state).span;
        const halfHeight = Math.max(span * .38, span / (2 * aspect));
        camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
        camera.updateProjectionMatrix(); renderer.setSize(width, height, false); draw();
    };
    const showView = (next: NativeIslandView) => {
        view = next; host.dataset.view = next; onView(next);
        const authored = nativeIslandView(next, state); camera.position.fromArray(authored.position); controls.target.fromArray(authored.target);
        camera.zoom = 1; controls.update(); resize();
    };
    const showLight = (next: NativeIslandLight) => {
        lighting = next; const day = next === 'day';
        sky.color.set(day ? '#e8f4ff' : '#d5e6ff'); sun.color.set(day ? '#fff2dd' : '#ffdbc3');
        sun.intensity = day ? 2 : 1.7; fill.intensity = day ? .85 : 1.1;
        for (const lamp of lamps) lamp.intensity = day ? .2 : 1.5;
        for (const [material, strength] of glow) material.emissiveIntensity = strength * (day ? .1 : 1);
        host.dataset.lighting = next; renderer.shadowMap.needsUpdate = true; draw();
    };
    const zoom = (factor: number) => { camera.zoom = T.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom); camera.updateProjectionMatrix(); draw(); };
    controls.addEventListener('change', draw);
    const observer = new ResizeObserver(resize); observer.observe(host);
    document.addEventListener('visibilitychange', draw, { signal: abort.signal });
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); if (alive) { failed = true; host.dataset.loading = 'failed'; onError(new Error('WebGL context lost')); }
    }, { signal: abort.signal });
    canvas.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
        else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
        else if (event.key === 'Home') { event.preventDefault(); showView('whole'); }
        else if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            const spherical = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
            if (event.key === 'ArrowLeft') spherical.theta -= .12;
            if (event.key === 'ArrowRight') spherical.theta += .12;
            if (event.key === 'ArrowUp') spherical.phi -= .09;
            if (event.key === 'ArrowDown') spherical.phi += .09;
            spherical.phi = T.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
            camera.position.copy(new T.Vector3().setFromSpherical(spherical).add(controls.target)); controls.update();
        }
    }, { signal: abort.signal });
    showView('whole'); showLight('day');

    void (async () => {
        let source: T.Group | undefined;
        const pendingGeometries = new Set<T.BufferGeometry>();
        try {
            const response = await fetch(art.url, { signal: abort.signal });
            if (!response.ok) throw new Error(`Native model load: ${response.status}`);
            const buffer = await response.arrayBuffer();
            const checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('');
            if (!alive) return;
            if (checksum !== art.sha256) throw new Error('The loaded native art does not match its authored revision.');
            host.dataset.loadedModelSha256 = checksum;
            const gltf = await new GLTFLoader().parseAsync(buffer, ''); source = gltf.scene;
            if (!alive) { disposeModel(source, true); return; }
            source.updateMatrixWorld(true);
            if (source.children.length !== art.roots) throw new Error('Native module manifest differs from the loaded model.');
            const buckets = new Map<T.MeshPhysicalMaterial, T.BufferGeometry[]>();
            const provenance = new Map<T.MeshPhysicalMaterial, Set<string>>();
            for (const [index, part] of source.children.entries()) {
                const id = state === 'grown' ? manifest.modules[manifest.meshModules[index]].id : String(part.userData.art_assembly || 'native05-growth');
                part.traverse(object => {
                    if (!(object instanceof T.Mesh)) return;
                    if (Array.isArray(object.material)) throw new Error('Unexpected native material array.');
                    const material = object.material as T.MeshPhysicalMaterial;
                    if (object.name.includes('cobalt_entry') || object.name.includes('cobalt entry')) {
                        const lamp = new T.PointLight('#ffcc93', 1.5, 3.2, 2);
                        lamp.position.copy(object.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, .4, .18))); lamps.push(lamp); scene.add(lamp);
                    }
                    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
                    pendingGeometries.add(geometry);
                    for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attribute)) geometry.deleteAttribute(attribute);
                    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
                    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
                    const bucket = buckets.get(material) ?? []; bucket.push(geometry); buckets.set(material, bucket);
                    const parts = provenance.get(material) ?? new Set<string>(); parts.add(id); provenance.set(material, parts);
                });
            }
            // Keep the source assemblies independent. The completed reference
            // batches across them by material, as the approved renderer does.
            // Replacing an assembly later rebuilds these batches from its parts.
            for (const [material, geometries] of buckets) {
                guardNativeTransmission(material);
                if (['window / pale blue glass', 'willow / pearl flower light'].includes(material.name)) glow.set(material, material.emissiveIntensity);
                let geometry = mergeGeometries(geometries);
                for (const item of geometries) { item.dispose(); pendingGeometries.delete(item); }
                if (!geometry) throw new Error(`Native attributes differ for ${material.name}.`);
                if (material.name === 'sea / tide and sky water') geometry = extendNativeSea(geometry);
                const mesh = new T.Mesh(geometry, material);
                // The low young relief is lit by its authored surface normals.
                // It receives real canopy/coast shadows; casting the fine top
                // into itself adds shadow-map acne along narrow coast triangles.
                mesh.castShadow = !material.name.startsWith('sea /') && material.name !== 'growth / living meadow colour' && !(material.transmission > .3);
                mesh.receiveShadow = true;
                if (material.name === 'sea / tide and sky water') reflectors.push(reflectNativeSea(mesh, renderer, scene, camera, controls.target));
                mesh.userData.nativeModules = [...provenance.get(material)!]; modules.add(mesh);
            }
            host.dataset.nativeModules = String(new Set([...provenance.values()].flatMap(parts => [...parts])).size); host.dataset.materialBatches = String(modules.children.length);
            host.dataset.sourceMeshes = String(art.meshes); host.dataset.referenceHouses = String(art.houses);
            host.dataset.sourceTriangles = String(art.triangles); disposeModel(source, false); source = undefined;
            showLight(lighting); draw();
        } catch (error) {
            for (const geometry of pendingGeometries) geometry.dispose();
            if (source) disposeModel(source, true);
            if (alive && !abort.signal.aborted) { failed = true; host.dataset.loading = 'failed'; onError(error); }
        }
    })();
    return {
        view: showView, light: showLight, zoom,
        dispose() {
            if (!alive) return; alive = false; abort.abort(); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
            for (const reflector of reflectors) reflector.dispose(); disposeModel(modules, true);
            environment.dispose(); sun.shadow.dispose();
            renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
        },
    };
}
export type NativeIslandScene = ReturnType<typeof createNativeIslandScene>;
