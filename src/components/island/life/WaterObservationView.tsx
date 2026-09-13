import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { LifeItem } from '../../../domain/islandLife/model';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { buildLifeItem } from './itemGeometry';

/** An ordinary touch response, with no currency, eligibility or discovery write. */
export default function WaterObservationView({ item }: { item: LifeItem }) {
    const host = useRef<HTMLButtonElement>(null), touch = useRef<() => void>(() => {});
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
        const materials = new IslandMaterials(), scene = new T.Scene(), model = buildLifeItem(item, materials);
        scene.add(model.root, new T.HemisphereLight('#fff7df', '#698f71', 2.4));
        const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
        const ringMaterial = new T.MeshBasicMaterial({ color: '#ecfff9', transparent: true, opacity: .8, depthWrite: false });
        const ring = new T.Mesh(new T.RingGeometry(.24, .258, 48), ringMaterial);
        ring.rotation.x = -Math.PI / 2; ring.position.y = .234; ring.visible = false; scene.add(ring);
        const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 20);
        camera.position.set(1, 1.65, 2.4); camera.lookAt(0, .18, 0);
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
        renderer.domElement.setAttribute('aria-hidden', 'true'); node.append(renderer.domElement);
        let started = -Infinity, raf = 0, alive = true;
        touch.current = () => { if (document.visibilityState === 'visible') started = performance.now(); };
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const resize = () => {
            const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight);
            renderer.setSize(width, height); camera.left = -.65 * width / height; camera.right = -camera.left;
            camera.top = .65; camera.bottom = -.65; camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize); observer.observe(node); resize();
        const frame = () => {
            if (!alive) return;
            const elapsed = performance.now() - started;
            ring.visible = elapsed >= 0 && elapsed < 1200 && document.visibilityState === 'visible';
            const phase = media.matches ? .65 : Math.max(0, Math.min(1, elapsed / 1200));
            ring.scale.setScalar(.15 + phase); ringMaterial.opacity = media.matches ? .8 : .9 * (1 - phase);
            if (document.visibilityState === 'visible' && !renderer.getContext().isContextLost()) {
                renderer.render(scene, camera); node.dataset.rendered = 'true'; node.dataset.ripple = String(ring.visible);
            }
            raf = requestAnimationFrame(frame);
        };
        frame();
        const cancel = () => { started = -Infinity; ring.visible = false; };
        const lost = (event: Event) => { event.preventDefault(); cancel(); setFailed(true); };
        const restored = () => { setFailed(false); };
        document.addEventListener('visibilitychange', cancel); renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        return () => {
            alive = false; touch.current = () => {}; cancelAnimationFrame(raf); observer.disconnect();
            document.removeEventListener('visibilitychange', cancel); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            disposeGeometry(model.root); ring.geometry.dispose(); ringMaterial.dispose(); materials.dispose(); renderer.dispose(); renderer.domElement.remove();
        };
    }, [item]);
    return <><button ref={host} type="button" className="life-observation-view" aria-label="水に ふれてみる" onClick={() => touch.current()} />
        <p className="life-observation-hint">{failed ? '水ばちを ひらけなかったよ。' : '水に そっと ふれてみよう'}</p></>;
}
