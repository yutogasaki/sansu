import { dugWater } from '../../../domain/growingIsland/environment';
import { WonderScenery } from './wonderScenery';
import { skinTheme, toneLight } from './themeSkin';
import { TERRAIN_SEA_LEVEL } from '../../../domain/growingIsland/editableTerrainWorld';
import { placePlay } from '../../../domain/growingIsland/placePlay';
import { concertPlace, type SharedPlayReceipt } from '../../../domain/growingIsland/experience';
import { PlaceTouchEffects } from './placeTouchEffects';
import { SharedPlayOverlap } from './sharedPlay';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { GardenTime } from '../three/garden/presentation';
import { boatProgress, docked } from '../../../domain/growingIsland';
import type { Cell, GrowingState, Moment, OccupiedPlaceTarget, Villager } from '../../../domain/growingIsland';
import { disposeActor, makeVillagerActor } from './actors';
import { MomentEffects } from './momentEffects';
import { buildObjectLayer, previewGrowingState, type Ghost, type ObjectLayer } from './objectLayer';
import { frameCamera, framePlaceCamera, initialView, panFromDrag, panToFocus, revealPlaceCamera } from './growingCamera';
import { createWorldScene } from './worldScene';
import { WorldEffects } from './worldEffects';
import type { SceneLayout } from './sceneLayout';
import { menuPictureMaker, type MenuPictures } from './menuMiniatures';
import { catalogPictureMaker, type CatalogPictures } from './catalogPictures';
import { chooseGrowingFingerTarget, updateGrowingFingerTargets } from './growingFingerTargets';
import type { DropPlayKind } from './growingDropPlay';
import { DROP_PLAY_MS } from './growingDropPlay';
import { AdaptiveIslandQuality } from '../three/adaptiveIslandQuality';
import { createIslandRenderer } from '../three/createIslandRenderer';
import { retainSharedRendererCache } from '../three/sharedRendererCache';
import { bridgeAnchor, bridgeEnd, landCells } from '../../../domain/growingIsland/space';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import type { PlaceUseReceipt } from './growingLife';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import type { IslandWorld as CompiledWorld } from '../../../domain/growingIsland/worldDefinition';
import type { AuthoredCoastSkin } from './native/authoredGrowingGround';
import type { AuthoredWaterBridgeSkin } from './native/authoredWaterBridgeArt';
import type { NativeAuthoredFlower } from './native/nativeAuthoredFlower';
import type { NativeAuthoredCove } from './native/nativeAuthoredCove';
import { makeGrowingInteractionWarmBank, warmGrowingShaders } from './growingShaderWarmup';
import { growingSceneStateKey, growingScenePreviewKey } from './growingSceneInputs';
import { AUTHORED_COVE_VISUAL_CANDIDATE } from '../../../domain/growingIsland/authoredCoveWorld';
import { AUTHORED_SHOULDER_CANDIDATE, type AuthoredShoulderProfile } from '../../../domain/growingIsland/authoredShoulderWorld';
import type { AuthoredGrowthTerrainCatalog } from '../../../domain/growingIsland/authoredGrowthTerrain';
import type { NativeAuthoredShoulder } from './native/nativeAuthoredShoulder';
import { AUTHORED_WHOLE_ART_CANDIDATE, type AuthoredWholeArt } from './authoredWholeArt';

const sessionViews = new Map<string, ReturnType<typeof initialView>>();

export interface WorldHandlers {
    onViewReturn?: (available: boolean) => void;
    onCell: (cell: Cell) => void;
    /** DEV terrain brush: the cells a one-finger stroke has crossed so far, and when it ends. */
    onPaint?: (cells: Cell[], done: boolean) => void;
    onSelect: (id?: string) => void;
    onOpen: (plotId: string) => void;
    onDisembark: () => void;
    onActorTap: (id: string, playing?: boolean) => void;
    onPlayStopped?: () => void;
    onSharedPlay?: (receipt: SharedPlayReceipt) => boolean | void | Promise<boolean | void>;
    onPlaceReplyStep?: (kind: 'leaves' | 'water' | 'petals', index: number) => void;
    onPlaceReply?: (kind: 'leaves' | 'water' | 'petals', count: number) => void;
    onActorDrag?: () => void;
    onActorPlay?: (id: string, kind: DropPlayKind) => void;
    onPop?: () => void;
    /** The world's own loading steps: the scene is built, then the first picture is on screen. */
    onStage?: (stage: 'scene' | 'ready' | 'failed') => void;
    onQualityFallback?: (ceiling: number) => void;
    onFailure?: (detail: string) => void;
    onBridgeComplete?: () => void;
    onConcertStarted?: (receipt: number) => void;
    onPlaceShown?: (receipt: { ruleId: DerivedPlace['ruleId']; revision: string }) => boolean | void | Promise<boolean | void>;
    onPlaceUse?: (receipt: PlaceUseReceipt) => boolean | void | Promise<boolean | void>;
}
/** Pictures of the island for the card and the island's story; never uploaded anywhere. */
export interface WorldCamera {
    terrainActors: () => Cell[];
    occupiedTerrainPlaceTargets: () => OccupiedPlaceTarget[];
    visitPlace: (placeId: string) => boolean;
    interact: (id: string) => boolean;
    distance: (close: boolean) => void;
    /** Shaping ground: the island centred at no closer than the usual view, or a closer look. */
    terrainView: (close: boolean, inset?: number) => void;
    /** Pans, at the same zoom, until these cells are on screen; a view that shows them stays. */
    showCells: (cells: readonly Cell[]) => void;
    /** あと1つ: warm tiles where a place will reach once the picked thing grows; pale where it is now. */
    showFuture: (area: readonly Cell[], now: readonly Cell[]) => void;
    /** Petals over a thing the child just grew, so the change is seen where it happened. */
    celebrate: (id: string) => void;
    restoreView: () => void;
    catalogPictures: (state: GrowingState) => CatalogPictures;
    capture: (width: number, height: number) => HTMLCanvasElement | undefined;
    portraits: (villagers: readonly Villager[], size: number) => Record<string, string>;
    menuPictures: (villagers: readonly Villager[]) => MenuPictures;
}
export interface ShownMoment { id: number; moment: Moment; cell?: Cell }
/** `cheer` makes the waiting friend jump (a home seed was planted); `festival` celebrates a new level. */
type Props = WorldHandlers & { terrainEditing?: boolean; terrainBrush?: boolean; terrainCell?: Cell; viewKey?: string; state: GrowingState; world?: CompiledWorld; authoredWater?: boolean; authoredCove?: boolean; authoredShoulder?: AuthoredShoulderProfile; authoredGrowthTerrain?: AuthoredGrowthTerrainCatalog; authoredWholeArt?: boolean; time: GardenTime; ghost?: Ghost; selectedId?: string; turn: number; cheer: number; festival: number;
    hints?: readonly Cell[]; moment?: ShownMoment; show?: boolean; active?: boolean; playActive?: boolean; compact?: boolean; qualityCeiling?: number; focus?: { id: string; n: number }; concert?: { cell: Cell; n: number }; bridgeBuild?: number; onCamera?: (camera?: WorldCamera) => void };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const nativeArtEnabled = import.meta.env.DEV || import.meta.env.VITE_NATIVE_GROWING_ART === 'true';

export default function GrowingWorld({ terrainEditing = false, terrainBrush = false, terrainCell, viewKey, state, world: authoredWorld, authoredWater = false, authoredCove = false, authoredShoulder, authoredGrowthTerrain, authoredWholeArt = false, time, ghost, selectedId, turn, cheer, festival, hints, moment, show, active = true, playActive = true, compact, qualityCeiling = 1.25, focus, concert, bridgeBuild, onCamera, ...handlers }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const handlerRef = useRef(handlers);
    useEffect(() => { handlerRef.current = handlers; });
    const api = useRef<{ rebuild: (state: GrowingState, ghost?: Ghost, selectedId?: string, hints?: readonly Cell[]) => void; setTime: (time: GardenTime) => void; turn: (by: number) => void;
        terrainArea: (on: boolean) => void;
        cheer: () => void; festival: () => void; moment: (m: ShownMoment) => void; focus: (id: string) => void; concert: (cell: Cell, receipt: number) => void; endMusic: () => void } | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    const completedBridge = useRef<{ owner: string; request: number } | undefined>(undefined);
    const [bridgeStage, setBridgeStage] = useState<'building' | 'crossing' | 'arrived'>();
    const latest = useRef({ state, ghost, selectedId, time, hints, show, active, playActive, bridgeBuild, terrainEditing, terrainBrush, terrainCell });
    useEffect(() => { latest.current = { state, ghost, selectedId, time, hints, show, active, playActive, bridgeBuild, terrainEditing, terrainBrush, terrainCell }; });
    useEffect(() => { if (!bridgeBuild) completedBridge.current = undefined; }, [bridgeBuild]);
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
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.shadowMap.enabled = !light; renderer.shadowMap.type = T.PCFShadowMap;
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
        let coast: AuthoredCoastSkin | undefined;
        let waterBridgeSkin: AuthoredWaterBridgeSkin | undefined;
        let flowerSupport: NativeAuthoredFlower | undefined;
        let cove: NativeAuthoredCove | undefined;
        let shoulder: NativeAuthoredShoulder | undefined;
        let wholeArt: AuthoredWholeArt | undefined;
        if (authoredWorld) {
            const { loadAuthoredCoastSkin, loadAuthoredWaterBridgeSkin, loadAuthoredFlowerSupportSkin, loadAuthoredCove, loadAuthoredShoulder, loadAuthoredWholeArt } = await import('./native/authoredGrowingAssets');
            coast = await loadAuthoredCoastSkin(abort.signal);
            node.dataset.authoredCoastSource = coast.source.sha256;
            const flowerSkin = await loadAuthoredFlowerSupportSkin(abort.signal);
            const { makeNativeAuthoredFlower } = await import('./native/nativeAuthoredFlower');
            if (released) return;
            flowerSupport = makeNativeAuthoredFlower(flowerSkin);
            disposers.push(() => flowerSupport?.dispose());
            node.dataset.authoredFlowerSource = flowerSkin.source.sha256;
            node.dataset.authoredFlowerSupport = flowerSkin.source.id;
            if (authoredWater) {
                waterBridgeSkin = await loadAuthoredWaterBridgeSkin(abort.signal);
                node.dataset.authoredWaterBridgeSource = waterBridgeSkin.source.sha256;
                node.dataset.authoredWaterBridgeId = waterBridgeSkin.source.id;
            }
            if (authoredCove) {
                cove = await loadAuthoredCove(abort.signal);
                disposers.push(() => cove?.dispose());
                node.dataset.authoredCoveSource = cove.sourceSha256;
                node.dataset.authoredCoveSourceId = cove.sourceId;
            }
            if (authoredShoulder) {
                shoulder = await loadAuthoredShoulder(abort.signal);
                disposers.push(() => shoulder?.dispose());
                node.dataset.authoredShoulderSource = shoulder.sourceSha256;
                node.dataset.authoredShoulderSourceId = shoulder.sourceId;
            }
            if (authoredWholeArt) {
                wholeArt = await loadAuthoredWholeArt(abort.signal);
                disposers.push(() => { wholeArt?.forest.dispose(); wholeArt?.gallery.dispose(); });
                node.dataset.authoredForestSource = wholeArt.forest.sourceSha256;
                node.dataset.authoredGallerySource = wholeArt.gallery.sourceSha256;
            }
        }
        if (released) return;
        const world = createWorldScene(renderer, native, authoredWorld, coast, authoredWater, waterBridgeSkin, authoredCove, authoredShoulder, shoulder, authoredGrowthTerrain); disposers.push(() => world.dispose());
        const releaseSharedCache = retainSharedRendererCache(world.m.residentFabric());
        disposers.push(releaseSharedCache);
        let bridgeWork: { at: number; resident: string; owner: string; request: number; parts: T.Object3D[]; crossing?: boolean } | undefined;
        let bridgeClear = 0;
        disposers.push(() => window.clearTimeout(bridgeClear));
        const effects = new WorldEffects(world.scene); disposers.push(() => effects.dispose());
        let nextSplash = 0;
        const moments = new MomentEffects(world.scene); disposers.push(() => moments.dispose());
        const wonders = new WonderScenery(world.scene); disposers.push(() => wonders.dispose());
        wonders.chime = () => { if (latest.current.active && document.visibilityState === 'visible') handlerRef.current.onPop?.(); };
        // A special island's own light over the time of day; setting the time resets the lights, so it is laid again after.
        let theme: GrowingState['theme'], untone: (() => void) | undefined;
        const tone = (time: typeof latest.current.time) => { untone = toneLight(theme, time, world.scene, world.hemi, world.sun); };
        const setTime = (time: typeof latest.current.time) => { untone = undefined; world.setTime(time); tone(time); };
        let species: T.Object3D[] = [];
        /** Each island species has its own small motion (island-journey.md §4). */
        const moveSpecies = (now: number) => species.forEach((model, i) => {
            const t = now / 1000 + i * 1.7, id = model.userData.species as string;
            model.position.set(0, 0, 0); model.rotation.set(0, model.rotation.y, 0);
            if (id === 'leaf-crab') { model.position.x = Math.sin(t * 1.3) * .12; model.rotation.z = Math.sin(t * 6) * .06; }
            else if (id === 'echo-bird') { const hop = (t % 2.6) / 2.6; model.position.y = hop < .2 ? Math.sin(hop / .2 * Math.PI) * .12 : 0; model.rotation.y = Math.sin(t * .8) * .8; }
            else if (id === 'fluff-sheep') { model.position.y = Math.abs(Math.sin(t * 2)) * .03; model.rotation.y = Math.sin(t * .5) * .6; }
            else if (id === 'clock-bird') { const hop = (t % 1.8) / 1.8; model.position.y = hop < .25 ? Math.sin(hop / .25 * Math.PI) * .1 : 0; model.rotation.y = Math.round(t / 1.8) * .9; }
            else if (id === 'star-jelly') { model.position.y = .15 + Math.sin(t * 1.2) * .1; model.rotation.y = t * .6; }
            else if (id === 'balloon-flower') { model.position.y = Math.sin(t * 1.5) * .04; model.rotation.z = Math.sin(t) * .08; }
            else model.rotation.z = Math.sin(t * 1.1) * .05;
            const turn = model.getObjectByName('species-turn'); if (turn) turn.rotation.y = t * 2;
        });
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100), view = initialView();
        const savedView = viewKey ? sessionViews.get(viewKey) : undefined;
        Object.assign(view, savedView ? { ...savedView, pan: { ...savedView.pan } } : { zoom: 1.5 });
        disposers.push(() => {
            if (!viewKey) return;
            sessionViews.set(viewKey, { ...view, pan: { ...view.pan } });
            if (sessionViews.size > 32) sessionViews.delete(sessionViews.keys().next().value!);
        });
        let overviewOrigin: ReturnType<typeof initialView> | undefined;
        const clearOverview = () => { if (overviewOrigin) { overviewOrigin = undefined; handlerRef.current.onViewReturn?.(false); } };
        type View = ReturnType<typeof initialView>;
        let playFocus: { at: number; from: View; to: View; returnTo: View; restoring?: boolean } | undefined;
        let interruptedOrigin: View | undefined;
        let initialClose = !savedView && !authoredWorld && !native && latest.current.state.tutorial === 'done', followingPlace: string | undefined;
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
        const terrainRingGeometry = new T.BufferGeometry();
        const terrainRingMaterial = new T.LineBasicMaterial({ color: '#ffffff', depthTest: false });
        const terrainRing = new T.LineLoop(terrainRingGeometry, terrainRingMaterial);
        terrainRing.renderOrder = 20; world.scene.add(terrainRing);
        disposers.push(() => { terrainRingGeometry.dispose(); terrainRingMaterial.dispose(); });
        let terrainRingKey = '';
        let layout: SceneLayout = world.layout(latest.current.state), layer: ObjectLayer | undefined;
        const placeViewPoints = (place: DerivedPlace, hero: T.Vector3) => {
            const points = [hero.clone().add(new T.Vector3(-.65, -.15, -.65)), hero.clone().add(new T.Vector3(.65, 1.2, .65))];
            const target = place.useTargets.find(target => ['gallery', 'garden', 'shore'].includes(target.kind));
            if (target) points.push(layout.point(target.cell, .05), layout.point(target.cell, 1.2));
            if (target?.route?.length) points.push(...target.route.map(point => layout.floorPoint(point))
                .sort((a, b) => a.distanceToSquared(hero) - b.distanceToSquared(hero)).slice(0, 8));
            return points;
        };
        let unopened = new Set<string>(), known: Set<string> | undefined, last = performance.now(), width = 1, height = 1, nextWave = 0, showing = false;
        disposers.push(() => layer?.dispose());
        const reduced = reducedMotion();
        let pendingConcert: number | undefined;
        const touchEffects = new PlaceTouchEffects(world.scene, (kind, index) => handlerRef.current.onPlaceReplyStep?.(kind, index)); disposers.push(() => touchEffects.dispose());
        let replySource: { id: string; at: number } | undefined;
        let pendingTouch: { id: string; at: number } | undefined;
        let musicPlace: DerivedPlace | undefined, musicStand: string | undefined;
        const overlap = new SharedPlayOverlap(), sharedPending = new Map<string, number>();
        const stopPlay = (notify = true) => {
            if (notify && (pendingTouch || replySource || musicStand || world.life.concertActive(performance.now()))) handlerRef.current.onPlayStopped?.();
            pendingTouch = undefined; replySource = undefined; touchEffects.clear(); overlap.clear(); sharedPending.clear(); musicPlace = undefined; musicStand = undefined; pendingConcert = undefined; world.life.stopConcert(); };
        const hiddenPlay = () => { if (document.visibilityState !== 'visible') stopPlay(); };
        document.addEventListener('visibilitychange', hiddenPlay); disposers.push(() => document.removeEventListener('visibilitychange', hiddenPlay));
        let publishedCamera = '';
        let rebuilt: { state: GrowingState; ghost?: Ghost; selected?: string; hints?: readonly Cell[]; stateKey: string; previewKey: string } | undefined;
        const sceneCounters = { fullLayerBuild: 0, previewUpdate: 0, receiptReuse: 0 };
        const counted = (kind: keyof typeof sceneCounters) => {
            if (!import.meta.env.DEV) return;
            sceneCounters[kind] = Math.min(1000000, sceneCounters[kind] + 1);
            node.dataset.growingSceneCounters = JSON.stringify(sceneCounters);
        };
        const showPreview = (next: GrowingState, nextGhost?: Ghost) => {
            const revision = world.showWaterPreview(authoredWater || authoredCove || authoredShoulder || authoredGrowthTerrain ? previewGrowingState(next, nextGhost) : undefined);
            if (revision) node.dataset.previewWorldRevision = revision;
            else delete node.dataset.previewWorldRevision;
            if (authoredCove && layer) {
                const describe = (objects: T.Object3D[]) => objects.map(object => ({ placeId: object.userData.placeId,
                    sourceSha256: object.userData.sourceSha256, visible: object.visible }));
                node.dataset.authoredCovePreview = JSON.stringify({ worldRevision: revision ?? null,
                    committed: describe(layer.placeRoot.getObjectsByProperty('name', 'authored-cove-shell')),
                    prospective: describe(layer.root.getObjectsByProperty('name', 'growing-place-preview')
                        .flatMap(root => root.getObjectsByProperty('name', 'authored-cove-shell'))) });
            }
            if (authoredShoulder && layer) {
                const components = layer.root.getObjectsByProperty('name', 'authored-tree-root-continuation').map(object => {
                    let prospective = false;
                    for (let parent: T.Object3D | null = object; parent; parent = parent.parent)
                        if (parent.name === 'growing-place-preview') prospective = true;
                    return { ownerId: object.userData.ownerId, sourceSha256: object.userData.sourceSha256,
                        artifactSha256: object.userData.artifactSha256, prospective, visible: object.visible,
                        retainedPhysical: object.userData.authoredPreviewHidden === true };
                });
                node.dataset.authoredShoulder = JSON.stringify({ candidate: authoredShoulder.candidate,
                    profilePhysicalRevision: authoredShoulder.physicalRevision, soilPresent: Boolean(world.shoulderSoil()),
                    previewWorldRevision: revision ?? null, roots: components });
            }
        };

        // While shaping the ground, the child's own land shows as soft tiles: only there does a stroke change anything.
        let terrainArea: T.Mesh | undefined;
        const showTerrainArea = (on: boolean) => {
            if (terrainArea) { world.scene.remove(terrainArea); terrainArea.geometry.dispose(); (terrainArea.material as T.Material).dispose(); terrainArea = undefined; }
            if (!on || !layout.editable) return;
            const positions: number[] = [], n = 3, size = .9;
            for (const cell of landCells(latest.current.state)) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
                const at = (a: number, b: number) => layout.point({ x: cell.x - size / 2 + (i + a) * size / n, z: cell.z - size / 2 + (j + b) * size / n }, .025);
                const [p00, p10, p01, p11] = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
                positions.push(...p00.toArray(), ...p01.toArray(), ...p10.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray());
            }
            // The edge of the child's own land is drawn as a bright rim, so a stroke starts inside it.
            const land = landCells(latest.current.state), own = new Set(land.map(c => `${c.x},${c.z}`)), rim = .1, colors: number[] = [];
            const tint = (r: number, g: number, b: number, a: number, count: number) => { for (let k = 0; k < count; k++) colors.push(r, g, b, a); };
            tint(1, 1, 1, .28, positions.length / 3);
            for (const cell of land) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                if (own.has(`${cell.x + dx},${cell.z + dz}`)) continue;
                for (let k = 0; k < n; k++) {
                    // A thin strip just inside the cell's open side, split to follow the ground.
                    const along = (t: number) => -.5 + t / n, edge = .5 - rim / 2;
                    const at = (t: number, inset: number) => layout.point(dx ? { x: cell.x + dx * (edge + inset), z: cell.z + along(t) } : { x: cell.x + along(t), z: cell.z + dz * (edge + inset) }, .035);
                    const [p00, p10, p01, p11] = [at(k, -rim / 2), at(k + 1, -rim / 2), at(k, rim / 2), at(k + 1, rim / 2)];
                    positions.push(...p00.toArray(), ...p01.toArray(), ...p10.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray());
                    tint(1, .84, .3, .95, 6);
                }
            }
            const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 4));
            terrainArea = new T.Mesh(geometry, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide }));
            terrainArea.name = 'growing-terrain-area'; terrainArea.renderOrder = 3; world.scene.add(terrainArea);
        };
        disposers.push(() => showTerrainArea(false));
        let future: T.Mesh | undefined;
        const showFuture = (area: readonly Cell[], now: readonly Cell[]) => {
            if (future) { future.removeFromParent(); future.geometry.dispose(); (future.material as T.Material).dispose(); future = undefined; }
            if (import.meta.env.DEV) node.dataset.placeFuture = JSON.stringify({ area: area.length, now: now.length });
            if (!area.length) return;
            const positions: number[] = [], colors: number[] = [], had = new Set(now.map(c => `${c.x},${c.z}`)), n = 3, size = .86;
            for (const cell of area) {
                const fresh = !had.has(`${cell.x},${cell.z}`);
                for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
                    const at = (a: number, b: number) => layout.point({ x: cell.x - size / 2 + (i + a) * size / n, z: cell.z - size / 2 + (j + b) * size / n }, .03);
                    const [p00, p10, p01, p11] = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
                    positions.push(...p00.toArray(), ...p01.toArray(), ...p10.toArray(), ...p10.toArray(), ...p01.toArray(), ...p11.toArray());
                    for (let k = 0; k < 6; k++) colors.push(...(fresh ? [1, .93, .45, .7] : [1, 1, 1, .32]));
                }
            }
            const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 4));
            future = new T.Mesh(geometry, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide }));
            future.name = 'growing-place-future'; future.renderOrder = 3; world.scene.add(future);
        };
        disposers.push(() => showFuture([], []));
        const rebuild = (next: GrowingState, nextGhost?: Ghost, selected?: string, nextHints?: readonly Cell[]) => {
            if (nextGhost) { followingPlace = undefined; initialClose = false; stopPlay(); }
            // The first props effect follows the initial scene build with the same
            // immutable inputs. Keep that scene (and its visitor) instead of rebuilding it.
            if (rebuilt?.state === next && rebuilt.ghost === nextGhost && rebuilt.selected === selected && rebuilt.hints === nextHints) return;
            const stateKey = growingSceneStateKey(next), previewKey = growingScenePreviewKey(nextGhost, selected, nextHints);
            if (rebuilt?.stateKey === stateKey && layer) {
                // Receipt-only saves and value-equivalent preview props retain
                // physical objects, routes, life, camera and bridge work. Life
                // still adopts the new canonical state for subsequent receipts.
                world.life.adoptState(next);
                if (rebuilt.previewKey !== previewKey) {
                    layer.updatePreview(nextGhost, selected, nextHints); counted('previewUpdate');
                    showPreview(next, nextGhost);
                }
                if (rebuilt.state !== next) counted('receiptReuse');
                rebuilt = { state: next, ghost: nextGhost, selected, hints: nextHints, stateKey, previewKey };
                return;
            }
            layout = world.layout(next);
            node.dataset.growingBounds = JSON.stringify(layout.bounds);
            node.dataset.worldDefinition = layout.world.id;
            node.dataset.terrainRevision = layout.world.revision ?? 'original';
            node.dataset.terrainHeights = JSON.stringify(next.terrain?.heights ?? {});
            if (layout.authored) {
                node.dataset.worldRevision = authoredCove ? layout.key.slice(layout.world.id.length + 1) : layout.world.definition.revision ?? 'base';
                node.dataset.authoredWater = JSON.stringify(layout.authoredWaterPlan);
                const covePlan = layout.authoredCovePlan;
                node.dataset.authoredCove = JSON.stringify(covePlan ? { revision: covePlan.revision, profileRevision: covePlan.profileRevision,
                    sourceId: covePlan.sourceId, sourceSha256: covePlan.sourceSha256, assemblies: covePlan.assemblies } : null);
                node.dataset.authoredFrameRevision = layout.key;
            }
            node.dataset.bridgeSaved = String(Boolean(next.bridge));
            stopPlay();
            layer?.dispose();
            layer = buildObjectLayer(world.m, next, layout, nextGhost, selected, nextHints, native, flowerSupport, cove, shoulder, wholeArt);
            counted('fullLayerBuild');
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
            wonders.build(next, layout);
            skinTheme(layer.root, next.theme); skinTheme(world.house, next.theme);
            if (theme !== next.theme) { untone?.(); theme = next.theme; tone(latest.current.time); }
            species = [];
            layer.root.traverse(o => { if (o.userData.species) species.push(o); });
            if (import.meta.env.DEV) node.dataset.wonders = JSON.stringify({ crowns: layer.root.getObjectsByProperty('name', 'rainbow-crown').length, lookouts: layer.root.getObjectsByProperty('name', 'home-lookout').length, golden: layer.root.getObjectsByProperty('name', 'golden-pumpkin').length, ship: layer.nextBoat.position.toArray().map(v => Math.round(v * 100) / 100), scenery: wonders.root.children.map(c => c.name).filter(Boolean), echo: (() => { const o = wonders.root.getObjectByName('mechanism-echo') as T.Points | undefined; return o ? [o.geometry.getAttribute('position').count, ...(o.geometry.getAttribute('position').array as Float32Array).slice(0, 3)] : null; })() });
            if (wholeArt) node.dataset.authoredWholeArt = JSON.stringify({ candidate: AUTHORED_WHOLE_ART_CANDIDATE,
                forestOwners: layer.root.getObjectsByProperty('name', 'authored-forest-tree').map(object => object.userData.ownerId),
                galleryOwners: layer.root.getObjectsByProperty('name', 'authored-gallery-structure').map(object => object.userData.ownerIds),
                galleryTraversalEnabled: false });
            if (layout.authored) node.dataset.authoredFlowerShape = JSON.stringify(layer.placeRoot.children
                .filter(place => place.userData.placeRule === 'P05')
                .map(place => ({ id: place.userData.placeId, ownerIds: place.userData.authoredFlowerOwnerIds,
                    crownCount: place.userData.authoredFlowerCrownCount, art: place.userData.authoredFlowerArt, floor: place.userData.authoredFlowerFloor })));
            if (layout.authored) node.dataset.authoredFlowerWalking = JSON.stringify(world.life.walkingObstructionProof() ?? null);
            if (layout.authored) node.dataset.authoredObstructionWalking = node.dataset.authoredFlowerWalking;
            showPreview(next, nextGhost);
            if (bridgeWork && (!next.bridge || bridgeWork.owner !== next.seed)) {
                bridgeWork = undefined; window.clearTimeout(bridgeClear); setBridgeStage(undefined);
            }
            if (!next.bridge) { window.clearTimeout(bridgeClear); setBridgeStage(undefined); }
            else if (bridgeWork) bridgeWork.parts = layer.objects.get('bridge')?.children[0]?.children.filter(o => o.name.startsWith('bridge-')) ?? [];
            frameCamera(camera, layout, view, width / height);
            showTerrainArea(latest.current.terrainEditing);
            rebuilt = { state: next, ghost: nextGhost, selected, hints: nextHints, stateKey, previewKey };
        };
        const resize = () => {
            const nextWidth = Math.max(1, node.clientWidth), nextHeight = Math.max(1, node.clientHeight);
            if (nextWidth !== width || nextHeight !== height) quality?.reset();
            width = nextWidth; height = nextHeight;
            renderer.setSize(width, height, false);
            frameCamera(camera, layout, view, width / height);
        };
        const startBridgeBuild = () => {
            const current = latest.current.state, request = latest.current.bridgeBuild;
            if (!request || bridgeWork || completedBridge.current?.owner === current.seed && completedBridge.current.request === request) return;
            const resident = current.villagers.find(v => !v.away && !current.arrivals.includes(v.id));
            const model = layer?.objects.get('bridge')?.children[0];
            if (!current.bridge || !resident || !model) return;
            const parts = model.children.filter(o => o.name.startsWith('bridge-'));
            parts.forEach(o => { o.visible = false; });
            bridgeWork = { at: performance.now(), resident: resident.id, owner: current.seed, request, parts };
            window.clearTimeout(bridgeClear); setBridgeStage('building');
            // The saved request can arrive before graphics initialization. Consume
            // it from the render loop, after the current bridge and actors exist.
            view.zoom = 1.35; api.current?.focus('bridge');
        };
        api.current = {
            rebuild, setTime, terrainArea: showTerrainArea,
            turn: by => { clearOverview(); initialClose = false; followingPlace = undefined; view.azimuth += by * Math.PI / 6; frameCamera(camera, layout, view, width / height); },
            cheer: () => { const now = performance.now(); world.life.hop('visitor', now); world.life.hop('pokomoko', now + 120); },
            moment: shown => {
                const at = shown.cell ? layout.point(shown.cell) : new T.Vector3(0, 0, 0);
                moments.play(shown.moment, at, performance.now(), reduced, Boolean(shown.cell));
            },
            endMusic: () => { musicPlace = undefined; musicStand = undefined; overlap.clear(); sharedPending.clear(); pendingConcert = undefined; world.life.stopConcert(); },
            concert: (cell, receipt) => {
                stopPlay(false); world.life.startConcert(cell, performance.now()); pendingConcert = receipt;
                musicStand = latest.current.state.landmarks.find(item => item.kind === 'bandstand' && item.cell?.x === cell.x && item.cell.z === cell.z)?.id;
                musicPlace = musicStand ? concertPlace(latest.current.state, musicStand, (layout.authored || layout.editable) ? layout.world : undefined) : undefined;
            },
            focus: id => {
                initialClose = false; followingPlace = undefined;
                playFocus = undefined;
                const flower = layout.authored && layer?.placeRoot.children.find(place => place.userData.authoredFlowerOwnerIds?.includes(id));
                const flowerBounds = flower ? new T.Box3().setFromObject(flower) : undefined;
                const flowerCenter = flowerBounds && !flowerBounds.isEmpty() ? flowerBounds.getCenter(new T.Vector3()) : undefined;
                const target = (id === 'house' ? world.house.position.clone().add(new T.Vector3(0, .6, 0)) : undefined) ?? world.life.focusPositionOf(id) ?? flowerCenter ?? layer?.objects.get(id)?.position.clone().add(new T.Vector3(0, 0, id === 'bridge' ? 1.1 : 0)); if (!target) return;
                view.zoom = Math.max(view.zoom, id === 'bridge' ? 1.35 : 2.2);
                const home = frameCamera(camera, layout, { ...view, pan: { x: 0, z: 0 } }, width / height);
                view.pan = panToFocus(camera, home, target);
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
            terrainActors: () => world.life.terrainActors(),
            occupiedTerrainPlaceTargets: () => world.life.occupiedTerrainPlaceTargets(),
            visitPlace: placeId => {
                if (!latest.current.active || document.visibilityState !== 'visible') return false;
                const place = layer?.places.find(p => p.id === placeId);
                stopPlay();
                if (!place || !world.life.visitPlace('pokomoko', placeId, performance.now())) return false;
                initialClose = false; followingPlace = place.id;
                const hero = world.life.positionOf('pokomoko');
                if (hero) revealPlaceCamera(camera, layout, view, placeViewPoints(place, hero), hero.clone().add(new T.Vector3(0, .5, 0)), [layer!.root, world.house], width / height);
                playFocus = undefined; interruptedOrigin = undefined;
                return true;
            },
            interact: id => {
                if (!latest.current.active || document.visibilityState !== 'visible' || !placePlay(latest.current.state, id, (layout.authored || layout.editable) ? layout.world : undefined)) return false;
                if (pendingTouch?.id === id || replySource?.id === id && performance.now() - replySource.at < 900) return true;
                stopPlay();
                if (!world.life.visitOwner(id, performance.now())) return false;
                pendingTouch = { id, at: performance.now() }; api.current?.focus(id); return true;
            },
            menuPictures: menuPictureMaker(renderer, world.m),
            catalogPictures: catalogPictureMaker(renderer, world.m),
            restoreView: () => {
                if (!overviewOrigin) return;
                Object.assign(view, overviewOrigin); clearOverview(); initialClose = false; followingPlace = undefined;
                playFocus = undefined; interruptedOrigin = undefined;
                frameCamera(camera, layout, view, width / height);
            },
            showCells: cells => {
                if (!cells.length) return;
                camera.updateMatrixWorld();
                const seen = (cell: Cell) => { const p = layout.point(cell).project(camera); return Math.abs(p.x) < .85 && p.y > -.55 && p.y < .85; };
                if (cells.every(seen)) return;
                initialClose = false; followingPlace = undefined; playFocus = undefined; interruptedOrigin = undefined;
                const middle = cells.reduce<T.Vector3>((sum, cell) => sum.add(layout.point(cell)), new T.Vector3()).divideScalar(cells.length);
                const home = frameCamera(camera, layout, { ...view, pan: { x: 0, z: 0 } }, width / height);
                // Aim a little below the cells, so they sit above the placing buttons.
                view.pan = panToFocus(camera, home, middle.add(new T.Vector3(0, 0, .8)));
                frameCamera(camera, layout, view, width / height);
            },
            showFuture,
            celebrate: id => {
                const target = layer?.objects.get(id); if (!target || reduced) return;
                effects.confetti(target.getWorldPosition(new T.Vector3()), performance.now());
            },
            terrainView: (close, inset = 0) => {
                // Remember the view before shaping, so finishing goes back to it.
                initialClose = false; followingPlace = undefined; playFocus = undefined; interruptedOrigin = undefined;
                if (!overviewOrigin) { overviewOrigin = copyView(); handlerRef.current.onViewReturn?.(true); }
                view.zoom = close ? 2.4 : Math.min(overviewOrigin.zoom, 1.3);
                if (close) { frameCamera(camera, layout, view, width / height); return; }
                view.pan = { x: 0, z: 0 };
                const home = frameCamera(camera, layout, view, width / height);
                if (inset <= 0) return;
                // Lift the island toward the room above the panel: aim at the ground that sits
                // lower on the screen by half the panel's share, keeping the far shore in view.
                camera.updateMatrixWorld();
                const aim = new T.Raycaster(); aim.setFromCamera(new T.Vector2(0, -Math.min(.25, inset / 2)), camera);
                const below = aim.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -home.y), new T.Vector3());
                if (below) { view.pan = panToFocus(camera, home, below); frameCamera(camera, layout, view, width / height); }
            },
            distance: close => {
                initialClose = false; followingPlace = undefined;
                playFocus = undefined; interruptedOrigin = undefined;
                if (close) clearOverview();
                else if (!overviewOrigin) { overviewOrigin = copyView(); handlerRef.current.onViewReturn?.(true); }
                view.zoom = close ? 1.5 : 1; view.pan = { x: 0, z: 0 };
                if (close && !authoredWorld && !native) initialClose = true;
                frameCamera(camera, layout, view, width / height);
            },
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
                    const actor = makeVillagerActor(world.m, villager, layout.actorVisualScale); scene.add(actor.root);
                    actor.root.rotation.y = .3;
                    lens.position.set(.18, .7, 1.25); lens.lookAt(0, .6, 0);
                    try { out[villager.id] = snap(lens, scene, size, size).toDataURL('image/png'); } catch { /* A missing face falls back to its initial. */ }
                    disposeActor(actor);
                }
                return out;
            },
        });
        setTime(latest.current.time);
        resize();
        const observer = new ResizeObserver(resize); disposers.push(() => observer.disconnect()); observer.observe(node);
        const shaderBank = makeGrowingInteractionWarmBank(layer!.root);
        disposers.push(() => shaderBank.dispose());
        const shaderWarmStarted = performance.now(), shaderWarmMeshes = shaderBank.root.children.length;
        if (import.meta.env.DEV) node.dataset.growingShaderWarmup = JSON.stringify({ status: 'warming', meshes: shaderWarmMeshes });
        await warmGrowingShaders(renderer, camera, world.scene, shaderBank.root, abort.signal);
        if (released) return;
        shaderBank.releaseMeshes();
        if (import.meta.env.DEV) node.dataset.growingShaderWarmup = JSON.stringify({ status: 'ready', meshes: shaderWarmMeshes,
            ms: Math.round(performance.now() - shaderWarmStarted), programs: renderer.info.programs?.length ?? 0 });

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
                layer.nextBoat.position.y = (layer.nextBoat.userData.baseY ?? layout.farther.y) + (reduced ? 0 : Math.sin(now / 900 + 1) * .03);
                for (const bud of layer.buds.values()) {
                    const inner = bud.children[0];
                    if (inner && !reduced) { inner.position.y = .42 + Math.sin(now / 420) * .05; inner.rotation.y = now / 1400; }
                }
            }
            if (layer) {
                const pulse = .6 + Math.sin(now / 280) * .4;
                for (const glow of layer.glows) { glow.scale.setScalar(.9 + pulse * .2); (glow.material as T.MeshBasicMaterial).opacity = pulse; (glow.material as T.MeshBasicMaterial).transparent = true; }
                for (const light of layer.beacons) {
                    const mark = light.getObjectByName('growing-hint-mark');
                    if (mark && !reduced) { mark.position.y = 1.6 + Math.sin(now / 320) * .1; mark.rotation.y = now / 700; }
                }
                layer.flag.getObjectByName('growing-flag-cloth')!.rotation.y = reduced ? 0 : Math.sin(now / 500) * .15;
            }
            if (latest.current.show !== showing) {
                showing = Boolean(latest.current.show);
                initialClose = false; followingPlace = undefined;
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
            if (!world.hasWaterPreview() && !latest.current.terrainEditing) world.life.tick(now, delta, reduced, latest.current.time === 'night');
            if (!latest.current.active || document.visibilityState !== 'visible') followingPlace = undefined;
            const hero = world.life.positionOf('pokomoko');
            if (hero && initialClose && !latest.current.ghost && !latest.current.selectedId) {
                initialClose = false;
                revealPlaceCamera(camera, layout, view, [hero.clone().add(new T.Vector3(-2.5, 0, -1.5)), hero.clone().add(new T.Vector3(2.5, 1.7, 1.5))], hero.clone().add(new T.Vector3(0, .5, 0)), [layer!.root, world.house], width / height);
            }
            if (hero && followingPlace) {
                const place = world.life.activePlaceOf('pokomoko');
                if (!place || place.id !== followingPlace) followingPlace = undefined;
                else {
                    const desired = copyView(); framePlaceCamera(camera, layout, desired, placeViewPoints(place, hero), width / height);
                    const blend = reduced ? 1 : 1 - Math.exp(-delta / 180);
                    view.zoom += (desired.zoom - view.zoom) * blend;
                    view.pan.x += (desired.pan.x - view.pan.x) * blend; view.pan.z += (desired.pan.z - view.pan.z) * blend;
                    frameCamera(camera, layout, view, width / height);
                    node.dataset.growingPlaceFocus = place.id;
                }
            }
            if (!followingPlace) delete node.dataset.growingPlaceFocus;
            startBridgeBuild();
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
                    completedBridge.current = { owner: bridgeWork.owner, request: bridgeWork.request };
                    bridgeWork = undefined; setBridgeStage('arrived');
                    handlerRef.current.onBridgeComplete?.();
                    bridgeClear = window.setTimeout(() => setBridgeStage(undefined), 2200);
                }
            }
            if (!latest.current.active || !latest.current.playActive || document.visibilityState !== 'visible') stopPlay();
            if (pendingTouch && now - pendingTouch.at > 15000) pendingTouch = undefined;
            if (pendingTouch && world.life.nearOwner(pendingTouch.id)) {
                const source = pendingTouch.id;
                const play = placePlay(current, source, (layout.authored || layout.editable) ? layout.world : undefined);
                pendingTouch = undefined;
                if (play) {
                    replySource = { id: source, at: now };
                    const view = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
                    const count = touchEffects.start(play, layout, now, point => view.containsPoint(point), reduced, layer?.root);
                    handlerRef.current.onPlaceReply?.(play.kind, count);
                }
            }
            touchEffects.tick(now, reduced);
            // Coves and ponds the child dug have life in them: now and then a fish leaps.
            if (!reduced && now > nextSplash) {
                nextSplash = now + 3500 + Math.random() * 5000;
                const water = layout.editable ? dugWater(current) : [];
                const at = water[Math.floor(Math.random() * water.length)];
                if (at) effects.splash(layout.point(at, 0).setY(TERRAIN_SEA_LEVEL + .01), now);
            }
            effects.tick(now, delta);
            moments.ambient(now, latest.current.time === 'night', current.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).length, camera.position.clone().setY(0), reduced);
            moments.tick(now);
            wonders.tick(now, latest.current.time === 'night', reduced, camera);
            if (!reduced) moveSpecies(now);
            if (import.meta.env.DEV && now >= nextTelemetry && layer) node.dataset.shipScreen = JSON.stringify([layer.nextBoat.visible, ...layer.nextBoat.getWorldPosition(new T.Vector3()).project(camera).toArray().map(v => Math.round(v * 100) / 100)]);
            if (import.meta.env.DEV && now >= nextTelemetry) { const moon = wonders.root.getObjectByName('wonder-moon'); if (moon) node.dataset.wonderMoon = JSON.stringify(moon.getWorldPosition(new T.Vector3()).project(camera).toArray().map(v => Math.round(v * 100) / 100)); }
            const editing = latest.current.terrainEditing, selectedTerrain = latest.current.terrainCell;
            terrainRing.visible = Boolean(editing && selectedTerrain);
            const ringKey = `${layout.key}:${selectedTerrain?.x},${selectedTerrain?.z}`;
            if (terrainRing.visible && selectedTerrain && ringKey !== terrainRingKey) {
                terrainRingKey = ringKey;
                terrainRingGeometry.setFromPoints(Array.from({ length: 48 }, (_, i) => {
                    const angle = i / 48 * Math.PI * 2, cell = { x: selectedTerrain.x + Math.cos(angle) * .44, z: selectedTerrain.z + Math.sin(angle) * .44 };
                    const point = layout.point(cell, .055), support = layout.world.floorAt(cell);
                    point.y = support ? Math.max(-.36, support.point.y + .055) : -.36; return point;
                }));
            }
            node.dataset.terrainEditing = String(editing);
            node.dataset.terrainSelection = selectedTerrain ? `${selectedTerrain.x},${selectedTerrain.z}` : '';
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
                    node.dataset.growingCamera = JSON.stringify({ matrixWorld: camera.matrixWorld.toArray(), projectionMatrix: camera.projectionMatrix.toArray(), center: layout.center, curved: layout.curved });
                }
            } catch (error) { fail('render', error); return; }
            if (renderer.getContext().isContextLost()) { fail('context-lost'); return; }
            if (layer && !world.hasWaterPreview() && latest.current.active && document.visibilityState === 'visible') {
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
                    const pools = place.ruleId === 'P03' ? layout.authoredWaterPlan?.pools.filter(pool => place.mainIds.includes(pool.ownerId)) : undefined;
                    const placeBox = pools?.length ? new T.Box3().setFromPoints(pools.flatMap(pool => pool.outline.map(point => new T.Vector3(point.x - layout.center, pool.waterY, point.z - 2))))
                        : placeObject ? new T.Box3().setFromObject(placeObject) : undefined;
                    if (!placeBox || !frustum.intersectsBox(placeBox) || placeShown.has(receiptKey) || (shownRetry.get(receiptKey) ?? 0) > now) continue;
                    placeShown.add(receiptKey);
                    Promise.resolve(shownHandler({ ruleId: place.ruleId, revision: place.revision })).then(saved => {
                        if (saved === false) { placeShown.delete(receiptKey); shownRetry.set(receiptKey, performance.now() + 1500); }
                    }).catch(() => { placeShown.delete(receiptKey); shownRetry.set(receiptKey, performance.now() + 1500); });
                }
                if (musicPlace && musicStand && handlerRef.current.onSharedPlay) {
                    const hero = world.life.positionOf('pokomoko');
                    const ids = hero && frustum.containsPoint(hero) ? world.life.sharedConcertActors(now).filter(id => {
                        const point = world.life.positionOf(id); return point && frustum.containsPoint(point);
                    }) : [];
                    for (const ready of overlap.observe(now, ids)) {
                        if ((sharedPending.get(ready.actorId) ?? 0) > now || current.experience?.shared.some(memory => memory.family === musicPlace!.family && memory.actorId === ready.actorId)) continue;
                        const receipt = { ...ready, placeId: musicPlace.id, revision: musicPlace.revision, targetId: musicStand };
                        sharedPending.set(ready.actorId, Infinity);
                        const retry = () => sharedPending.set(ready.actorId, performance.now() + 1500);
                        Promise.resolve(handlerRef.current.onSharedPlay(receipt)).then(saved => { if (saved === false) retry(); }).catch(retry);
                    }
                } else overlap.clear();
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
                    if (layout.authored) node.dataset.authoredFlowerPoses = JSON.stringify(world.life.walkingPoseProof() ?? null);
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
        // DEV terrain brush: one finger paints the ground instead of moving the camera.
        let stroke: Cell[] = [], lastPaint: { x: number; y: number } | undefined;
        const painting = () => latest.current.terrainEditing && latest.current.terrainBrush;
        const terrainCellAt = (event: Pick<PointerEvent, 'clientX' | 'clientY'>): Cell | undefined => {
            const hit = world.groundAt(cast(event)) ?? ray.ray.intersectPlane(seaPlane, new T.Vector3());
            // The same reading of the ground as placing, so a stroke lands where the land is drawn.
            return hit ? layout.cellAt(hit) : undefined;
        };
        // A quick finger skips across many cells between two events: fill the path in.
        const paintAt = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
            const from = lastPaint ?? { x: event.clientX, y: event.clientY }, steps = Math.max(1, Math.ceil(Math.hypot(event.clientX - from.x, event.clientY - from.y) / 8));
            let grew = false;
            for (let i = 1; i <= steps; i++) {
                const cell = terrainCellAt({ clientX: from.x + (event.clientX - from.x) * i / steps, clientY: from.y + (event.clientY - from.y) * i / steps });
                if (!cell || stroke.some(c => c.x === cell.x && c.z === cell.z)) continue;
                stroke.push(cell); grew = true;
            }
            lastPaint = { x: event.clientX, y: event.clientY };
            if (grew && import.meta.env.DEV) node.dataset.terrainStroke = JSON.stringify(stroke);
            if (grew) handlerRef.current.onPaint?.([...stroke], false);
        };
        const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -.04), seaPlane = new T.Plane(new T.Vector3(0, 1, 0), .4);
        const cast = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
            const rect = renderer.domElement.getBoundingClientRect();
            if (layer) updateGrowingFingerTargets(layer.fingerTargets, camera, rect.width);
            ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
            ray.setFromCamera(ndc, camera); return ray;
        };
        const ground = (event: PointerEvent) => world.groundAt(cast(event)) ?? (authoredWorld ? undefined : ray.ray.intersectPlane(layout.editable ? seaPlane : plane, new T.Vector3()));
        const actorAt = (event: PointerEvent) => {
            if (world.hasWaterPreview()) return undefined;
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
            initialClose = false; followingPlace = undefined;
            try { renderer.domElement.setPointerCapture(event.pointerId); } catch { /* A pointer that already ended cannot be captured. */ }
            if (playFocus) { interruptedOrigin = playFocus.returnTo; playFocus = undefined; }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY });
            if (pointers.size === 1) { moved = false; pendingActor = latest.current.terrainEditing ? undefined : actorAt(event); carrying = undefined; }
            if (pointers.size === 1 && painting()) { stroke = []; lastPaint = undefined; paintAt(event); }
            if (pointers.size === 2) {
                if (stroke.length) { stroke = []; handlerRef.current.onPaint?.([], false); }
                moved = true;
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
                clearOverview();
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
            if (stroke.length && painting()) { paintAt(event); return; }
            if (pendingActor && !carrying && world.life.pick(pendingActor)) { carrying = pendingActor; handlerRef.current.onActorDrag?.(); }
            pendingActor = undefined;
            if (carrying) { const point = ground(event); if (point) world.life.drag(carrying, point); return; }
            interruptedOrigin = undefined;
            clearOverview();
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
            if (stroke.length && !pointers.size) {
                const done = stroke; stroke = []; restoreFocus();
                handlerRef.current.onPaint?.(done, true); return;
            }
            if (moved || pointers.size) { restoreFocus(); return; }
            restoreFocus();
            const h = handlerRef.current;
            if (latest.current.terrainEditing) {
                const hit = world.groundAt(cast(event)) ?? ray.ray.intersectPlane(seaPlane, new T.Vector3());
                if (hit) h.onCell(layout.cellAt(hit));
                return;
            }
            if (latest.current.ghost) {
                // While placing, every tap chooses the cell under the finger; a hint's
                // floating light chooses its own cell even when it hangs over another.
                const beaconHit = layer?.beacons.length ? cast(event).intersectObjects(layer.beacons, true)[0] : undefined;
                let light = beaconHit?.object; while (light && !light.userData.hintCell) light = light.parent ?? undefined;
                if (light) { h.onCell(light.userData.hintCell as Cell); return; }
                const point = ground(event);
                if (point) h.onCell(layout.cellAt(point));
                else if (authoredWorld) h.onCell({ x: Number.NaN, z: Number.NaN });
                return;
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
                if (data.actorId) { world.life.hop(data.actorId, performance.now()); h.onActorTap(data.actorId, world.life.touchConcert(data.actorId, performance.now())); return; }
                if (data.galleryTarget && data.placeId && world.life.visitGallery('pokomoko', data.placeId, performance.now())) {
                    initialClose = false; followingPlace = data.placeId; return;
                }
                if (data.objectId) { h.onSelect(data.objectId); return; }
            }
            const nearbyActor = actorAt(event);
            if (nearbyActor) { world.life.hop(nearbyActor, performance.now()); h.onActorTap(nearbyActor, world.life.touchConcert(nearbyActor, performance.now())); return; }
            const point = ground(event);
            if (point) { h.onSelect(undefined); h.onCell(layout.cellAt(point)); }
        };
        const cancel = (event: PointerEvent) => {
            if (!pointers.delete(event.pointerId)) return;
            if (carrying) { world.life.cancelCarry(carrying, performance.now()); carrying = undefined; }
            if (stroke.length) { stroke = []; handlerRef.current.onPaint?.([], false); }
            pendingActor = undefined; moved = true;
            if (!pointers.size) restoreFocus();
        };
        const wheel = (event: WheelEvent) => {
            clearOverview();
            initialClose = false; followingPlace = undefined;
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
    }, [viewKey, authoredWorld, authoredWater, authoredCove, authoredShoulder, authoredGrowthTerrain, authoredWholeArt]);

    useEffect(() => { api.current?.rebuild(state, ghost, selectedId, hints); }, [state, ghost, selectedId, hints]);
    useEffect(() => { api.current?.terrainArea(terrainEditing); }, [terrainEditing]);
    useEffect(() => { if (moment) api.current?.moment(moment); }, [moment]);
    useEffect(() => { if (focus) api.current?.focus(focus.id); }, [focus]);
    useEffect(() => { if (concert) api.current?.concert(concert.cell, concert.n); else api.current?.endMusic(); }, [concert]);
    useEffect(() => { api.current?.setTime(time); }, [time]);
    useEffect(() => { if (cheer) api.current?.cheer(); }, [cheer]);
    useEffect(() => { if (festival) api.current?.festival(); }, [festival]);
    const lastTurn = useRef(turn);
    useEffect(() => { if (turn !== lastTurn.current) { api.current?.turn(turn - lastTurn.current); lastTurn.current = turn; } }, [turn]);

    return <div className="growing-world" ref={host} data-growing-world data-visual-candidate="growing-island-v1" data-art-candidate={state.terrain ? 'editable-lived-island-v1' : authoredWorld ? authoredWholeArt ? AUTHORED_WHOLE_ART_CANDIDATE : authoredShoulder ? AUTHORED_SHOULDER_CANDIDATE : authoredCove ? AUTHORED_COVE_VISUAL_CANDIDATE : 'native05-authored-flower-garden-v3' : nativeArtEnabled ? 'native05-expanding-runtime-v2' : 'native-05-place-runtime-v3'} data-landscape-projection={state.terrain ? 'editable-common-floor-v1' : authoredWorld ? 'authored-floor-v1' : nativeArtEnabled ? 'curved-owned-v1' : 'linear'} data-native-growing-art={String(nativeArtEnabled)} data-authored-cove-enabled={String(Boolean(authoredWorld && authoredCove))} data-authored-shoulder-enabled={String(Boolean(authoredWorld && authoredShoulder))} data-authored-whole-art-enabled={String(Boolean(authoredWorld && authoredWholeArt))} data-authored-growth-terrain-candidate={authoredGrowthTerrain?.candidate} data-growing-feature-enabled="true">
        {failed && <p className="growing-world-failed">しまを ひょうじ できなかったよ。よみなおしてみてね。</p>}
        {bridgeStage && <div className="growing-bridge-caption" data-bridge-stage={bridgeStage} role="status">
            {bridgeStage === 'building' ? 'ぽこもこが はしを つくっているよ' : bridgeStage === 'crossing' ? 'なかまが わたっているよ' : 'むこうまで いけた！'}
        </div>}
    </div>;
}
