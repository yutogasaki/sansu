import * as T from 'three';
import type { AchievementId, GuidanceEvidence } from '../../../domain/growingIsland/types';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { retainSharedRendererCache } from '../three/sharedRendererCache';
import { guideMemoryModel } from './guideMemoryModels';
import { visibleBounds } from './menuMiniatures';

const cache = new Map<string, string>();
const pending = new Map<string, { id: AchievementId; evidence?: GuidanceEvidence; resolve: (value: string | undefined) => void; promise: Promise<string | undefined> }>();
let scheduled = false;

/** One temporary context per short batch. Only bounded static PNGs survive. */
export function guidePicture(id: AchievementId, evidence?: GuidanceEvidence): Promise<string | undefined> {
    const key = JSON.stringify({ id, evidence });
    const found = cache.get(key); if (found) return Promise.resolve(found);
    const queued = pending.get(key); if (queued) return queued.promise;
    let resolve!: (value: string | undefined) => void;
    const promise = new Promise<string | undefined>(done => { resolve = done; });
    pending.set(key, { id, evidence: evidence ? structuredClone(evidence) : undefined, resolve, promise });
    if (!scheduled) { scheduled = true; setTimeout(renderBatch, 0); }
    return promise;
}

function renderBatch() {
    scheduled = false;
    const jobs = [...pending.entries()]; pending.clear();
    let renderer: T.WebGLRenderer | undefined;
    let releaseSharedCache: (() => void) | undefined;
    const materials = new IslandMaterials();
    try {
        renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        releaseSharedCache = retainSharedRendererCache(materials.surface('#bfd6a4', .9));
        renderer.setSize(600, 400); renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        for (const [key, job] of jobs) {
            let model: T.Group | undefined;
            try {
                model = job.evidence ? guideMemoryModel(materials, job.evidence) : undefined;
                if (!model) { job.resolve(undefined); continue; }
                const initial = new T.Box3().setFromObject(model), size = initial.getSize(new T.Vector3()), middle = initial.getCenter(new T.Vector3());
                const base = new T.Mesh(new T.CylinderGeometry(1, 1.02, .10, 48), materials.surface('#bfd6a4', .9));
                base.scale.set(Math.max(.5, size.x * .68), 1, Math.max(.4, size.z * .8));
                base.position.set(middle.x, initial.min.y - .055, middle.z); base.receiveShadow = true; model.add(base);
                model.traverse(object => { if (object instanceof T.Mesh && object !== base) object.castShadow = true; });
                const scene = new T.Scene(); scene.add(model, new T.HemisphereLight('#ffffff', '#b8a180', 2));
                const light = new T.DirectionalLight('#fff4df', 3); light.position.copy(middle).add(new T.Vector3(-3, 6, 4));
                light.target.position.copy(middle); light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
                const shadowSize = Math.max(2, size.length());
                Object.assign(light.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, far: shadowSize * 5 + 10 });
                light.shadow.bias = -.0005; light.shadow.normalBias = .015; scene.add(light, light.target);
                const box = new T.Box3().setFromObject(model), center = box.getCenter(new T.Vector3());
                const radius = Math.max(.1, box.getBoundingSphere(new T.Sphere()).radius);
                const camera = new T.OrthographicCamera(-radius * 1.65, radius * 1.65, radius * 1.1, -radius * 1.1, .01, radius * 20);
                camera.position.copy(center).add(new T.Vector3(1.3, 1.8, 3).normalize().multiplyScalar(radius * 5)); camera.lookAt(center);
                renderer.render(scene, camera);
                const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
                const context = canvas.getContext('2d'); if (!context) { job.resolve(undefined); continue; }
                context.drawImage(renderer.domElement, 0, 0);
                const bounds = visibleBounds(context.getImageData(0, 0, 600, 400).data, 600, 400);
                if (!bounds) { job.resolve(undefined); continue; }
                const scale = Math.min(552 / bounds.width, 360 / bounds.height);
                context.clearRect(0, 0, 600, 400);
                context.drawImage(renderer.domElement, bounds.left, bounds.top, bounds.width, bounds.height,
                    (600 - bounds.width * scale) / 2, (400 - bounds.height * scale) / 2, bounds.width * scale, bounds.height * scale);
                const url = canvas.toDataURL('image/png');
                light.shadow.map?.dispose();
                cache.set(key, url);
                while (cache.size > 32) cache.delete(cache.keys().next().value!);
                job.resolve(url);
            } catch { job.resolve(undefined); }
            finally { if (model) disposeGeometry(model); }
        }
    } catch { for (const [, job] of jobs) job.resolve(undefined); }
    finally { materials.dispose(); releaseSharedCache?.(); renderer?.dispose(); renderer?.forceContextLoss(); }
}
