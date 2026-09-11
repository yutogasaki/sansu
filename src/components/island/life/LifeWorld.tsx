import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { Cell, LifeState } from '../../../domain/islandLife/model';
import { buildLifeScene } from './scene';
import type { PlacementPreview } from './placement';

type Content = ReturnType<typeof buildLifeScene>;
export default function LifeWorld({ state, selected, cell, placement, onCell }: { state: LifeState; selected?: string; cell?: Cell; placement?: PlacementPreview; onCell: (cell: Cell) => void }) {
    const host = useRef<HTMLDivElement>(null), choose = useRef(onCell);
    const update = useRef<((state: LifeState, selected?: string, cell?: Cell, placement?: PlacementPreview) => void) | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => { choose.current = onCell; }, [onCell]);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
        let content: Content | undefined, lastSnapshot: LifeState | undefined, snapshotAt = 0, frameAt = performance.now();
        const scene = new T.Scene(); scene.background = new T.Color('#278bac');
        scene.add(new T.HemisphereLight('#fff7ea', '#63806c', 1.15));
        const sun = new T.DirectionalLight('#fff4e0', 2.3); sun.position.set(-3, 8, 4); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
        sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = .025; sun.shadow.bias = -.0002;
        scene.add(sun);
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
        camera.position.set(4.5, 8, 11); camera.lookAt(0, .2, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
        renderer.domElement.setAttribute('aria-label', 'ぽこもこと みんなが くらす しま');
        node.append(renderer.domElement);
        const emotes = ['pokomoko', 'rabbit', 'otter'].map(id => {
            const badge = document.createElement('span'); badge.className = 'life-emote'; badge.hidden = true;
            badge.dataset.lifeEmote = id; badge.setAttribute('aria-hidden', 'true'); node.append(badge); return badge;
        });
        const resize = () => {
            const width = node.clientWidth, height = node.clientHeight, aspect = width / height;
            renderer.setSize(width, height);
            const projectedWidth = ((content?.width ?? 6) + 2) * .926 + 6.7 * .379 + .45;
            const halfHeight = Math.max(3.8, projectedWidth / aspect / 2);
            camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            node.dataset.lifeCamera = JSON.stringify({ projection: camera.projectionMatrix.toArray(), view: camera.matrixWorldInverse.toArray() });
        };
        update.current = (next, selection, point, preview) => {
            if (content) { scene.remove(content.root); content.dispose(); }
            content = buildLifeScene(next, selection, point, preview); scene.add(content.root);
            if (next !== lastSnapshot) { lastSnapshot = next; snapshotAt = next.now; frameAt = performance.now(); }
            resize();
        };
        const observer = new ResizeObserver(resize); observer.observe(node);
        const ray = new T.Raycaster();
        const click = (e: MouseEvent) => {
            if (!content) return;
            const r = renderer.domElement.getBoundingClientRect();
            ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
            const hit = ray.intersectObjects(content.clickables)[0]; if (hit?.object.userData.cell) choose.current(hit.object.userData.cell as Cell);
        };
        renderer.domElement.addEventListener('click', click);
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        let raf = 0, auditAt = 0;
        const frame = () => {
            content?.animate(snapshotAt + performance.now() - frameAt, media.matches);
            if (content && document.visibilityState === 'visible' && !renderer.getContext().isContextLost()) { renderer.render(scene, camera); node.dataset.rendered = 'true';
                content.audit().forEach((pose, i) => {
                    const badge = emotes[i]; badge.hidden = !pose.reaction;
                    if (!pose.reaction) return;
                    const position = new T.Vector3(...pose.position).add(new T.Vector3(0, i === 1 ? 1.05 : .9, 0)).project(camera);
                    badge.textContent = pose.reaction;
                    badge.style.left = `${(position.x + 1) / 2 * node.clientWidth}px`;
                    badge.style.top = `${(1 - position.y) / 2 * node.clientHeight}px`;
                });
                if (performance.now() - auditAt > 500) {
                    node.dataset.lifePoses = JSON.stringify(content.audit());
                    node.dataset.lifeRender = JSON.stringify({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory });
                    auditAt = performance.now();
                }
            }
            raf = requestAnimationFrame(frame);
        }; frame();
        const lost = (event: Event) => { event.preventDefault(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => setFailed(false);
        renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        return () => {
            cancelAnimationFrame(raf); observer.disconnect(); update.current = null; content?.dispose();
            renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete node.dataset.rendered;
            emotes.forEach(badge => badge.remove()); delete node.dataset.lifePoses; delete node.dataset.lifeRender; delete node.dataset.lifeCamera;
        };
    }, []);
    useEffect(() => { update.current?.(state, selected, cell, placement); }, [state, selected, cell, placement]);
    return <><div ref={host} className="life-world" data-placing={Boolean(placement)} />{failed && <p role="status">景色をひらけなかったよ。下の一覧から選べるよ。</p>}</>;
}
