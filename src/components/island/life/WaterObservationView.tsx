import { waterSurfacePoint } from '../../../domain/islandLife/waterMagic';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import * as T from 'three';
import type { LifeItem } from '../../../domain/islandLife/model';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { buildLifeItem } from './itemGeometry';
import { visibleRelationObject } from './relationVisibility';
import { buildWaterMagic, validWaterPoint, WATER_MAGIC_MS, WATER_RIPPLE_MS, WATER_RETRY_MS } from './waterMagic';

export default function WaterObservationView({ item, conditionKey, prepare, presented }: {
    item: LifeItem; conditionKey?: string; prepare?: (point: [number, number]) => Promise<DiscoveryScene | undefined>;
    presented?: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    const host = useRef<HTMLButtonElement>(null), trigger = useRef<(event: MouseEvent) => void>(() => {});
    const callbacks = useRef({ prepare, presented });
    const [failed, setFailed] = useState(false);
    useEffect(() => { callbacks.current = { prepare, presented }; }, [prepare, presented]);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
        const materials = new IslandMaterials(), scene = new T.Scene(), model = buildLifeItem(item, materials), magic = buildWaterMagic();
        const water = model.root.getObjectByName('life-bowl-water')!;
        scene.add(model.root, magic.root, new T.HemisphereLight('#fff7df', '#698f71', 2.4));
        const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
        const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 20), ray = new T.Raycaster();
        camera.position.set(1, 1.65, 2.4); camera.lookAt(0, .18, 0); camera.updateMatrixWorld(true);
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
        renderer.domElement.setAttribute('aria-hidden', 'true'); node.append(renderer.domElement);
        let started: number | undefined, cooldown = 0, generation = 0, preparing = false, raf = 0, alive = true;
        let point: [number, number] = [0, 0], event: DiscoveryScene | undefined, evidence: DiscoveryPresentation | undefined;
        const cancel = () => { generation++; preparing = false; started = undefined; event = undefined; evidence?.cancel(); evidence = undefined; magic.root.visible = false; delete node.dataset.magic; };
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const resize = () => {
            const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight);
            renderer.setSize(width, height); camera.left = -.65 * width / height; camera.right = -camera.left;
            camera.top = .65; camera.bottom = -.65; camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize); observer.observe(node); resize();
        trigger.current = click => {
            if (preparing || event || performance.now() < cooldown || document.visibilityState !== 'visible' || renderer.getContext().isContextLost()) return;
            let hitPoint: [number, number] = [0, 0];
            if (click.detail !== 0) {
                const rect = node.getBoundingClientRect();
                ray.setFromCamera(new T.Vector2((click.clientX - rect.left) / rect.width * 2 - 1, 1 - (click.clientY - rect.top) / rect.height * 2), camera);
                model.root.updateMatrixWorld(true);
                const hit = ray.intersectObject(model.root, true)[0]; if (!hit) return;
                const local = model.root.worldToLocal(hit.point.clone()); hitPoint = waterSurfacePoint(local.x, local.z);
            }
            if (!validWaterPoint(hitPoint)) return;
            if (!conditionKey) { point = hitPoint; started = performance.now(); return; }
            preparing = true; const token = ++generation;
            void callbacks.current.prepare?.(hitPoint).then(next => {
                if (!alive || token !== generation) return;
                preparing = false;
                const touch = next?.snapshot.scene.waterTouch;
                if (next?.ruleId === 'M4' && touch?.itemId === item.id && validWaterPoint(touch.point)) {
                    point = [...touch.point]; event = next; evidence = new DiscoveryPresentation(next);
                }
            }).catch(() => { if (alive && token === generation) preparing = false; });
        };
        const frame = () => {
            if (!alive) return;
            const at = performance.now(), foreground = document.visibilityState === 'visible';
            const rect = node.getBoundingClientRect();
            const onScreen = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
            const unoccluded = onScreen && [[.2,.2],[.8,.2],[.5,.5],[.2,.8],[.8,.8]].every(([x,y]) => node.contains(document.elementFromPoint(rect.left+rect.width*x,rect.top+rect.height*y)));
            if (foreground && !renderer.getContext().isContextLost()) {
                if (event && started === undefined && unoccluded) started = at;
                const elapsed = started === undefined ? -1 : at - started;
                magic.sample(elapsed, Boolean(event), point, media.matches);
                if (started !== undefined && elapsed >= (event ? WATER_MAGIC_MS : WATER_RIPPLE_MS)) { const wasMagic = Boolean(event); cancel(); cooldown = wasMagic ? at + WATER_RETRY_MS : 0; }
                renderer.render(scene, camera); node.dataset.rendered = 'true'; node.dataset.ripple = String(magic.root.visible);
                node.dataset.waterView = JSON.stringify({ point, elapsed, eventId: event?.eventId, camera: { projection: camera.projectionMatrix.elements, view: camera.matrixWorldInverse.elements } });
                if (event) {
                    node.dataset.magic = 'water-stars';
                    const core = magic.root.visible && elapsed >= 250 && elapsed < WATER_MAGIC_MS - 500 && visibleRelationObject(water, model.root, camera, ndc =>
                        node.contains(document.elementFromPoint(rect.left+(ndc.x+1)*rect.width/2,rect.top+(1-ndc.y)*rect.height/2)));
                    const shown = evidence?.sample(at, Date.now(), { rendered: true, foreground, onScreen, unoccluded, preview: false, coreShown: core });
                    if (shown) callbacks.current.presented?.(event, shown);
                }
            }
            raf = requestAnimationFrame(frame);
        };
        frame();
        const hidden = () => { if (document.visibilityState !== 'visible') cancel(); };
        const lost = (e: Event) => { e.preventDefault(); cancel(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => { setFailed(false); resize(); };
        document.addEventListener('visibilitychange', hidden); renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        return () => {
            alive = false; cancel(); trigger.current = () => {}; cancelAnimationFrame(raf); observer.disconnect();
            document.removeEventListener('visibilitychange', hidden); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            disposeGeometry(model.root); magic.dispose(); materials.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
        };
        // A routine owner refresh must not restart a five-second episode. Its
        // actual pair/placement changes are represented by conditionKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id, item.style, conditionKey]);
    return <><button ref={host} type="button" className="life-observation-view" aria-label="水に ふれてみる" onClick={event => trigger.current(event)} />
        <p className="life-observation-hint">{failed ? '水ばちを ひらけなかったよ。' : '水に そっと ふれてみよう'}</p></>;
}
