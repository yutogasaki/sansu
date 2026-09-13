import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { growthStage, plantThresholds, type LifeItem } from '../../../domain/islandLife/model';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { buildLifeItem } from './itemGeometry';
import { buildPlantMagic, PLANT_MAGIC_MS, PLANT_MAGIC_RETRY_MS } from './plantMagic';

export default function PlantObservationView({ item, prepare, presented }: {
    item: LifeItem; prepare: () => Promise<DiscoveryScene | undefined>;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    const host = useRef<HTMLButtonElement>(null), trigger = useRef<(() => void) | undefined>(undefined);
    const callbacks = useRef({ prepare, presented });
    const [failed, setFailed] = useState(false);
    useEffect(() => { callbacks.current = { prepare, presented }; }, [prepare, presented]);
    const stage = growthStage(item);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
        const materials = new IslandMaterials(), scene = new T.Scene();
        const model = buildLifeItem({ ...item, growth: stage === 2 ? plantThresholds(item.kind)![1] : stage === 1 ? plantThresholds(item.kind)![0] : 0 }, materials);
        const magic = buildPlantMagic(item, materials); scene.add(model.root, magic.root);
        scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
        const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
        const camera = new T.OrthographicCamera(-1.4, 1.4, 1.5, -.4, .1, 20);
        camera.position.set(1.2, 1.55, 3.5); camera.lookAt(0, item.kind === 'sapling' ? .9 : .65, 0);
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
        renderer.domElement.setAttribute('aria-hidden', 'true'); node.append(renderer.domElement);
        let alive = true, generation = 0, preparing = false, started: number | undefined, cooldown = 0;
        let event: DiscoveryScene | undefined, evidence: DiscoveryPresentation | undefined, raf = 0;
        const resize = () => {
            const w = Math.max(1, node.clientWidth), h = Math.max(1, node.clientHeight);
            renderer.setSize(w, h); const aspect = w / h;
            const half = item.kind === 'sapling' ? 1.2 : 1.05;
            camera.left = -half * aspect; camera.right = -camera.left; camera.top = half; camera.bottom = -half;
            camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize); observer.observe(node); resize();
        const cancel = () => { generation++; preparing = false; started = undefined; event = undefined; evidence?.cancel(); evidence = undefined; magic.root.visible = false; delete node.dataset.magic; };
        trigger.current = () => {
            if (preparing || event || performance.now() < cooldown || document.visibilityState !== 'visible' || renderer.getContext().isContextLost()) return;
            preparing = true; const token = ++generation;
            void callbacks.current.prepare().then(next => {
                if (!alive || token !== generation) return;
                preparing = false;
                if (next) { event = next; evidence = new DiscoveryPresentation(next); }
            }).catch(() => { if (alive && token === generation) preparing = false; });
        };
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const frame = () => {
            if (!alive) return;
            const at = performance.now(), foreground = document.visibilityState === 'visible';
            const rect = node.getBoundingClientRect();
            const onScreen = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
            const points = [[.2, .2], [.8, .2], [.5, .5], [.2, .8], [.8, .8]];
            const unoccluded = onScreen && points.every(([x, y]) => node.contains(document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y)));
            if (foreground && !renderer.getContext().isContextLost()) {
                if (event && started === undefined && onScreen && unoccluded) started = at;
                const elapsed = started === undefined ? -1 : at - started;
                magic.sample(elapsed, media.matches);
                if (event && elapsed >= PLANT_MAGIC_MS) { cancel(); cooldown = at + PLANT_MAGIC_RETRY_MS; }
                renderer.render(scene, camera); node.dataset.rendered = 'true';
                if (event) {
                    node.dataset.magic = magic.petals ? 'petals' : 'leaves';
                    node.dataset.magicElapsed = String(Math.round(elapsed));
                    const shown = evidence?.sample(at, Date.now(), { rendered: true, foreground, onScreen, unoccluded, preview: false,
                        coreShown: started !== undefined && elapsed >= 350 && elapsed < PLANT_MAGIC_MS - 250 });
                    if (shown) callbacks.current.presented(event, shown);
                }
            }
            raf = requestAnimationFrame(frame);
        };
        const visibility = () => { if (document.visibilityState !== 'visible') cancel(); };
        const lost = (e: Event) => { e.preventDefault(); cancel(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => { setFailed(false); resize(); };
        document.addEventListener('visibilitychange', visibility);
        renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        frame();
        return () => {
            alive = false; cancel(); trigger.current = undefined; cancelAnimationFrame(raf); observer.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            disposeGeometry(scene); materials.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
        };
        // Identity/placement changes remount the containing observation. Fine-grained
        // growth refreshes within a stage must not restart a three-second episode.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id, item.style, stage]);
    return <><button type="button" ref={host} className="life-observation-view" aria-label={item.kind === 'sapling' ? '木に ふれる' : 'おはなに ふれる'} onClick={() => trigger.current?.()} />
        {failed && <p role="status">景色をひらけなかったよ。とじて、もういちど ためしてね。</p>}</>;
}
