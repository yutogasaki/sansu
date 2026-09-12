import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { Cell, LifeState } from '../../../domain/islandLife/model';
import { landCells } from '../../../domain/islandLife/space';
import { IslandCameraToolbar } from '../IslandCameraToolbar';
import '../IslandStage.css';
import { hasChangedIslandCameraView, initialIslandCameraView, IslandCameraControls, type IslandCameraAction, type IslandCameraView } from '../three/islandCameraControls';
import type { CameraPanFraming, CameraPanPoint } from '../three/cameraPanFraming';
import { buildLifeScene } from './scene';
import type { PlacementPreview } from './placement';

type Content = ReturnType<typeof buildLifeScene>;
type LifeWorldProps = { state: LifeState; selected?: string; cell?: Cell; placement?: PlacementPreview; onCell: (cell: Cell) => void };

export default function LifeWorld({ state, selected, cell, placement, onCell }: LifeWorldProps) {
    const host = useRef<HTMLDivElement>(null), choose = useRef(onCell);
    const stateAtMount = useRef(state), placementAtMount = useRef(placement);
    const update = useRef<((state: LifeState, selected?: string, cell?: Cell, placement?: PlacementPreview) => void) | null>(null);
    const controlCamera = useRef<((action: IslandCameraAction) => void) | undefined>(undefined);
    const overviewRef = useRef(false);
    const reframe = useRef<(() => void) | undefined>(undefined);
    const [overview, setOverview] = useState(false);
    const [cameraView, setCameraView] = useState<IslandCameraView>(initialIslandCameraView);
    const [failed, setFailed] = useState(false);
    useEffect(() => { choose.current = onCell; }, [onCell]);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
        let content: Content | undefined, currentState = stateAtMount.current, currentPlacement = placementAtMount.current;
        let lastSnapshot: LifeState | undefined, snapshotAt = 0, frameAt = performance.now();
        const scene = new T.Scene(); scene.background = new T.Color('#278bac');
        scene.add(new T.HemisphereLight('#fff7ea', '#63806c', 1.15));
        const sun = new T.DirectionalLight('#fff4e0', 2.3); sun.position.set(-3, 8, 4); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
        sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = .025; sun.shadow.bias = -.0002;
        scene.add(sun);
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
        const cameraTarget = new T.Vector3(0, .2, 0), cameraOffset = new T.Vector3(), cameraYAxis = new T.Vector3(0, 1, 0);
        const cameraBaseOffset = new T.Vector3(4.5, 7.8, 11);
        camera.position.copy(cameraTarget).add(cameraBaseOffset); camera.lookAt(cameraTarget);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
        renderer.domElement.setAttribute('aria-label', 'ぽこもこと みんなが くらす しま');
        node.append(renderer.domElement);
        const emotes = ['pokomoko', 'rabbit', 'otter'].map(id => {
            const badge = document.createElement('span'); badge.className = 'life-emote'; badge.hidden = true;
            badge.dataset.lifeEmote = id; badge.setAttribute('aria-hidden', 'true'); node.append(badge); return badge;
        });
        let resize: () => void = () => {};
        const cameraControls = new IslandCameraControls(view => { setCameraView(view); resize(); });
        controlCamera.current = action => { if (!currentPlacement) cameraControls.action(action); };
        const project = (point: T.Vector3): CameraPanPoint => {
            const projected = point.clone().applyMatrix4(camera.matrixWorldInverse);
            return { x: projected.x, y: projected.y };
        };
        resize = () => {
            const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight), aspect = width / height;
            renderer.setSize(width, height);
            const projectedWidth = ((content?.width ?? 6) + 2) * .926 + 6.7 * .379 + .45;
            // The ordinary view reads faces; placement and overview retain the full shore.
            const halfHeight = Math.max(3.8, projectedWidth / aspect / 2) * (currentPlacement || overviewRef.current ? 1 : .76);
            cameraOffset.copy(cameraBaseOffset).applyAxisAngle(cameraYAxis, cameraControls.view.azimuth);
            camera.position.copy(cameraTarget).add(cameraOffset); camera.lookAt(cameraTarget); camera.updateMatrixWorld(true);
            camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;

            const cells = landCells(currentState), min = Math.min(...cells.map(c => c.x)), max = Math.max(...cells.map(c => c.x));
            const center = (min + max) / 2;
            const pointFor = (x: number, z: number) => content?.point({ x, z }) ?? new T.Vector3(x - center, .04, z - 2);
            const samples = [[-.55, -.55], [.55, -.55], [.55, .55], [-.55, .55]] as const;
            const groundWorld = cells.flatMap(c => samples.map(([x, z]) => pointFor(c.x + x, c.z + z)));
            const boundsWorld = [...groundWorld];
            content?.root.traverse(object => {
                if (object.name === 'life-sea' || !(object instanceof T.Mesh)) return;
                const box = new T.Box3().setFromObject(object);
                if (box.isEmpty()) return;
                for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
                    boundsWorld.push(new T.Vector3(x, y, z));
            });
            const ground = groundWorld.map(project), boundsPoints = boundsWorld.map(project);
            const safeBounds = boundsPoints.length ? boundsPoints : [{ x: -3, y: -3 }, { x: 3, y: 3 }];
            const bounds = { minX: Math.min(...safeBounds.map(point => point.x)), maxX: Math.max(...safeBounds.map(point => point.x)),
                minY: Math.min(...safeBounds.map(point => point.y)), maxY: Math.max(...safeBounds.map(point => point.y)) };
            const origin = project(pointFor(0, 0)), xBasis = project(pointFor(1, 0)), zBasis = project(pointFor(0, 1));
            const framing: CameraPanFraming = {
                ground: { origin, x: { x: xBasis.x - origin.x, y: xBasis.y - origin.y }, z: { x: zBasis.x - origin.x, y: zBasis.y - origin.y } },
                center: { x: 0, y: 0 }, height: halfHeight * 2, aspect, bounds, regions: [ground],
            };
            const frame = cameraControls.setFrame(framing);
            camera.left = frame.left; camera.right = frame.right; camera.top = frame.top; camera.bottom = frame.bottom;
            camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); setCameraView(cameraControls.view);
            node.dataset.lifeCamera = JSON.stringify({ projection: camera.projectionMatrix.toArray(), view: camera.matrixWorldInverse.toArray(), cameraView: cameraControls.view });
        };
        reframe.current = () => { cameraControls.reset(false); resize(); };
        update.current = (next, selection, point, preview) => {
            if (Boolean(preview) !== Boolean(currentPlacement)) cameraControls.reset(false);
            currentState = next; currentPlacement = preview;
            if (preview) cameraControls.cancel();
            if (content) { scene.remove(content.root); content.dispose(); }
            content = buildLifeScene(next, selection, point, preview); scene.add(content.root);
            if (next !== lastSnapshot) { lastSnapshot = next; snapshotAt = next.now; frameAt = performance.now(); }
            resize();
        };
        const observer = new ResizeObserver(resize); observer.observe(node);
        const ray = new T.Raycaster();
        const selectAt = (clientX: number, clientY: number) => {
            if (!content) return;
            const r = renderer.domElement.getBoundingClientRect();
            ray.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
            const hit = ray.intersectObjects(content.clickables)[0]; if (hit?.object.userData.cell) choose.current(hit.object.userData.cell as Cell);
        };
        let suppressClick = false;
        const click = (e: MouseEvent) => {
            if (suppressClick) { suppressClick = false; return; }
            selectAt(e.clientX, e.clientY);
        };
        const pointerDown = (e: PointerEvent) => {
            if (currentPlacement || e.pointerType === 'mouse' && e.button !== 0) return;
            suppressClick = false; cameraControls.down(e.pointerId, { x: e.clientX, y: e.clientY }); renderer.domElement.setPointerCapture(e.pointerId);
        };
        const pointerMove = (e: PointerEvent) => {
            if (currentPlacement) return;
            cameraControls.move(e.pointerId, { x: e.clientX, y: e.clientY }, renderer.domElement.getBoundingClientRect());
        };
        const pointerUp = (e: PointerEvent) => {
            if (currentPlacement) return;
            const tap = cameraControls.up(e.pointerId, { x: e.clientX, y: e.clientY });
            if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
            if (!tap || e.button !== 0) suppressClick = true;
        };
        const pointerCancel = (e: PointerEvent) => {
            if (!currentPlacement && cameraControls.hasPointer(e.pointerId)) { cameraControls.cancel(); suppressClick = true; }
        };
        const lostPointerCapture = (e: PointerEvent) => {
            if (cameraControls.hasPointer(e.pointerId)) { cameraControls.cancel(); suppressClick = true; }
        };
        const wheel = (e: WheelEvent) => {
            if (currentPlacement) return;
            const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? node.clientHeight : 1);
            if (cameraControls.wheel(delta, { x: e.clientX, y: e.clientY }, renderer.domElement.getBoundingClientRect())) e.preventDefault();
        };
        renderer.domElement.addEventListener('click', click);
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointermove', pointerMove);
        renderer.domElement.addEventListener('pointerup', pointerUp);
        renderer.domElement.addEventListener('pointercancel', pointerCancel);
        renderer.domElement.addEventListener('lostpointercapture', lostPointerCapture);
        renderer.domElement.addEventListener('wheel', wheel, { passive: false });
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
            cancelAnimationFrame(raf); observer.disconnect(); update.current = null; controlCamera.current = undefined; reframe.current = undefined; cameraControls.cancel(); content?.dispose();
            renderer.domElement.removeEventListener('click', click);
            renderer.domElement.removeEventListener('pointerdown', pointerDown);
            renderer.domElement.removeEventListener('pointermove', pointerMove);
            renderer.domElement.removeEventListener('pointerup', pointerUp);
            renderer.domElement.removeEventListener('pointercancel', pointerCancel);
            renderer.domElement.removeEventListener('lostpointercapture', lostPointerCapture);
            renderer.domElement.removeEventListener('wheel', wheel);
            renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete node.dataset.rendered;
            emotes.forEach(badge => badge.remove()); delete node.dataset.lifePoses; delete node.dataset.lifeRender; delete node.dataset.lifeCamera;
        };
    }, []);
    useEffect(() => { update.current?.(state, selected, cell, placement); }, [state, selected, cell, placement]);
    return <><div ref={host} className="life-world" data-placing={Boolean(placement)}>
        {!placement && <details className="life-camera-tools">
            <summary>ながめ</summary>
            <div className="life-camera-tools-panel">
                <button type="button" className="life-view-toggle" aria-pressed={overview} onClick={() => {
                    overviewRef.current = !overview; setOverview(!overview); reframe.current?.();
                }}>{overview ? 'くらしを みる' : 'しま全体を みる'}</button>
                <IslandCameraToolbar view={cameraView} onAction={action => controlCamera.current?.(action)} />
                <p className="island-camera-hint">なぞって 移動・2本指で 拡大と回転</p>
            </div>
        </details>}
        {!placement && hasChangedIslandCameraView(cameraView) && <button type="button" className="island-stage__quick-reset" onClick={() => controlCamera.current?.('reset')}>もとの ながめ</button>}
    </div>{failed && <p role="status">景色をひらけなかったよ。下の一覧から選べるよ。</p>}</>;
}
