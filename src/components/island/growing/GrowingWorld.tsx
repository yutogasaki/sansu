import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { GardenTime } from '../three/garden/presentation';
import { boatProgress, docked } from '../../../domain/growingIsland';
import type { Cell, GrowingState, Moment, Villager } from '../../../domain/growingIsland';
import { disposeActor, makeVillagerActor } from './actors';
import { MomentEffects } from './momentEffects';
import { buildObjectLayer, type Ghost, type ObjectLayer } from './objectLayer';
import { frameCamera, initialView, panFromDrag } from './growingCamera';
import { createWorldScene } from './worldScene';
import { WorldEffects } from './worldEffects';
import type { SceneLayout } from './sceneLayout';
import { menuPictureMaker, type MenuPictures } from './menuMiniatures';
import { chooseGrowingFingerTarget, updateGrowingFingerTargets } from './growingFingerTargets';
import type { DropPlayKind } from './growingDropPlay';
import { DROP_PLAY_MS } from './growingDropPlay';
import { AdaptiveIslandQuality } from '../three/adaptiveIslandQuality';
import { createIslandRenderer } from '../three/createIslandRenderer';
import { retainSharedRendererCache } from '../three/sharedRendererCache';
import { bridgeAnchor, bridgeEnd } from '../../../domain/growingIsland/space';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import type { PlaceUseReceipt } from './growingLife';
import type { NativeGrowingKit } from './native/nativeGrowingKit';

export interface WorldHandlers {
    onCell: (cell: Cell) => void;
    onSelect: (id?: string) => void;
    onOpen: (plotId: string) => void;
    onDisembark: () => void;
    onActorTap: (id: string) => void;
    onActorDrag?: () => void;
    onActorPlay?: (id: string, kind: DropPlayKind) => void;
    onPop?: () => void;
    /** The world's own loading steps: the scene is built, then the first picture is on screen. */
    onStage?: (stage: 'scene' | 'ready' | 'failed') => void;
    onQualityFallback?: (ceiling: number) => void;
    onFailure?: (detail: string) => void;
    onConcertStarted?: (receipt: number) => void;
    onPlaceShown?: (receipt: { ruleId: DerivedPlace['ruleId']; revision: string }) => boolean | void | Promise<boolean | void>;
    onPlaceUse?: (receipt: PlaceUseReceipt) => boolean | void | Promise<boolean | void>;
}
/** Pictures of the island for the card and the island's story; never uploaded anywhere. */
export interface WorldCamera {
    capture: (width: number, height: number) => HTMLCanvasElement | undefined;
    portraits: (villagers: readonly Villager[], size: number) => Record<string, string>;
    menuPictures: (villagers: readonly Villager[]) => MenuPictures;
}
export interface ShownMoment { id: number; moment: Moment; cell?: Cell }
/** `cheer` makes the waiting friend jump (a home seed was planted); `festival` celebrates a new level. */
type Props = WorldHandlers & { state: GrowingState; time: GardenTime; ghost?: Ghost; selectedId?: string; turn: number; cheer: number; festival: number;
    hints?: readonly Cell[]; moment?: ShownMoment; show?: boolean; active?: boolean; compact?: boolean; qualityCeiling?: number; focus?: { id: string; n: number }; concert?: { cell: Cell; n: number }; bridgeBuild?: number; onCamera?: (camera?: WorldCamera) => void };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nativeArtEnabled = import.meta.env.DEV || import.meta.env.VITE_NATIVE_GROWING_ART === 'true';

export default function GrowingWorld({ state, time, ghost, selectedId, turn, cheer, festival, hints, moment, show, active = true, compact, qualityCeiling = 1.25, focus, concert, bridgeBuild, onCamera, ...handlers }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const handlerRef = useRef(handlers);
    useEffect(() => { handlerRef.current = handlers; });
    const api = useRef<{ rebuild: (state: GrowingState, ghost?: Ghost, selectedId?: string, hints?: readonly Cell[]) => void; setTime: (time: GardenTime) => void; turn: (by: number) => void;
        cheer: () => void; festival: () => void; moment: (m: ShownMoment) => void; focus: (id: string) => void; concert: (cell: Cell, receipt: number) => void;
        bridgeStart: () => void } | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    const [bridgeStage, setBridgeStage] = useState<'building' | 'crossing' | 'arrived'>();
    const latest = useRef({ state, ghost, selectedId, time, hints, show, active });
    useEffect(() => { latest.current = { state, ghost, selectedId, time, hints, show, active }; });
    const cameraRef = useRef(onCamera);
    useEffect(() => { cameraRef.current = onCamera; });

    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        let light = Boolean(compact), recovery = Boolean(compact);
        try { const result = createIslandRenderer({}, light, recovery); renderer = result.renderer; light = result.compact; recovery = result.recovery; }
        catch (error) {
            handlerRef.current.onFailure?.(`initialization: ${error instanceof Error ? error.message : String(error)}`);
            setFailed(true); handlerRef.current.onStage?.('failed'); return;
        }
        const quality = light ? new AdaptiveIslandQuality(Math.min(qualityCeiling, window.devicePixelRatio || 1)) : undefined;
        let frame = 0, lost = false, released = false;
        const abort = new AbortController();
        const disposers: (() => void)[] = [() => { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); }];
        const release = () => {
            if (released) return;
            released = true; abort.abort(); cancelAnimationFrame(frame); api.current = undefined; cameraRef.current?.(undefined);
            for (const dispose of disposers.reverse()) { try { dispose(); } catch { /* Continue releasing the remaining GPU resources. */ } }
        };
        const fail = (stage: string, error?: unknown) => {
            if (lost) return;
            lost = true;
            handlerRef.current.onFailure?.(`${stage} (${renderer.domElement.dataset.graphicsQuality}): ${error instanceof Error ? error.message : String(error ?? 'WebGL2 context lost')}`);
            const ceiling = quality?.fallbackCeiling();
            release();
            if (ceiling !== undefined && handlerRef.current.onQualityFallback) {
                handlerRef.current.onQualityFallback(ceiling); return;
            }
            setFailed(true); handlerRef.current.onStage?.('failed');
        };
        const contextLost = (event: Event) => { event.preventDefault(); fail('context-lost'); };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        disposers.push(() => renderer.domElement.removeEventListener('webglcontextlost', contextLost));
        void (async () => { try {
        renderer.setPixelRatio(quality?.ratio ?? Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.domElement.dataset.pixelRatio = String(renderer.getPixelRatio());
        renderer.domElement.dataset.qualityCeiling = String(qualityCeiling);
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.shadowMap.enabled = !light; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.dataset.graphicsQuality = recovery ? 'recovery' : light ? 'compact' : 'standard';
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.domElement.setAttribute('aria-label', 'ぽこもこと なかまが くらす しま');
        renderer.domElement.style.touchAction = 'none';
        node.append(renderer.domElement);
        handlerRef.current.onStage?.('scene');
        let native: NativeGrowingKit | undefined;
        if (nativeArtEnabled) {
            const { loadNativeGrowingKit } = await import('./native/nativeGrowingAssets');
            abort.signal.throwIfAborted(); native = await loadNativeGrowingKit(abort.signal);
            if (native) {
                disposers.push(() => native?.dispose());
                node.dataset.nativeKitSha256 = native.manifest.sha256;
                node.dataset.nativeSourceSha256 = native.manifest.sourceSha256;
                node.dataset.nativeKitGzipBytes = String(native.manifest.gzipBytes);
                node.dataset.gameplayMapped = 'true';
            }
        }
        if (released) return;
        const world = createWorldScene(renderer, native); disposers.push(() => world.dispose());
        const releaseSharedCache = retainSharedRendererCache(world.m.residentFabric());
        disposers.push(releaseSharedCache);
        let bridgeWork: { at: number; resident: string; owner: string; parts: T.Object3D[]; crossing?: boolean } | undefined;
        let bridgeClear = 0;
        disposers.push(() => window.clearTimeout(bridgeClear));
        const effects = new WorldEffects(world.scene); disposers.push(() => effects.dispose());
        const moments = new MomentEffects(world.scene); disposers.push(() => moments.dispose());
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100), view = initialView();
        type View = ReturnType<typeof initialView>;
        let playFocus: { at: number; from: View; to: View; returnTo: View; restoring?: boolean } | undefined;
        let interruptedOrigin: View | undefined;
        const copyView = (): View => ({ zoom: view.zoom, azimuth: view.azimuth, pan: { ...view.pan } });
        const ease = (n: number) => n * n * (3 - 2 * n);
        const restoreFocus = () => {
            if (reduced || !interruptedOrigin) return;
            playFocus = { at: performance.now(), from: copyView(), to: interruptedOrigin, returnTo: interruptedOrigin, restoring: true };
            interruptedOrigin = undefined;
        };
        const focusOnPlay = (cell: Cell) => {
            if (reduced) return;
            const from = copyView(), point = layout.point(cell);
            const centered = frameCamera(camera, layout, { ...view, pan: { x: 0, z: 0 } }, width / height);
            const to: View = { zoom: Math.max(from.zoom, 1.65), azimuth: from.azimuth,
                pan: { x: (point.x - centered.x) * .8, z: (point.z - centered.z) * .8 } };
            playFocus = { at: performance.now(), from, to, returnTo: interruptedOrigin ?? from };
            interruptedOrigin = undefined;
            frameCamera(camera, layout, view, width / height);
        };
        let layout: SceneLayout = world.layout(latest.current.state), layer: ObjectLayer | undefined;
        let unopened = new Set<string>(), known: Set<string> | undefined, last = performance.now(), width = 1, height = 1, nextWave = 0, showing = false;
        disposers.push(() => layer?.dispose());
        const reduced = reducedMotion();
        let pendingConcert: number | undefined;
        let publishedCamera = '';
        let rebuilt: { state: GrowingState; ghost?: Ghost; selected?: string; hints?: readonly Cell[] } | undefined;

        const rebuild = (next: GrowingState, nextGhost?: Ghost, selected?: string, nextHints?: readonly Cell[]) => {
            // The first props effect follows the initial scene build with the same
            // immutable inputs. Keep that scene (and its visitor) instead of rebuilding it.
            if (rebuilt?.state === next && rebuilt.ghost === nextGhost && rebuilt.selected === selected && rebuilt.hints === nextHints) return;
            if (rebuilt?.state === next && layer) {
                // Preview-only input does not change saved objects, walking paths,
                // visitors, opening effects, bridge work or the current camera.
                layer.updatePreview(nextGhost, selected, nextHints);
                rebuilt = { state: next, ghost: nextGhost, selected, hints: nextHints };
                return;
            }
            layout = world.layout(next);
            node.dataset.growingBounds = JSON.stringify(layout.bounds);
            node.dataset.bridgeSaved = String(Boolean(next.bridge));
            layer?.dispose();
            layer = buildObjectLayer(world.m, next, layout, nextGhost, selected, nextHints, native);
            world.scene.add(layer.root);
            const now = performance.now();
            for (const id of unopened) if (!next.unopened.includes(id)) {
                const opened = layer.objects.get(id);
                if (opened) {
                    effects.pop(opened, now, reduced); handlerRef.current.onPop?.();
                    if (!reduced && next.plots.some(p => p.id === id && p.kind === 'wonder')) effects.burst(opened.position, now);
                }
            }
            // Flowers that spread by themselves and gifts from a sibling grow in gently; they are not buds.
            if (known) for (const [id, object] of layer.objects) if (!known.has(id) && (next.plots.some(p => p.id === id && p.origin === 'spread')
                || next.landmarks.some(l => l.id === id && l.from))) effects.pop(object, now, true);
            known = new Set(layer.objects.keys());
            unopened = new Set(next.unopened);
            world.life.sync(next, layout, layer);
            if (bridgeWork && (!next.bridge || bridgeWork.owner !== next.seed)) {
                bridgeWork = undefined; window.clearTimeout(bridgeClear); setBridgeStage(undefined);
            }
            if (!next.bridge) { window.clearTimeout(bridgeClear); setBridgeStage(undefined); }
            else if (bridgeWork) bridgeWork.parts = layer.objects.get('bridge')?.children[0]?.children.filter(o => o.name.startsWith('bridge-')) ?? [];
            frameCamera(camera, layout, view, width / height);
            rebuilt = { state: next, ghost: nextGhost, selected, hints: nextHints };
        };
        const resize = () => {
            const nextWidth = Math.max(1, node.clientWidth), nextHeight = Math.max(1, node.clientHeight);
            if (nextWidth !== width || nextHeight !== height) quality?.reset();
            width = nextWidth; height = nextHeight;
            renderer.setSize(width, height, false);
            frameCamera(camera, layout, view, width / height);
        };
        api.current = {
            rebuild, setTime: next => world.setTime(next),
            bridgeStart: () => {
                const current = latest.current.state;
                const resident = current.villagers.find(v => !v.away && !current.arrivals.includes(v.id));
                const model = layer?.objects.get('bridge')?.children[0];
                if (!current.bridge || !resident || !model) return;
                const parts = model.children.filter(o => o.name.startsWith('bridge-'));
                parts.forEach(o => { o.visible = false; });
                bridgeWork = { at: performance.now(), resident: resident.id, owner: current.seed, parts };
                window.clearTimeout(bridgeClear); setBridgeStage('building');
            },
            turn: by => { view.azimuth += by * Math.PI / 6; frameCamera(camera, layout, view, width / height); },
            cheer: () => { const now = performance.now(); world.life.hop('visitor', now); world.life.hop('pokomoko', now + 120); },
            moment: shown => {
                const at = shown.cell ? layout.point(shown.cell) : new T.Vector3(0, 0, 0);
                moments.play(shown.moment, at, performance.now(), reduced);
            },
            concert: (cell, receipt) => { world.life.startConcert(cell, performance.now()); pendingConcert = receipt; },
            focus: id => {
                playFocus = undefined;
                const target = world.life.focusPositionOf(id) ?? layer?.objects.get(id)?.position.clone().add(new T.Vector3(0, 0, id === 'bridge' ? 1.1 : 0)); if (!target) return;
                view.zoom = Math.max(view.zoom, id === 'bridge' ? 1.35 : 2.2);
                const home = frameCamera(camera, layout, { ...view, pan: { x: 0, z: 0 } }, width / height);
                view.pan = { x: target.x - home.x, z: target.z - home.z };
                frameCamera(camera, layout, view, width / height);
                node.dataset.growingFocus = id;
                node.dataset.growingFocusCell = JSON.stringify(layout.cellAt(target));
            },
            festival: () => {
                const now = performance.now();
                world.life.celebrate(now);
                if (!reduced) world.life.positions().forEach((position, i) => window.setTimeout(() => effects.confetti(position, performance.now()), i * 180));
            },
        };
        rebuild(latest.current.state, latest.current.ghost, latest.current.selectedId, latest.current.hints);
        const snap = (shotCamera: T.Camera, scene: T.Scene, w: number, h: number) => {
            // Render once at the picture size and copy it in the same task, then restore the view.
            const ratio = renderer.getPixelRatio();
            renderer.setPixelRatio(1); renderer.setSize(w, h, false);
            renderer.render(scene, shotCamera);
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(renderer.domElement, 0, 0, w, h);
            renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
            renderer.render(world.scene, camera);
            return canvas;
        };
        cameraRef.current?.({
            menuPictures: menuPictureMaker(renderer, world.m),
            capture: (w, h) => {
                const shot = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
                frameCamera(shot, layout, initialView(), w / h);
                try { return snap(shot, world.scene, w, h); } catch { return undefined; }
            },
            portraits: (villagers, size) => {
                const out: Record<string, string> = {}, scene = new T.Scene();
                scene.background = new T.Color('#fff4dc');
                scene.add(new T.HemisphereLight('#ffffff', '#c8b89a', 2.4));
                const key = new T.DirectionalLight('#ffffff', 1.4); key.position.set(1, 2, 3); scene.add(key);
                const lens = new T.PerspectiveCamera(30, 1, .1, 20);
                for (const villager of villagers) {
                    const actor = makeVillagerActor(world.m, villager); scene.add(actor.root);
                    actor.root.rotation.y = .3;
                    lens.position.set(.18, .7, 1.25); lens.lookAt(0, .6, 0);
                    try { out[villager.id] = snap(lens, scene, size, size).toDataURL('image/png'); } catch { /* A missing face falls back to its initial. */ }
                    disposeActor(actor);
                }
                return out;
            },
        });
        world.setTime(latest.current.time);
        resize();
        const observer = new ResizeObserver(resize); disposers.push(() => observer.disconnect()); observer.observe(node);

        const loop = () => {
            if (lost) return;
            frame = requestAnimationFrame(loop);
            const now = performance.now(), delta = Math.min(64, now - last); last = now;
            const current = latest.current.state;
            if (layer) {
                updateGrowingFingerTargets(layer.fingerTargets, camera, width);
                const sailing = !docked(current);
                layer.visitorBoat.visible = sailing;
                if (sailing) layer.visitorBoat.position.lerpVectors(layout.far, layout.dock, boatProgress(current));
                const bob = reduced ? 0 : Math.sin(now / 700) * .03;
                layer.visitorBoat.position.y = layout.dock.y + bob; layer.arrivalBoat.position.y = layout.dock.y + bob;
                layer.nextBoat.position.y = layout.farther.y + (reduced ? 0 : Math.sin(now / 900 + 1) * .03);
                for (const bud of layer.buds.values()) {
                    const inner = bud.children[0];
                    if (inner && !reduced) { inner.position.y = .42 + Math.sin(now / 420) * .05; inner.rotation.y = now / 1400; }
                }
            }
            if (layer) {
                const pulse = .6 + Math.sin(now / 280) * .4;
                for (const glow of layer.glows) { glow.scale.setScalar(.9 + pulse * .2); (glow.material as T.MeshBasicMaterial).opacity = pulse; (glow.material as T.MeshBasicMaterial).transparent = true; }
                layer.flag.getObjectByName('growing-flag-cloth')!.rotation.y = reduced ? 0 : Math.sin(now / 500) * .15;
            }
            if (latest.current.show !== showing) {
                showing = Boolean(latest.current.show);
                playFocus = undefined;
                if (showing) { view.zoom = 1; view.pan = { x: 0, z: 0 }; }
            }
            if (latest.current.show) {
                // Show mode (§13): the camera slowly circles the whole island and friends wave in turn.
                view.azimuth += delta * (reduced ? .00004 : .00012);
                frameCamera(camera, layout, view, width / height);
                if (now > nextWave) { world.life.celebrate(now); nextWave = now + 6000; }
            }
            if (playFocus && !latest.current.show) {
                const elapsed = now - playFocus.at;
                const amount = playFocus.restoring ? Math.min(1, elapsed / 420)
                    : elapsed < 360 ? ease(elapsed / 360)
                        : elapsed < DROP_PLAY_MS - 850 ? 1
                            : 1 - ease(Math.min(1, (elapsed - (DROP_PLAY_MS - 850)) / 850));
                const weight = playFocus.restoring ? ease(amount) : amount;
                const base = !playFocus.restoring && elapsed >= DROP_PLAY_MS - 850 ? playFocus.returnTo : playFocus.from;
                view.zoom = base.zoom + (playFocus.to.zoom - base.zoom) * weight;
                view.pan.x = base.pan.x + (playFocus.to.pan.x - base.pan.x) * weight;
                view.pan.z = base.pan.z + (playFocus.to.pan.z - base.pan.z) * weight;
                frameCamera(camera, layout, view, width / height);
                if (elapsed >= (playFocus.restoring ? 420 : DROP_PLAY_MS)) playFocus = undefined;
            }
            world.life.tick(now, delta, reduced, latest.current.time === 'night');
            if (bridgeWork && current.bridge) {
                const { at, resident, parts } = bridgeWork, elapsed = now - at;
                const buildTime = reduced ? 1500 : 3000, crossTime = reduced ? 1500 : 3000;
                const progress = Math.min(1, elapsed / buildTime);
                parts.forEach(o => { o.visible = o.name.startsWith('bridge-board-') ? progress >= (Number(o.name.slice(13)) + 1) / 8 : progress >= 1; });
                const shore = layout.point(bridgeAnchor(current)), end = layout.point(bridgeEnd(current));
                const poko = world.life.root.getObjectByName('growing-pokomoko');
                const friend = world.life.root.getObjectByName(`growing-villager-${resident}`);
                if (poko) { poko.visible = true; poko.position.set(shore.x - .38, shore.y + .10 + (reduced ? 0 : Math.abs(Math.sin(now / 150)) * .06), shore.z + .35 + progress * 1.8); poko.rotation.y = .3; }
                if (friend) {
                    friend.visible = true;
                    const crossing = Math.min(1, Math.max(0, (elapsed - buildTime) / crossTime));
                    friend.position.set(shore.x + .12, shore.y + .12 + (reduced ? 0 : Math.abs(Math.sin(now / 170)) * .04), shore.z + crossing * (end.z - shore.z));
                    friend.rotation.y = 0;
                }
                if (elapsed >= buildTime && !bridgeWork.crossing) { bridgeWork.crossing = true; setBridgeStage('crossing'); }
                if (elapsed >= buildTime + crossTime) {
                    parts.forEach(o => { o.visible = true; });
                    world.life.finishBridgeBuild(resident, bridgeEnd(current));
                    bridgeWork = undefined; setBridgeStage('arrived');
                    bridgeClear = window.setTimeout(() => setBridgeStage(undefined), 2200);
                }
            }
            effects.tick(now, delta);
            moments.ambient(now, latest.current.time === 'night', current.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).length, camera.position.clone().setY(0), reduced);
            moments.tick(now);
            world.animate(now, reduced);
            try {
                const ratio = quality?.sample(now, latest.current.active && width > 1 && height > 1 && document.visibilityState === 'visible');
                if (ratio !== undefined && ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
                renderer.domElement.dataset.pixelRatio = String(renderer.getPixelRatio());
                if (quality) renderer.domElement.dataset.qualityLimit = String(quality.ceilingRatio);
                renderer.render(world.scene, camera);
                const pose = `${camera.matrixWorld.elements.join(',')}:${camera.projectionMatrix.elements.join(',')}`;
                if (pose !== publishedCamera) {
                    publishedCamera = pose;
                    node.dataset.growingCamera = JSON.stringify({ matrixWorld: camera.matrixWorld.toArray(), projectionMatrix: camera.projectionMatrix.toArray(), center: layout.center });
                }
            } catch (error) { fail('render', error); return; }
            if (renderer.getContext().isContextLost()) { fail('context-lost'); return; }
            if (layer && latest.current.active && document.visibilityState === 'visible') {
                const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
                const shownHandler = handlerRef.current.onPlaceShown;
                if (shownHandler) for (const place of layer.places) {
                    if (place.stage !== 'grown' && place.stage !== 'lived') continue;
                    const placeObject = layer.placeRoot.children.find(child => child.userData.placeId === place.id)
                        ?? (place.ruleId === 'P01' ? layer.placeRoot.children.find(child => {
                            const larger = layer!.places.find(p => p.id === child.userData.placeId && p.ruleId === 'P02');
                            return larger && place.mainIds.every(id => larger.mainIds.includes(id));
                        }) : undefined);
                    const receiptKey = `${place.ruleId}:${place.revision}`;
                    if (!placeObject || !frustum.intersectsBox(new T.Box3().setFromObject(placeObject)) || placeShown.has(receiptKey) || (shownRetry.get(receiptKey) ?? 0) > now) continue;
                    placeShown.add(receiptKey);
                    Promise.resolve(shownHandler({ ruleId: place.ruleId, revision: place.revision })).then(saved => {
                        if (saved === false) { placeShown.delete(receiptKey); shownRetry.set(receiptKey, performance.now() + 1500); }
                    }).catch(() => { placeShown.delete(receiptKey); shownRetry.set(receiptKey, performance.now() + 1500); });
                }
                const actionHandler = handlerRef.current.onPlaceUse;
                if (actionHandler) {
                    const due = useRetry.filter(retry => retry.at <= now); useRetry = useRetry.filter(retry => retry.at > now);
                    due.forEach(retry => world.life.retryPlaceUse(retry.receipt));
                    for (const receipt of world.life.takePlaceUses()) {
                        const position = world.life.positionOf(receipt.actorId);
                        if (!position || !frustum.containsPoint(position)) { world.life.deferPlaceUse(receipt); continue; }
                        Promise.resolve(actionHandler(receipt)).then(saved => {
                            if (saved === false) useRetry.push({ receipt, at: performance.now() + 1500 });
                        }).catch(() => useRetry.push({ receipt, at: performance.now() + 1500 }));
                    }
                }
                node.dataset.placeCount = String(layer.places.filter(place => place.stage === 'grown' || place.stage === 'lived').length);
                node.dataset.placeRelations = layer.relations.map(relation => relation.id).join(',');
                node.dataset.placeTopology = layer.places.map(place => `${place.ruleId}:${place.variant}:${place.stage}`).join('|');
                if (import.meta.env.DEV && now >= nextTelemetry) {
                    nextTelemetry = now + 250;
                    const rect = renderer.domElement.getBoundingClientRect();
                    const screen = (position: T.Vector3) => { const p = position.clone().project(camera); return { screenX: rect.left + (p.x + 1) * rect.width / 2, screenY: rect.top + (1 - p.y) * rect.height / 2 }; };
                    node.dataset.placeActors = JSON.stringify(world.life.objects().map(actor => ({ id: actor.userData.actorId, x: actor.position.x, y: actor.position.y, z: actor.position.z, ...screen(new T.Box3().setFromObject(actor).getCenter(new T.Vector3())) })));
                    node.dataset.placeTargets = JSON.stringify(layer.places.flatMap(place => place.useTargets.map(target => {
                        const floor = target.kind === 'gallery' ? target.route?.reduce((highest, point) => point.y > highest.y ? point : highest, target.route[0]) : undefined;
                        const position = floor ? layout.floorPoint(floor).add(new T.Vector3(0, .01, 0)) : layout.point(target.cell, target.kind === 'seat' ? .18 : .06);
                        const entrance = screen(layout.point(target.cell, .06));
                        return { placeId: place.id, ruleId: place.ruleId, targetId: target.id, kind: target.kind, cell: target.cell,
                            floorY: position.y, entranceScreenX: entrance.screenX, entranceScreenY: entrance.screenY, ...screen(position) };
                    })));
                }
            }
            if (pendingConcert !== undefined && document.visibilityState === 'visible') {
                const receipt = pendingConcert; pendingConcert = undefined;
                if (world.life.concertActive(now)) handlerRef.current.onConcertStarted?.(receipt);
            }
            if (!shown) { shown = true; handlerRef.current.onStage?.('ready'); }
        };
        let shown = false;
        const placeShown = new Set<string>(), shownRetry = new Map<string, number>();
        let useRetry: { receipt: PlaceUseReceipt; at: number }[] = [];
        let nextTelemetry = 0;
        loop();
        if (lost) return release;

        // Touch: a still tap selects; a drag pans, or carries a friend; two fingers zoom.
        const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
        let moved = false, carrying: string | undefined, pendingActor: string | undefined, pinch = 0, twist = 0;
        const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -.04);
        const cast = (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            if (layer) updateGrowingFingerTargets(layer.fingerTargets, camera, rect.width);
            ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
            ray.setFromCamera(ndc, camera); return ray;
        };
        const ground = (event: PointerEvent) => world.groundAt(cast(event)) ?? ray.ray.intersectPlane(plane, new T.Vector3());
        const actorAt = (event: PointerEvent) => {
            const actors = world.life.objects();
            const direct = cast(event).intersectObjects(actors, true)[0]?.object.userData.actorId as string | undefined;
            if (direct) return direct;
            // Tiny moving friends still need a finger-sized drag start. This fallback is
            // limited to actors; ordinary object taps keep their visible hit priority.
            const rect = renderer.domElement.getBoundingClientRect();
            const radius = event.pointerType === 'touch' ? 25 : 16;
            let nearest: { id: string; distance: number } | undefined;
            for (const root of actors) {
                const id = root.userData.actorId as string | undefined;
                if (!id || id === 'visitor') continue;
                const center = new T.Box3().setFromObject(root).getCenter(new T.Vector3()).project(camera);
                const x = rect.left + (center.x + 1) * rect.width / 2, y = rect.top + (1 - center.y) * rect.height / 2;
                const distance = Math.hypot(event.clientX - x, event.clientY - y);
                if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { id, distance };
            }
            return nearest?.id;
        };
        const down = (event: PointerEvent) => {
            try { renderer.domElement.setPointerCapture(event.pointerId); } catch { /* A pointer that already ended cannot be captured. */ }
            if (playFocus) { interruptedOrigin = playFocus.returnTo; playFocus = undefined; }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY });
            if (pointers.size === 1) { moved = false; pendingActor = actorAt(event); carrying = undefined; }
            if (pointers.size === 2) {
                interruptedOrigin = undefined;
                const [a, b] = [...pointers.values()];
                pinch = Math.hypot(a.x - b.x, a.y - b.y); twist = Math.atan2(b.y - a.y, b.x - a.x); pendingActor = undefined;
                if (carrying) { world.life.cancelCarry(carrying, performance.now()); carrying = undefined; }
            }
        };
        const move = (event: PointerEvent) => {
            const p = pointers.get(event.pointerId); if (!p) return;
            const dx = event.clientX - p.x, dy = event.clientY - p.y; p.x = event.clientX; p.y = event.clientY;
            if (pointers.size === 2) {
                interruptedOrigin = undefined;
                const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0) view.zoom = Math.max(1, Math.min(4, view.zoom * distance / pinch));
                // Two fingers twisting turn the island, as on the current island.
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                let turn = angle - twist; if (turn > Math.PI) turn -= Math.PI * 2; if (turn < -Math.PI) turn += Math.PI * 2;
                view.azimuth += turn; twist = angle;
                pinch = distance; moved = true; frameCamera(camera, layout, view, width / height); return;
            }
            if (!moved && Math.hypot(event.clientX - p.sx, event.clientY - p.sy) < 7) return;
            moved = true;
            if (pendingActor && !carrying && world.life.pick(pendingActor)) { carrying = pendingActor; handlerRef.current.onActorDrag?.(); }
            pendingActor = undefined;
            if (carrying) { const point = ground(event); if (point) world.life.drag(carrying, point); return; }
            interruptedOrigin = undefined;
            panFromDrag(camera, view, dx, dy, width, height); frameCamera(camera, layout, view, width / height);
        };
        const up = (event: PointerEvent) => {
            if (!pointers.delete(event.pointerId)) return;
            if (carrying) {
                const id = carrying, finalPoint = ground(event);
                if (finalPoint) world.life.drag(id, finalPoint);
                const play = finalPoint ? world.life.drop(id, performance.now()) : undefined;
                if (!finalPoint) world.life.cancelCarry(id, performance.now());
                carrying = undefined;
                if (play) { focusOnPlay(play.cell); handlerRef.current.onActorPlay?.(id, play.kind); }
                else restoreFocus();
                return;
            }
            if (moved || pointers.size) { restoreFocus(); return; }
            restoreFocus();
            const h = handlerRef.current;
            if (latest.current.ghost) {
                // While placing, every tap chooses the cell under the finger.
                const point = ground(event); if (point) h.onCell(layout.cellAt(point)); return;
            }
            const hits = cast(event).intersectObjects([...(layer ? [layer.root] : []), ...world.life.objects(), world.scene], true);
            // The invisible finger target of a tiny seed must never steal a visible
            // neighboring flower, bench, home, friend, or bud at an oblique angle.
            const rect = renderer.domElement.getBoundingClientRect();
            const target = chooseGrowingFingerTarget(hits, camera, rect.width, rect.height,
                event.clientX - rect.left, event.clientY - rect.top, Boolean(layer?.arrivalBoat.visible));
            if (target) {
                const hit = target;
                const data = hit.object.userData;
                if (data.budId) { h.onOpen(data.budId); return; }
                if (data.boat === 'arrival' && layer?.arrivalBoat.visible) { h.onDisembark(); return; }
                if (data.actorId) { world.life.hop(data.actorId, performance.now()); h.onActorTap(data.actorId); return; }
                if (data.galleryTarget && data.placeId && world.life.visitGallery('pokomoko', data.placeId, performance.now())) return;
                if (data.objectId) { h.onSelect(data.objectId); return; }
            }
            const nearbyActor = actorAt(event);
            if (nearbyActor) { world.life.hop(nearbyActor, performance.now()); h.onActorTap(nearbyActor); return; }
            const point = ground(event);
            if (point) { h.onSelect(undefined); h.onCell(layout.cellAt(point)); }
        };
        const cancel = (event: PointerEvent) => {
            if (!pointers.delete(event.pointerId)) return;
            if (carrying) { world.life.cancelCarry(carrying, performance.now()); carrying = undefined; }
            pendingActor = undefined; moved = true;
            if (!pointers.size) restoreFocus();
        };
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            playFocus = undefined; interruptedOrigin = undefined;
            view.zoom = Math.max(1, Math.min(4, view.zoom * Math.exp(-event.deltaY * .002)));
            frameCamera(camera, layout, view, width / height);
        };
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
        canvas.addEventListener('wheel', wheel, { passive: false });
        disposers.push(() => {
            canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
            canvas.removeEventListener('wheel', wheel);
        });
        return release;
        } catch (error) { if (!released) fail('scene-initialization', error); }
        })();
        return release;
    // A retry mounts a fresh world; its graphics profile is fixed for that lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { api.current?.rebuild(state, ghost, selectedId, hints); }, [state, ghost, selectedId, hints]);
    useEffect(() => { if (moment) api.current?.moment(moment); }, [moment]);
    useEffect(() => { if (focus) api.current?.focus(focus.id); }, [focus]);
    useEffect(() => { if (concert) api.current?.concert(concert.cell, concert.n); }, [concert]);
    useEffect(() => { if (bridgeBuild) api.current?.bridgeStart(); }, [bridgeBuild]);
    useEffect(() => { api.current?.setTime(time); }, [time]);
    useEffect(() => { if (cheer) api.current?.cheer(); }, [cheer]);
    useEffect(() => { if (festival) api.current?.festival(); }, [festival]);
    const lastTurn = useRef(turn);
    useEffect(() => { if (turn !== lastTurn.current) { api.current?.turn(turn - lastTurn.current); lastTurn.current = turn; } }, [turn]);

    return <div className="growing-world" ref={host} data-growing-world data-visual-candidate="growing-island-v1" data-art-candidate={nativeArtEnabled ? 'native05-owned-runtime-v1' : 'native-05-place-runtime-v3'} data-native-growing-art={String(nativeArtEnabled)} data-growing-feature-enabled="true">
        {failed && <p className="growing-world-failed">しまを ひょうじ できなかったよ。よみなおしてみてね。</p>}
        {bridgeStage && <div className="growing-bridge-caption" data-bridge-stage={bridgeStage} role="status">
            {bridgeStage === 'building' ? 'ぽこもこが はしを つくっているよ' : bridgeStage === 'crossing' ? 'なかまが わたっているよ' : 'むこうまで いけた！'}
        </div>}
    </div>;
}
