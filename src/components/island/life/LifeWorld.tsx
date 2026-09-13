import { makeFootstepPresentation, type FootstepInput } from './footstepPresentation';
import { makeWorldShadowPresentation } from './worldShadowPresentation';
import { liveRelations } from './liveRelations';
import { GatheringCollector } from './gatheringCollector';
import { displayedGatherings, gatheringVisible } from './gatheringVisibility';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as T from 'three';
import type { Cell, LifeState, ResidentId } from '../../../domain/islandLife/model';
import { landCells } from '../../../domain/islandLife/space';
import { IslandCameraToolbar } from '../IslandCameraToolbar';
import { IslandToyIcon } from '../IslandToyIcon';
import '../IslandStage.css';
import { hasChangedIslandCameraView, initialIslandCameraView, IslandCameraControls, type IslandCameraAction, type IslandCameraView } from '../three/islandCameraControls';
import type { CameraPanFraming, CameraPanPoint } from '../three/cameraPanFraming';
import { buildLifeScene } from './scene';
import type { PlacementPreview } from './placement';
import { LifePresentationClock } from './presentationClock';

type Content = ReturnType<typeof buildLifeScene>;
type LifeWorldProps = { inspectShadow?: (itemId: string, residentId: ResidentId, worldAt: number) => void; observationOpen?: boolean; footstepInput?: FootstepInput; prepareFootstepReplay?: () => Promise<DiscoveryScene | undefined>; profileId?: string; presented?: (event: DiscoveryScene, evidence: PresentationEvidence) => void; state: LifeState; selected?: string; cell?: Cell; placement?: PlacementPreview; onCell: (cell: Cell) => void; controlsVisible: boolean; children: ReactNode };

export default function LifeWorld({ inspectShadow, observationOpen = false, footstepInput, prepareFootstepReplay, profileId, presented, state, selected, cell, placement, onCell, controlsVisible, children }: LifeWorldProps) {
    const behindObservation = useRef(observationOpen);
    useEffect(() => { behindObservation.current = observationOpen; }, [observationOpen]);
    const footsteps = useRef({ input: footstepInput, prepareReplay: prepareFootstepReplay });
    useEffect(() => { footsteps.current = { input: footstepInput, prepareReplay: prepareFootstepReplay }; }, [footstepInput, prepareFootstepReplay]);
    const host = useRef<HTMLDivElement>(null), choose = useRef(onCell);
    const discovery = useRef({ profileId, presented, inspectShadow, enabled: controlsVisible });
    useEffect(() => { discovery.current = { profileId, presented, inspectShadow, enabled: controlsVisible }; }, [profileId, presented, inspectShadow, controlsVisible]);
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
        const presentationClock = new LifePresentationClock();
        const scene = new T.Scene(); scene.background = new T.Color('#278bac');
        scene.add(new T.HemisphereLight('#fff7ea', '#63806c', 1.15));
        const sun = new T.DirectionalLight('#fff4e0', 2.3); sun.position.set(-3, 8, 4); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
        sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6; sun.shadow.normalBias = .025; sun.shadow.bias = -.0002;
        scene.add(sun);
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
        const cameraTarget = new T.Vector3(0, .2, 0), cameraOffset = new T.Vector3(), cameraYAxis = new T.Vector3(0, 1, 0);
        const cameraBaseOffset = new T.Vector3(4.5, 7.8, 11);
        const footprint = makeFootstepPresentation(scene, camera, node, { profileId: () => discovery.current.profileId, prepareReplay: () => footsteps.current.prepareReplay?.() ?? Promise.resolve(undefined), presented: (event, evidence) => discovery.current.presented?.(event, evidence) });
        const shadows = makeWorldShadowPresentation(node, scene, camera, {
            profileId: () => discovery.current.profileId, touched: () => footprint.cancel(),
            inspect: discovery.current.inspectShadow ? (itemId, residentId, worldAt) => discovery.current.inspectShadow?.(itemId, residentId, worldAt) : undefined,
            presented: (event, evidence) => discovery.current.presented?.(event, evidence),
        });
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
            const projectedWidth = ((content?.width ?? 6) + 2) * .926 + ((content?.depth ?? 5) + 1.7) * .379 + .45;
            // The ordinary view reads faces; placement and overview retain the full shore.
            const closeView = !currentPlacement && !overviewRef.current;
            const halfHeight = Math.max(3.8, projectedWidth / aspect / 2) * (closeView ? .66 : 1);
            const canopyView = currentState.worldStyle === 'canopy-dots-c3-v1' && closeView;
            cameraOffset.copy(canopyView ? new T.Vector3(4.5, 6.0, 11) : cameraBaseOffset).applyAxisAngle(cameraYAxis, cameraControls.view.azimuth);
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
                // Bring the doorstep toward the center in the closer view without
                // changing the full-island frame used for placement and overview.
                center: closeView ? { x: project(pointFor(2.5, 1)).x * .45, y: canopyView ? .95 : 0 } : project(pointFor(center, ((content?.depth ?? 5) - 1) / 2)),
                height: halfHeight * 2, aspect, bounds, regions: [ground],
            };
            const frame = cameraControls.setFrame(framing);
            camera.left = frame.left; camera.right = frame.right; camera.top = frame.top; camera.bottom = frame.bottom;
            camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); setCameraView(cameraControls.view);
            node.dataset.lifeCamera = JSON.stringify({ projection: camera.projectionMatrix.toArray(), view: camera.matrixWorldInverse.toArray(), cameraView: cameraControls.view });
        };
        reframe.current = () => { cameraControls.reset(false); resize(); };
        update.current = (next, selection, point, preview) => {
            presentationClock.prepare(next, performance.now());
            if (document.visibilityState !== 'visible' || renderer.getContext().isContextLost()) presentationClock.resume(performance.now(), true);
            if (Boolean(preview) !== Boolean(currentPlacement)) cameraControls.reset(false);
            currentState = next; currentPlacement = preview;
            if (preview) cameraControls.cancel();
            if (content) { scene.remove(content.root); content.dispose(); }
            content = buildLifeScene(next, selection, point, preview); scene.add(content.root);
            node.dataset.lifeWorldStyle = content.root.userData.worldStyle;
            node.dataset.lifeVisualCandidate = content.root.getObjectByName('life-canopy-c3')?.userData.visualCandidate ?? content.root.userData.worldStyle;
            node.dataset.lifeLandscapeVersion = next.landscapeVersion ?? 'original';
            node.dataset.lifeTourVersion = String(next.tourVersion ?? 0);
            resize();
        };
        const observer = new ResizeObserver(resize); observer.observe(node);
        const ray = new T.Raycaster();
        const selectAt = (clientX: number, clientY: number) => {
            if (!content) return;
            const r = renderer.domElement.getBoundingClientRect();
            ray.setFromCamera(new T.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
            if (!currentPlacement && discovery.current.enabled && shadows.pick(ray)) return;
            shadows.cancel();
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
        let raf = 0, auditAt = 0, discoveryAt = 0, discoveryOwner: string | undefined, lastBackgroundFrame = -Infinity;
        let collector: GatheringCollector | undefined;
        const frame = () => {
            // The foreground observation owns the full render cadence. The background
            // still samples the same world clock; closing the panel resumes immediately.
            if (behindObservation.current && performance.now() - lastBackgroundFrame < 125) { raf = requestAnimationFrame(frame); return; }
            lastBackgroundFrame = performance.now();
            // Background/context-loss time must age reactions, not replay them on return.
            if (document.visibilityState !== 'visible' || renderer.getContext().isContextLost()) presentationClock.resume(performance.now(), true);
            const logicalAt = presentationClock.sample(performance.now());
            content?.animate(logicalAt, media.matches);
            if (content) shadows.update(content.snapshot(), content.root, performance.now(), media.matches,
                discovery.current.enabled && !currentPlacement && !behindObservation.current && !renderer.getContext().isContextLost(), footsteps.current.input?.id);
            if (content) footprint.update(content, content.snapshot(), footsteps.current.input, performance.now(), discovery.current.enabled && !currentPlacement && !renderer.getContext().isContextLost(), media.matches);
            if (content && document.visibilityState === 'visible' && !renderer.getContext().isContextLost()) { renderer.render(scene, camera); node.dataset.rendered = 'true'; footprint.sample(content, performance.now());
                presentationClock.resume(performance.now());
                shadows.sample(performance.now());
                if (discovery.current.profileId !== discoveryOwner) {
                    collector?.cancel(); discoveryOwner = discovery.current.profileId;
                    collector = discoveryOwner ? new GatheringCollector(discoveryOwner, (event, evidence) => discovery.current.presented?.(event, evidence)) : undefined;
                }
                if (shadows.active()) collector?.pause();
                if (collector && !shadows.active() && !footsteps.current.prepareReplay && discovery.current.enabled && !currentPlacement && performance.now() - discoveryAt >= 100) {
                    const stateAtFrame = content.snapshot();
                    const rules = displayedGatherings(stateAtFrame, discoveryOwner!), rect = node.getBoundingClientRect();
                    const onScreen = (ndc: T.Vector3) => {
                        const x = rect.left + (ndc.x + 1) / 2 * rect.width, y = rect.top + (1 - ndc.y) / 2 * rect.height;
                        return rect.width > 0 && rect.height > 0 && x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight && node.contains(document.elementFromPoint(x, y));
                    };
                    const gatherings = rules.map(rule => {
                        let reason: string | undefined;
                        const core = gatheringVisible(stateAtFrame, rule, content!.root, camera, content!.point, onScreen, value => { reason = value; });
                        return { rule, key: rule.semanticSignature, core, reason };
                    });
                    const relations = liveRelations(stateAtFrame, discoveryOwner!, content, camera, onScreen);
                    collector.sampleCandidates(stateAtFrame, [...gatherings, ...relations], performance.now(), Date.now());
                    node.dataset.lifeGatherings = JSON.stringify(gatherings.map(({ rule, core, reason }) => ({ ruleId: rule.ruleId, ids: rule.participantIds, core, reason })));
                    node.dataset.lifeRelations = JSON.stringify(relations.map(({ rule, core, focalResidentIds }) => ({ ruleId: rule.ruleId, ids: rule.participantIds, core, focalResidentIds })));
                    discoveryAt = performance.now();
                } else if (currentPlacement || !discovery.current.enabled) collector?.pause();
                const poses = content.audit();
                poses.forEach((pose, i) => {
                    const badge = emotes[i]; badge.hidden = !pose.reaction;
                    if (!pose.reaction) return;
                    const position = new T.Vector3(...pose.position).add(new T.Vector3(0, i === 1 ? 1.05 : .9, 0)).project(camera);
                    badge.textContent = pose.reaction;
                    badge.style.left = `${(position.x + 1) / 2 * node.clientWidth}px`;
                    badge.style.top = `${(1 - position.y) / 2 * node.clientHeight}px`;
                });
                // A 500ms sample can omit an entire short hop. During an earned
                // reaction expose the actual rendered pose, not a stale sample.
                if (poses.some(pose => pose.reaction) || performance.now() - auditAt > 500) {
                    node.dataset.lifePoses = JSON.stringify(poses);
                    node.dataset.lifeRender = JSON.stringify({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory });
                    auditAt = performance.now();
                }
            }
            if (document.visibilityState !== 'visible' || renderer.getContext().isContextLost()) collector?.pause();
            raf = requestAnimationFrame(frame);
        }; raf = requestAnimationFrame(frame);
        const hidden = () => { if (document.visibilityState !== 'visible') { shadows.clear(); footprint.cancel(); collector?.pause(); presentationClock.resume(performance.now(), true); } };
        document.addEventListener('visibilitychange', hidden);
        const lost = (event: Event) => { shadows.clear(); footprint.cancel(); collector?.pause(); presentationClock.resume(performance.now(), true); event.preventDefault(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => setFailed(false);
        renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        return () => {
            collector?.cancel(); cancelAnimationFrame(raf); observer.disconnect(); update.current = null; controlCamera.current = undefined; reframe.current = undefined; cameraControls.cancel(); shadows.dispose(); footprint.dispose(); content?.dispose();
            document.removeEventListener('visibilitychange', hidden);
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
    return <><div ref={host} className="life-world" data-placing={Boolean(placement)} />
        {!placement && controlsVisible && !prepareFootstepReplay && <div className="life-home-tools" role="group" aria-label="しまの あそび">
        {children}
        <details className="life-camera-tools" onKeyDown={event => {
            if (event.key !== 'Escape') return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
        }}>
            <summary className="life-home-action"><IslandToyIcon kind="telescope" size={40} /><span>ながめ</span></summary>
            <div className="life-camera-tools-panel">
                <button type="button" className="life-view-toggle" aria-pressed={overview} onClick={() => {
                    overviewRef.current = !overview; setOverview(!overview); reframe.current?.();
                }}>{overview ? 'くらしを みる' : 'しま全体を みる'}</button>
                <IslandCameraToolbar view={cameraView} onAction={action => controlCamera.current?.(action)} />
                <p className="island-camera-hint">なぞって 移動・2本指で 拡大と回転</p>
            </div>
        </details>
        {hasChangedIslandCameraView(cameraView) && <button type="button" className="island-stage__quick-reset" onClick={() => controlCamera.current?.('reset')}>もとの ながめ</button>}
        </div>}
        {failed && <p className="life-world-error" role="status">景色をひらけなかったよ。「つくる」からも選べるよ。</p>}</>;
}
