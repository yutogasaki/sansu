import { GrowingTerrainControls } from './GrowingTerrainControls';
import { terrainEditingRevision } from '../../../domain/growingIsland/terrainEditing';
import { onLand } from '../../../domain/growingIsland/space';
import VoyageChart from './VoyageChart';
import type { CatalogPictures } from './catalogPictures';
import { islandIdOf } from '../../../domain/growingIsland/voyages';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { canPlace, landQuote, styleAt, waitingSeeds } from '../../../domain/growingIsland';
import { HOME_CELL, landBounds, landCells } from '../../../domain/growingIsland/space';
import { canReachHomePlacement } from '../../../domain/growingIsland/commands';
import type { Cell, Command, FlowerColor, GrowingState, LandmarkKind, SeedKind, TownEvent } from '../../../domain/growingIsland';
import { growingDb, addMoment, flowerSentToday, listMoments, readGrowingIsland, sendFlower, type MomentRecord } from '../../../domain/growingIsland/repository';
import { getAllProfiles } from '../../../domain/user/repository';
import { useGardenTime } from '../three/garden/useGardenTime';
import { GrowingLoading, type LoadingStep } from './GrowingLoading';
import { useIslandWorkshopAudio } from '../useIslandWorkshopAudio';
import { useIslandAmbience } from '../useIslandAmbience';
import { actorLine, CHARACTER_NAME, idleLine, revealLine, villagerName } from './growingCopy';
import { GrowingSheet, type SheetAction } from './GrowingSheet';
import { GrowingTray, type CatalogPosition, type Pick } from './GrowingTray';
import { GrowingPlacementControls } from './GrowingPlacementControls';
import { placementPrice } from './placementPrice';
import { placementName } from './placementName';
import { CardView, FriendsPanel, ShowPanel, StoryView, VisitPicker, type ShowChoice } from './GrowingPanels';
import { canvasBlob, drawIslandCard, saveImage, type CardFrame } from './islandCard';
import { FLOWER_NAME } from './flowerGeometry';
import { FlowerBook } from './FlowerBook';
import type { Ghost } from './objectLayer';
import type { ShownMoment, WorldCamera } from './GrowingWorld';
import { useGrowingIsland } from './useGrowingIsland';
import { publishWaitingSeeds } from './seedBadge';
import { noteFor, playNote, playTune, stopNotes, TUNES } from './notes';
import { TracePanel } from './TracePanel';
import { GrowingGuideBook } from './GrowingGuideBook';
import { GrowingPlaceBook } from './GrowingPlaceBook';
import { placeStatuses } from '../../../domain/growingIsland/placeGoals';
import type { PlaceGoalId } from '../../../domain/growingIsland/placeTypes';
import { GrowingGuideCue } from './GrowingGuideCue';
import { starterCopy, starterFlowerReady, useGrowingGuide } from './useGrowingGuide';
import { growingTownSeed, starterBench } from './growingGuideTargets';
import { ownConcertReceipt } from './concertReceipt';
import { GrowingGuideEntry, type GrowingGuideRequest } from './GrowingGuideEntry';
import { achievementCatalog, pendingRevisitFlower, starterStep } from '../../../domain/growingIsland/guidance';
import type { AchievementId, GuidanceEvidence, StarterStepId } from '../../../domain/growingIsland/types';
import { allowPwaUpdateDuringReadOnlyOpening } from '../../../pwa';
import './growing.css';
import { GrowingIslandMenu } from './GrowingIslandMenu';
import { GrowingHomeTools, GrowingViewControls, GrowingExpansion } from './GrowingHomeTools';
import { growingExpansionLock } from './growingExpansion';
import { bridgeSite } from '../../../domain/growingIsland/space';
import { isReachable, reachableFromHome } from '../../../domain/growingIsland/space';
import { groveLift, placeGrowthEnabled, placementAdvice } from '../../../domain/growingIsland/placementAdvice';
import { terrainForm } from '../../../domain/growingIsland/terraceTerrain';
import type { MenuPictures } from './menuMiniatures';
import './wholeAppUi.css';

const GrowingWorld = lazy(() => import('./GrowingWorld'));
type Placing = { kind: SeedKind | LandmarkKind; seed: boolean; id?: string; mode: 'new' | 'move' | 'unstore'; cell?: Cell; keepsake?: string; color?: FlowerColor };
type Panel = 'tray' | 'landmarks' | 'stored' | 'friends' | 'show' | 'visit' | 'flowers' | 'trace' | 'guide' | 'places' | 'voyages' | 'view' | 'expand' | 'terrain' | undefined;
type Visit = { id: string; name: string; state: GrowingState; sent: boolean };

function speak(text: string) {
    try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .95;
        window.speechSynthesis.speak(utterance);
    } catch { /* Reading aloud is a convenience; the words stay on screen. */ }
}

/** Where to glow when a friend could not come (§11.3): one place, never blame. */
function hintCells(state: GrowingState, events: TownEvent[]): Cell[] {
    const blocked = events.filter(e => e.type === 'blocked');
    const cells: Cell[] = [];
    for (const e of blocked) {
        if (e.type !== 'blocked') continue;
        if (e.reason === 'unreachable' && e.plotId) { const cell = state.plots.find(p => p.id === e.plotId)?.cell; if (cell) cells.push(cell); }
        else if (e.reason === 'full') { const b = landBounds(state); cells.push({ x: b.maxX - 1, z: b.depth - 1 }); }
        else cells.push({ x: HOME_CELL.x, z: HOME_CELL.z + 1 });
    }
    return cells.slice(0, 2);
}

/** The growing island home (spec 52): play, plant, learn, open, and show. */
export default function GrowingIsland({ profileId, profileName = '', active, sound, onHome, onLearn, menuUtilities, firstPlay = false, guideRequest, onGuideRequestConsumed, onProfileSwitchBlockedChange }: { profileId: string; profileName?: string; active: boolean; sound: boolean; onHome: () => void; onLearn: () => void; menuUtilities?: ReactNode; firstPlay?: boolean;
    guideRequest?: GrowingGuideRequest; onGuideRequestConsumed?: () => void; onProfileSwitchBlockedChange?: (blocked: boolean) => void }) {
    const island = useGrowingIsland(profileId, active);
    const own = island.record?.state;
    const ownIslandId = islandIdOf(island.record);
    const time = useGardenTime(active);
    const [panel, setPanel] = useState<Panel>(), [menu, setMenu] = useState(false), [turn, setTurn] = useState(0);
    const [guideMemory, setGuideMemory] = useState<AchievementId>();
    const [placeDetail, setPlaceDetail] = useState<PlaceGoalId>();
    const [placing, setPlacing] = useState<Placing>(), [selected, setSelected] = useState<string>();
    const [terrainCell, setTerrainCell] = useState<Cell>();
    // DEV terrace form: the ground tool is a brush; a one-finger stroke shapes what it crosses.
    const brushing = terrainForm() === 'terrace';
    const [brush, setBrush] = useState<'up' | 'flat' | 'sea'>('up'), [stroke, setStroke] = useState<Cell[]>([]);
    const terrainPending = useRef(false);
    const [bridgeChoice, setBridgeChoice] = useState<'build' | 'remove'>();
    const [bridgeBuild, setBridgeBuild] = useState(0), [bridgeBusy, setBridgeBusy] = useState(false);
    useEffect(() => { if (!bridgeBusy) return; const timer = window.setTimeout(() => setBridgeBusy(false), 8500); return () => window.clearTimeout(timer); }, [bridgeBusy, bridgeBuild]);
    useEffect(() => { setBridgeChoice(undefined); setBridgeBusy(false); setBridgeBuild(0); }, [profileId]);
    const [line, setLine] = useState<string>(), [dawn, setDawn] = useState(0);
    const [revisitOffer, setRevisitOffer] = useState<{ profileId: string; id: string }>();
    const [revisitReady, setRevisitReady] = useState<{ profileId: string; id: string }>();
    const entryFlower = useRef<{ profileId: string; loaded: boolean }>({ profileId, loaded: false });
    const offeredThisVisit = useRef<string | undefined>(undefined);
    const [cheer, setCheer] = useState(0), [festival, setFestival] = useState(0);
    const [hints, setHints] = useState<Cell[]>([]), [moment, setMoment] = useState<ShownMoment>();
    const [show, setShow] = useState(false), [focus, setFocus] = useState<{ id: string; n: number }>();
    const [card, setCard] = useState<{ url?: string; blob?: Blob; frame?: CardFrame }>(), [story, setStory] = useState<MomentRecord[]>();
    const [faces, setFaces] = useState<Record<string, string>>({});
    const [menuPictures, setMenuPictures] = useState<MenuPictures>({});
    const [visit, setVisit] = useState<Visit>(), [siblings, setSiblings] = useState<{ id: string; name: string }[]>([]);
    const [visitSaving, setVisitSaving] = useState(false), [visitError, setVisitError] = useState<string>();
    const visitEpoch = useRef(0);
    useEffect(() => () => { visitEpoch.current++; }, [profileId]);
    const [naming, setNaming] = useState<string>();
    const namingOwner = useRef<{ profileId: string; islandId: string } | undefined>(undefined);
    const [concert, setConcert] = useState<{ cell: Cell; n: number; until: number; targetId: string; ownerId: string }>(), [song, setSong] = useState(0);
    const [worldStep, setWorldStep] = useState<LoadingStep | 'ready' | 'failed'>('world');
    const [worldAttempt, setWorldAttempt] = useState(0);
    useEffect(() => {
        setWorldAttempt(0); setWorldStep('world'); setSelected(undefined); setPlacing(undefined);
        setBridgeBuild(0); setBridgeBusy(false); setBridgeChoice(undefined); setConcert(undefined);
        setFocus(undefined); setFaces({}); setLine(undefined); setMenu(false);
        setNaming(undefined); namingOwner.current = undefined;
        pendingPicture.current = false;
    }, [profileId, ownIslandId]);
    const [qualityCeiling, setQualityCeiling] = useState(1.25);
    const [graphicsFailure, setGraphicsFailure] = useState<string>();
    const waitingForWorld = Boolean(own) && worldStep !== 'ready';
    useEffect(() => {
        if (active && waitingForWorld) return allowPwaUpdateDuringReadOnlyOpening();
    }, [active, waitingForWorld]);
    const [catalogPosition, setCatalogPosition] = useState<CatalogPosition>();
    const [catalogPictures, setCatalogPictures] = useState<CatalogPictures>({});
    const [viewReturn, setViewReturn] = useState(false);
    const camera = useRef<WorldCamera | undefined>(undefined), pendingPicture = useRef(false);
    const placingInFlight = useRef(false);
    const [playMoment, setPlayMoment] = useState<string>();
    const playLineTimer = useRef<number | undefined>(undefined);
    const firstPokomokoTap = useRef(true);
    useEffect(() => () => window.clearTimeout(playLineTimer.current), []);
    useEffect(() => { firstPokomokoTap.current = true; }, [profileId]);
    const clearPlayMoment = () => { window.clearTimeout(playLineTimer.current); setPlayMoment(undefined); };
    const menuTrigger = useRef<HTMLButtonElement>(null);
    const toolReturn = useRef('.growing-menu-button');
    const nameForm = useRef<HTMLFormElement>(null);
    const bookReturnFocus = useRef<HTMLElement | null>(null);
    const bookReturnSource = useRef<'menu' | 'cue'>('menu');
    const closeNaming = useCallback(() => { setNaming(undefined); namingOwner.current = undefined; window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.growing-home-identity button')?.focus({ preventScroll: true })); }, []);
    const namingOpen = naming !== undefined;
    useEffect(() => {
        if (!namingOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeNaming(); return; }
            if (event.key !== 'Tab') return;
            const controls = [...(nameForm.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? [])];
            if (!controls.length) return;
            if (!nameForm.current?.contains(document.activeElement)) { event.preventDefault(); controls[0].focus(); }
            else if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [namingOpen, closeNaming]);
    const playingForeground = active && !panel && !menu && !placing && !card && !story && !bridgeChoice && !bridgeBusy && naming === undefined;
    useEffect(() => {
        const stop = () => { if (document.visibilityState !== 'visible') { stopNotes(); setConcert(undefined); } };
        document.addEventListener('visibilitychange', stop);
        if (!sound || !active) stopNotes();
        if (!playingForeground) { stopNotes(); setConcert(undefined); }
        return () => { document.removeEventListener('visibilitychange', stop); stopNotes(); };
    }, [active, playingForeground, sound, profileId, ownIslandId, visit?.id]);
    const audio = useIslandWorkshopAudio(sound && active);
    useIslandAmbience(show ? 'shell-three-notes' : time === 'night' ? 'evening' : 'breeze', sound, active);
    const state = visit?.state ?? own;
    const profileSwitchBlocked = active && (island.busy || island.saving || visitSaving || Boolean(placing) || Boolean(bridgeChoice) || naming !== undefined);
    useEffect(() => {
        onProfileSwitchBlockedChange?.(profileSwitchBlocked);
        return () => onProfileSwitchBlockedChange?.(false);
    }, [onProfileSwitchBlockedChange, profileSwitchBlocked]);
    const guideSafe = active && worldStep === 'ready' && !island.busy && !island.syncing && !island.error && !dawn && !visit && !show
        && !panel && !menu && !placing && !selected && !card && !story && !bridgeChoice && !bridgeBusy && !playMoment && naming === undefined;
    const guide = useGrowingGuide({ state: own, active, safe: guideSafe, dispatch: island.dispatch, acknowledge: island.acknowledge });
    const dispatchRevisit = island.dispatch;
    useEffect(() => {
        if (entryFlower.current.profileId !== profileId) {
            entryFlower.current = { profileId, loaded: false }; offeredThisVisit.current = undefined; setRevisitOffer(undefined); setRevisitReady(undefined);
        }
        if (!own || entryFlower.current.loaded) return;
        entryFlower.current.loaded = true;
        const flower = pendingRevisitFlower(own);
        if (flower) setRevisitOffer({ profileId, id: flower.id });
    }, [own, profileId]);
    const revisitFlower = revisitOffer?.profileId === profileId
        ? own?.landmarks.find(item => item.id === revisitOffer.id && item.kind === 'flower' && item.cell) : undefined;
    const seenInThisVisit = revisitOffer && offeredThisVisit.current === `${profileId}:${revisitOffer.id}`;
    useEffect(() => {
        if (revisitOffer?.profileId === profileId && own && (!revisitFlower || (own.guidance?.firstFlower?.seen && !seenInThisVisit))) {
            setRevisitOffer(undefined); setRevisitReady(undefined);
        }
    }, [revisitOffer, profileId, own, revisitFlower, seenInThisVisit]);
    const revisitSafe = active && guide.visible && worldStep === 'ready' && !island.error && !dawn && !visit && !show
        && !panel && !menu && !placing && !selected && !card && !story && !bridgeChoice && !bridgeBusy && !playMoment && naming === undefined;
    const settledRevisit = Boolean(revisitFlower && guide.visible && guideSafe && !guide.cue && !guide.notice && !own?.unopened.length && !own?.arrivals.length);
    useEffect(() => { if (settledRevisit && revisitOffer) setRevisitReady(revisitOffer); }, [settledRevisit, revisitOffer]);
    const showRevisitFlower = Boolean(revisitFlower && revisitSafe && revisitReady?.profileId === profileId
        && revisitReady?.id === revisitFlower.id && (!own?.guidance?.firstFlower?.seen || seenInThisVisit)
        && !guide.cue && !guide.notice && !own?.unopened.length && !own?.arrivals.length);
    const acknowledgeRevisitFlower = (id: string) => {
        if (document.visibilityState !== 'visible') return;
        const key = `${profileId}:${id}`;
        if (offeredThisVisit.current === key || own?.guidance?.firstFlower?.seen) return;
        offeredThisVisit.current = key;
        void dispatchRevisit({ type: 'ack-revisit-flower', id }).then(saved => {
            if (!saved && offeredThisVisit.current === key) offeredThisVisit.current = undefined;
        });
    };
    useEffect(() => {
        if (!showRevisitFlower || !settledRevisit || !revisitOffer || document.visibilityState !== 'visible'
            || own?.guidance?.firstFlower?.seen) return;
        const timer = window.setTimeout(() => acknowledgeRevisitFlower(revisitOffer.id), 900);
        return () => window.clearTimeout(timer);
        // The saved receipt and display conditions, rather than the callback identity, control this one-shot timer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRevisitFlower, settledRevisit, revisitOffer, own?.guidance?.firstFlower?.seen]);
    useEffect(() => {
        if (!showRevisitFlower) return;
        const timer = window.setTimeout(() => { if (revisitOffer) acknowledgeRevisitFlower(revisitOffer.id); setRevisitOffer(undefined); }, 12000);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRevisitFlower, revisitOffer]);
    const dismissRevisitFlower = (target: EventTarget) => {
        if (showRevisitFlower && revisitOffer && target instanceof Element && !target.closest('[data-revisit-flower-link]')) {
            acknowledgeRevisitFlower(revisitOffer.id); setRevisitOffer(undefined);
        }
    };

    useEffect(() => {
        const reveal = island.reveal; if (!reveal || !own) return;
        const changed = reveal.town.some(e => e.type !== 'quiet' && e.type !== 'boat');
        if (changed) { setDawn(reveal.id); pendingPicture.current = true; }
        if (reveal.town.some(e => e.type === 'level')) { setFestival(reveal.id); audio.play('discovery'); }
        setHints(hintCells(own, reveal.town));
        const fresh = reveal.nature.filter(e => e.type === 'new-color');
        const town = revealLine(own, reveal.town);
        setLine(fresh.length && (town === 'のんびりした じかんだったね' || town === 'ふねが ちかづいてきたよ')
            ? `あたらしい いろの はなが さいたよ！ ${fresh.map(e => e.type === 'new-color' ? FLOWER_NAME[e.color] : '').join('と ')}`
            : town);
        if (fresh.length) audio.play('discovery');
        // The reveal is shown once per sync result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [island.reveal?.id]);
    useEffect(() => {
        const reveal = island.reveal, shown = reveal?.town.find(event => event.type === 'moment');
        if (!active || visit || show || worldStep !== 'ready' || !reveal || shown?.type !== 'moment') return;
        const timer = window.setTimeout(() => {
            setMoment({ id: reveal.id, moment: shown.moment, cell: shown.cell });
            if (shown.day !== undefined) void island.dispatch({ type: 'ack-moment', day: shown.day });
        }, 2200);
        return () => window.clearTimeout(timer);
        // Keep an unseen moment until this island's rendered world can actually show it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [island.reveal?.id, active, visit, show, worldStep]);
    useEffect(() => { if (!dawn) return; const id = window.setTimeout(() => setDawn(0), 1800); return () => clearTimeout(id); }, [dawn]);
    useEffect(() => { if (!hints.length) return; const id = window.setTimeout(() => setHints([]), 9000); return () => clearTimeout(id); }, [hints]);

    // しまの あゆみ: once everything from an opening is open, keep one small picture (§13).
    useEffect(() => {
        if (!own || !pendingPicture.current || own.unopened.length || own.arrivals.length || visit) return;
        const id = window.setTimeout(async () => {
            const shot = camera.current?.capture(480, 360); if (!shot) return;
            pendingPicture.current = false;
            try { await addMoment(profileId, await canvasBlob(shot, 'image/jpeg', .82), shot.width, shot.height, Date.now(), growingDb, ownIslandId); } catch { /* The story misses one page; the island is saved. */ }
        }, 1600);
        return () => clearTimeout(id);
    }, [own, profileId, ownIslandId, visit]);

    const bubble = state ? playMoment ?? line ?? (visit ? `${visit.name}の しまに きたよ。みんなに あいさつしよう` : idleLine(state)) : '';
    useEffect(() => {
        if (!line || placing || selected || panel || menu || bridgeChoice || visit) return;
        const timer = window.setTimeout(() => setLine(undefined), 7000);
        return () => window.clearTimeout(timer);
    }, [line, placing, selected, panel, menu, bridgeChoice, visit]);
    const waiting = own ? waitingSeeds(own) : 0;
    useEffect(() => { publishWaitingSeeds(waiting); }, [waiting]);
    const spoken = playMoment ?? guide.cue?.hint ?? bubble;
    useEffect(() => { if (sound && active && guide.visible && spoken && !show) speak(spoken); }, [sound, active, guide.visible, spoken, show]);

    const ghost = useMemo<Ghost | undefined>(() => {
        if (!own || !placing) return undefined;
        const allowed = landCells(own).filter(cell => canPlace(own, cell, placing.id));
        const valid = Boolean(placing.cell && allowed.some(c => c.x === placing.cell!.x && c.z === placing.cell!.z)
            && (placing.kind !== 'home' || canReachHomePlacement(own, placing.cell, placing.id)));
        return { kind: placing.kind, seed: placing.seed, cell: placing.cell, valid, allowed, keepsake: placing.keepsake, color: placing.color, ownerId: placing.id,
            style: placing.cell && placing.seed ? styleAt(own, placing.cell) : 'plain' };
    }, [own, placing]);
    // DEV place-growth experiment: the three cells where this thing would gather into a place glow.
    const advised = useMemo(() => {
        if (!own || !placing || !ghost || !placeGrowthEnabled()) return [];
        const reached = reachableFromHome(own);
        return placementAdvice(own, placing.kind, ghost.allowed.filter(cell => isReachable(cell, reached))).slice(0, 3);
    }, [own, placing, ghost]);
    const placeStatus = useMemo(() => own?.placeProgress?.selected ? placeStatuses(own).find(status => status.id === own.placeProgress!.selected) : undefined, [own]);

    const loadFaces = useCallback((limit?: number) => {
        const people = (own?.villagers ?? []).slice(0, limit);
        const missing = people.filter(v => !faces[v.id]);
        if (!missing.length || !camera.current) return faces;
        const next = { ...faces, ...camera.current.portraits(missing, 128) }; setFaces(next); return next;
    }, [own, faces]);

    if (!state || !own) return <div className="island-life growing-island" data-growing-island="loading">
        {island.error ? <div className="growing-error" role="alert"><p>{island.error}</p><button onClick={() => void island.sync()}>もういちど</button></div>
            : <GrowingLoading step={island.step} />}
    </div>;

    const run = async (command: Command, after?: () => void) => { if (await island.dispatch(command)) { after?.(); return true; } return false; };
    const openHomeTool = (target: Panel, source: string) => {
        if (target === 'tray' || target === 'landmarks' || target === 'stored' || target === 'flowers') { setCatalogPosition(undefined); setCatalogPictures(camera.current?.catalogPictures(own) ?? {}); }
        toolReturn.current = source; if (target !== 'tray') guide.pause(); setMenu(false); setSelected(undefined); setPanel(target); setLine(undefined);
    };
    const closeHomeTool = () => {
        setPanel(undefined);
        window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(toolReturn.current)?.focus({ preventScroll: true }));
    };
    const closeBook = () => {
        const origin = bookReturnFocus.current, source = bookReturnSource.current;
        setPanel(undefined);
        window.requestAnimationFrame(() => {
            if (source === 'menu') { menuTrigger.current?.focus({ preventScroll: true }); return; }
            if (origin?.isConnected && origin.closest('.growing-guide-cue, .growing-home-goal')) { origin.focus({ preventScroll: true }); return; }
            const cue = document.querySelector<HTMLElement>('.growing-home-goal, .growing-guide-goal, [data-guidance-starter] button:not(.growing-guide-cue-close)');
            (cue ?? menuTrigger.current)?.focus({ preventScroll: true });
        });
    };
    const shortfall = placing ? Math.max(0, placementPrice(own, placing) - own.drops) : 0;
    const pick = (choice: Pick) => {
        const catalog = document.querySelector('.growing-catalog');
        const active = document.activeElement;
        const attr = ['data-growing-seed', 'data-growing-landmark', 'data-growing-flower', 'data-growing-stored'].find(name => active?.hasAttribute(name));
        setCatalogPosition({ tab: choice.mode === 'unstore' ? 'stored' : 'new', category: catalog?.querySelector('.growing-catalog-filters [aria-pressed="true"]')?.textContent ?? 'すべて', scroll: catalog?.querySelector('[role="tabpanel"]')?.scrollTop ?? 0, item: attr ? { attr, value: active!.getAttribute(attr)! } : undefined });
        if (choice.mode !== 'seed' || choice.kind === 'wild') guide.pause();
        setPanel(undefined); setSelected(undefined); setLine('おく ばしょを えらんでね');
        if (choice.mode === 'unstore') setPlacing({ kind: choice.kind, seed: choice.seed, id: choice.id, mode: 'unstore', keepsake: choice.keepsake });
        else setPlacing({ kind: choice.kind, seed: choice.mode === 'seed', mode: 'new', color: choice.mode === 'landmark' ? choice.color : undefined });
    };
    const confirm = () => {
        if (!placing?.cell || placingInFlight.current || island.busy || island.syncing || shortfall > 0) return;
        if (!ghost?.valid) { setLine(placing.kind === 'home' ? 'ここまで いけないみたい。まわりを あけてみよう' : 'おく ばしょを えらんでね'); return; }
        const cell = placing.cell;
        const command: Command = placing.mode === 'move' ? { type: 'move', id: placing.id!, cell }
            : placing.mode === 'unstore' ? { type: 'unstore', id: placing.id!, cell }
                : placing.seed ? { type: 'plant', kind: placing.kind as SeedKind, cell } : { type: 'place', kind: placing.kind as LandmarkKind, cell, ...(placing.color ? { color: placing.color } : {}) };
        placingInFlight.current = true;
        void run(command, () => {
            audio.play(placing.kind === 'water-bowl' || placing.kind === 'water-channel' ? 'water' : placing.seed ? 'sand' : 'wood');
            setPlacing(undefined);
            if (placing.seed && placing.mode === 'new' && placing.kind === 'home') setCheer(c => c + 1);
            setLine(placing.seed && placing.mode === 'new' ? own.tutorial === 'first-home' && placing.kind === 'home' ? 'つぼみを さわってみよう' : 'たねを おいたよ。まなぶと そだつよ'
                : placing.kind === 'flower' && placing.mode === 'new' ? 'はなの なえを おいたよ。じかんで そだつよ' : undefined);
        }).then(async saved => { if (!saved) await island.sync(false); }).finally(() => { placingInFlight.current = false; });
    };
    const sheetAction = (action: SheetAction) => {
        const target = selected; if (!target) return;
        const id = target.startsWith('villager:') ? target.slice(9) : target;
        if (action.type === 'concert') {
            const stand = own.landmarks.find(item => item.id === id && item.kind === 'bandstand' && item.cell);
            if (!stand?.cell) return;
            stopNotes();
            const length = action.tune ? Math.max(30000, playTune(sound, song) + 2000) : 30000;
            setConcert({ cell: stand.cell, targetId: stand.id, ownerId: profileId, n: Date.now(), until: Date.now() + length });
            setSelected(undefined); setPanel(undefined); guide.pause();
            setLine(action.tune ? `えんそうかいだよ！「${TUNES[song % TUNES.length].name}」` : 'ぽこもこと なかまを さわって おとで おはなししよう');
            if (action.tune) setSong(song + 1); return;
        }
        if (action.type === 'touch') {
            const started = camera.current?.interact(id);
            setSelected(undefined); setConcert(undefined); stopNotes();
            setLine(started ? 'ぽこもこと さわってみよう' : 'ここへ とどく すきまを あけてみよう'); return;
        }
        if (action.type === 'place') {
            const started = camera.current?.visitPlace(action.placeId);
            setSelected(undefined); setConcert(undefined); stopNotes();
            setLine(started ? 'ぽこもこが そこへ いくよ' : 'いまは べつの ところで すごそう'); return;
        }
        if (action.type === 'home') { setSelected(undefined); if (firstPlay) openBook(); else onHome(); return; }
        if (action.type === 'bridge-remove') { setSelected(undefined); setBridgeChoice('remove'); return; }
        if (action.type === 'lift') {
            const lift = groveLift(own, id); if (!lift) { setLine('いまは おかに できないみたい'); return; }
            setSelected(undefined);
            void (async () => {
                for (const edit of lift.edits) if (!await island.dispatch(edit)) { await island.sync(false); return; }
                audio.play('sand'); setLine('はやしが おかに なったよ');
            })();
            return;
        }
        if (action.type === 'move') {
            const plot = own.plots.find(p => p.id === id), landmark = own.landmarks.find(l => l.id === id), keepsake = own.keepsakes.find(k => k.id === id);
            setPlacing({ kind: (plot?.kind ?? landmark?.kind ?? 'flower')!, seed: Boolean(plot), id, mode: 'move', keepsake: keepsake?.unitId }); setSelected(undefined);
            setLine('うごかす ばしょを えらんでね'); return;
        }
        const command: Command = action.type === 'store' ? { type: 'store', id } : action.type === 'pluck' ? { type: 'pluck', id } : action.type === 'tend' ? { type: 'tend', id }
            : action.type === 'paint' ? { type: 'paint', target: id, color: action.color }
                : action.type === 'name' ? { type: 'name', target: id, name: action.name }
                    : action.type === 'flag' ? { type: 'flag', color: action.color, pattern: action.pattern }
                        : action.type === 'dress' ? { type: 'dress', id, color: action.color, hat: action.hat }
                            : { type: 'away', id, away: action.away };
        void run(command, () => {
            audio.play('pick');
            if (action.type === 'store' || action.type === 'pluck'
                || (action.type === 'flag' && own.guidance?.selected === 'A3' && starterStep(own) === 'S4'
                    && action.color !== undefined && action.color !== (own.flagColor ?? 0))) setSelected(undefined);
        });
    };
    const disembark = async () => { for (const id of own.arrivals) await island.dispatch({ type: 'disembark', id }); audio.play('discovery'); setLine(undefined); };
    const quote = landQuote(own), expansionLock = growingExpansionLock(own), gifts = own.unopened.length + own.arrivals.length;

    const openBook = (memory?: AchievementId, source: 'menu' | 'cue' = 'cue') => {
        bookReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        bookReturnSource.current = source;
        setGuideMemory(memory); if (memory) guide.dismissNotice();
        setMenu(false); setSelected(undefined); setPanel('guide'); setLine(undefined);
    };
    const openPlaces = (id?: PlaceGoalId, source: 'menu' | 'cue' = 'menu') => {
        bookReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        bookReturnSource.current = source;
        setPlaceDetail(id); guide.pause(); setMenu(false); setSelected(undefined); setPanel('places'); setLine(undefined);
    };
    const placeTarget = (id: string) => {
        setPanel(undefined);
        const item = [...own.plots, ...own.landmarks].find(item => item.id === id);
        if (!item) return;
        if (!item.cell) { openHomeTool('stored', '.growing-home-stored'); return; }
        setFocus({ id, n: Date.now() });
        setLine('ぽこもこを はこんで、ここで あそんでみよう');
    };
    const goalAction = (id: AchievementId) => {
        setPanel(undefined); setSelected(undefined); setLine(undefined);
        const action = achievementCatalog.find(item => item.id === id)?.action;
        if (action === 'flag') setSelected('flag');
        else if (action === 'move') {
            if (starterStep(own) === 'S4' && !starterBench(own)?.cell) {
                openHomeTool('stored', '.growing-home-stored'); return;
            }
            const item = own.landmarks.find(l => l.kind === 'bench' && l.cell) ?? own.landmarks.find(l => l.cell) ?? own.plots.find(p => p.cell);
            if (item) { setSelected(item.id); setFocus({ id: item.id, n: Date.now() }); }
            else openHomeTool('stored', '.growing-home-stored');
        } else if (action === 'expand') { toolReturn.current = '.growing-home-expand'; setMenu(false); setPanel('expand'); }
        else if (action === 'concert') {
            const stand = own.landmarks.find(l => l.kind === 'bandstand' && l.cell);
            if (stand) { setFocus({ id: stand.id, n: Date.now() }); setLine('ひろばを さわってみよう'); }
            else setPanel(own.landmarks.some(l => l.kind === 'bandstand' && !l.cell) ? 'stored' : 'tray');
        } else if (id === 'A1' && own.arrivals.length) { setLine('ふねの こを さわってみよう'); }
        else if (id === 'A2' && own.unopened.some(id => own.plots.some(p => p.id === id && p.townBuilt))) {
            setFocus({ id: own.unopened.find(id => own.plots.some(p => p.id === id && p.townBuilt))!, n: Date.now() });
            setLine('ひかる つぼみを さわってみよう');
        } else if (id === 'A2' && growingTownSeed(own)) {
            const seed = growingTownSeed(own)!;
            setSelected(seed.id); setFocus({ id: seed.id, n: Date.now() });
        } else openHomeTool('tray', '.growing-home-place');
    };
    const starterAction = (wanted?: StarterStepId) => {
        const step = wanted ?? starterStep(own); setPanel(undefined); setLine(undefined);
        if (step === 'S4') {
            const choice = own.guidance?.selected;
            if (starterCopy(own, step).action === 'まなぶ') onLearn();
            else if (choice === 'A3' || choice === 'A4') {
                if (own.guidance?.achievements[choice]) onLearn(); else goalAction(choice);
            } else openBook();
        }
        else if (step === 'S1' && firstPlay) pick({ mode: 'seed', kind: 'home' });
        else if (step === 'S2') { const id = own.guidance?.starter.steps.S1?.targetId; if (id) setFocus({ id, n: Date.now() }); }
        else if (step === 'S3') setLine('ふねの こを さわってみよう');
        else if (step === 'S5' && starterFlowerReady(own)) openHomeTool('landmarks', '.growing-home-place');
        else if (step === 'S5' && starterCopy(own, step).action === 'しまへ もどる') { guide.pause(); }
        else goalAction(step === 'S1' ? 'A1' : 'A2');
    };
    const memoryTarget = (evidence: GuidanceEvidence) => {
        setPanel(undefined);
        const id = evidence.targetId;
        if (!id) { setLine('しまを ながめてみよう'); return; }
        if (id === 'flag') { setSelected('flag'); return; }
        const item = [...own.plots, ...own.landmarks, ...own.keepsakes].find(item => item.id === id);
        if (item && !item.cell) { openHomeTool('stored', '.growing-home-stored'); return; }
        const friend = own.villagers.find(v => v.id === id);
        if (friend) setSelected(`villager:${id}`); else if (item) setSelected(id);
        if (friend || item) setFocus({ id, n: Date.now() });
    };

    const showChoice = async (choice: ShowChoice) => {
        setPanel(undefined); setMenu(false);
        if (choice === 'show') { setShow(true); return; }
        if (choice === 'story') { setStory(await listMoments(profileId)); return; }
        if (choice === 'visit') {
            const others = (await getAllProfiles()).filter(p => p.id !== profileId).map(p => ({ id: p.id, name: p.name }));
            setSiblings(others); setPanel('visit'); return;
        }
        await makeCard('dots');
    };
    const makeCard = async (frame: CardFrame) => {
        setCard(previous => { if (previous?.url) URL.revokeObjectURL(previous.url); return { frame }; });
        const shot = camera.current?.capture(1200, 800);
        if (!shot) { setCard(undefined); setLine('カードを つくれなかったよ。もういちど ためしてね'); return; }
        const canvas = await drawIslandCard(own, shot, loadFaces(), profileName, frame);
        const blob = await canvasBlob(canvas);
        setCard({ blob, url: URL.createObjectURL(blob), frame });
    };
    const startVisit = async (id: string) => {
        const epoch = ++visitEpoch.current; setPanel(undefined); setVisitError(undefined);
        try {
            const record = await readGrowingIsland(id), sibling = siblings.find(s => s.id === id);
            if (epoch !== visitEpoch.current) return;
            if (!record || !sibling) { setLine('まだ その しまは ひらかれていないみたい'); return; }
            const sent = await flowerSentToday(profileId, id);
            if (epoch !== visitEpoch.current) return;
            setVisit({ id, name: sibling.name, state: record.state, sent }); setLine(undefined);
            setSelected(undefined); setPlacing(undefined);
        } catch { if (epoch === visitEpoch.current) setVisitError('しまを よみこめなかったよ。もういちど ためしてね。'); }
    };

    const leaveVisit = () => { visitEpoch.current++; setVisit(undefined); setVisitError(undefined); setLine(undefined); };
    const leaveFlower = async () => {
        if (!visit || visit.sent || visitSaving) return;
        const epoch = visitEpoch.current, target = visit; setVisitSaving(true); setVisitError(undefined);
        try {
            const sent = await sendFlower(profileId, profileName, target.id);
            if (epoch !== visitEpoch.current) return;
            if (sent) audio.play('discovery');
            setVisit(current => current?.id === target.id ? { ...current, sent: true } : current);
            setLine(`おはなを おいてきたよ。${target.name}が みたら よろこぶね`);
        } catch { if (epoch === visitEpoch.current) setVisitError('おはなを ほぞん できなかったよ。もういちど ためしてね。'); }
        finally { setVisitSaving(false); }
    };

    // An opaque book or sheet can cover the actor even when WebGL sees it in the
    // camera frustum. Keep island life running; receive observations after closing.
    const placeReceiptsVisible = active && !visit && !show && !panel && !menu && !selected && !placing
        && !card && !story && !bridgeChoice && !bridgeBusy && naming === undefined;
    const changeTerrain = async (type: 'terrain-edit' | 'terrain-undo' | 'terrain-redo', delta?: 1 | -1) => {
        if (terrainPending.current || island.busy || visit || panel !== 'terrain' || !camera.current) return;
        if (type === 'terrain-edit' && (!terrainCell || delta === undefined)) return;
        terrainPending.current = true;
        try {
            const safety = { actors: camera.current.terrainActors(), occupiedPlaceTargets: camera.current.occupiedTerrainPlaceTargets(), expectedTerrainRevision: terrainEditingRevision(own) };
            const command: Command = type === 'terrain-edit' ? { type, cell: terrainCell!, delta: delta!, ...safety } : { type, ...safety };
            await run(command, () => { setLine('じめんを ほぞんしたよ'); audio.play('wood'); });
        } finally { terrainPending.current = false; }
    };
    const paintTerrain = async (cells: Cell[]) => {
        if (terrainPending.current || island.busy || visit || panel !== 'terrain' || !camera.current || !cells.length) return;
        terrainPending.current = true;
        try {
            const safety = { actors: camera.current.terrainActors(), occupiedPlaceTargets: camera.current.occupiedTerrainPlaceTargets(), expectedTerrainRevision: terrainEditingRevision(own) };
            await run({ type: 'terrain-stroke', cells, to: brush, ...safety }, () => {
                setLine(brush === 'up' ? 'おかが もりあがったよ' : brush === 'sea' ? 'うみが はいってきたよ' : 'たいらに したよ');
                audio.play(brush === 'sea' ? 'water' : 'sand');
            });
        } finally { terrainPending.current = false; }
    };
    const world = <GrowingWorld terrainEditing={panel === 'terrain'} terrainBrush={brushing && panel === 'terrain'} terrainCell={terrainCell}
        onPaint={(cells, done) => { if (!done) { setStroke(cells); return; } setStroke([]); void paintTerrain(cells); }} viewKey={`${profileId}:${ownIslandId}:${visit?.id ?? 'own'}`} onViewReturn={setViewReturn} key={`${ownIslandId}:${worldAttempt}`} active={active} playActive={playingForeground} compact={worldAttempt > 0} qualityCeiling={qualityCeiling} state={state} time={time} ghost={visit ? undefined : ghost} selectedId={visit ? undefined : selected} turn={turn} cheer={cheer} festival={festival} bridgeBuild={bridgeBuild}
        hints={visit ? [] : panel === 'terrain' && stroke.length ? stroke : placing && advised.length ? advised : hints} moment={visit ? undefined : moment} show={show} focus={focus} concert={concert} onCamera={c => { camera.current = c; if (!c) setViewReturn(false); }}
        onPop={() => audio.play('glass')} onStage={setWorldStep} onFailure={setGraphicsFailure} onQualityFallback={ceiling => {
            setQualityCeiling(previous => Math.min(previous, ceiling)); setWorldStep('world'); setWorldAttempt(value => value + 1);
        }}
        onBridgeComplete={() => { setBridgeBuild(0); setBridgeBusy(false); }}
        onConcertStarted={receipt => { const id = ownConcertReceipt(profileId, Boolean(visit), receipt, concert); if (id) void island.acknowledge('concert-started', id); }}
        onPlaceUse={receipt => { if (placeReceiptsVisible && document.visibilityState === 'visible') return island.acknowledgePlace({ type: 'place-used', ...receipt }); return Promise.resolve(false); }}
        onPlaceShown={receipt => { if (placeReceiptsVisible && document.visibilityState === 'visible') return island.acknowledgePlace({ type: 'place-shown', ...receipt }); return Promise.resolve(false); }}
        onCell={cell => { clearPlayMoment(); void audio.unlock(); if (visit) return; setMenu(false); if (panel === 'terrain') { if (onLand(own, cell)) { setTerrainCell(cell); setLine(undefined); } else setLine('じぶんの じめんを えらんでね'); return; } if (placing) setPlacing({ ...placing, cell }); else setLine(undefined); }}
        onSelect={id => {
            clearPlayMoment();
            if (placing) return;
            setMenu(false);
            // えんそうかい (§4): friends gather; each one plays their own note when touched. A
            // sibling's bandstand plays too: visiting can be shared play without changing anything.
            const stand = state.landmarks.find(l => l.id === id && l.kind === 'bandstand');
            if (visit && stand?.cell && !(concert && Date.now() < concert.until)) {
                const length = Math.max(30000, playTune(sound, song) + 2000);
                if (!visit) guide.pause();
                setConcert({ cell: stand.cell, targetId: stand.id, ownerId: visit?.id ?? profileId, n: Date.now(), until: Date.now() + length }); setPanel(undefined);
                setLine(`えんそうかいだよ！「${TUNES[song % TUNES.length].name}」 みんなを さわって おとを ならそう`); setSong(song + 1); return;
            }
            if (visit) return;
            guide.pause();
            setConcert(undefined); stopNotes(); setSelected(id); setPanel(undefined);
        }}
        onOpen={id => { if (visit) return; void run({ type: 'open', id }, () => setLine(own.unopened.length > 1 ? 'まだ つぼみが あるよ' : undefined)); }}
        onDisembark={() => { if (!visit) void disembark(); }}
        onPlayStopped={stopNotes}
        onPlaceReplyStep={(kind, index) => { if (sound && kind === 'leaves') playNote(3 + index % 5); }}
        onPlaceReply={kind => { audio.play(kind === 'water' ? 'water' : 'wood'); setLine(undefined); }}
        onSharedPlay={receipt => visit ? false : island.acknowledgePlace({ type: 'shared-play', ...receipt })}
        onActorTap={(id, participating) => {
            clearPlayMoment();
            setMenu(false);
            void audio.unlock();
            const playing = concert && Date.now() < concert.until && participating;
            if (playing && sound) {
                const species = id === 'pokomoko' ? 'pokomoko' : id === 'visitor' ? state.pier.visitor.species : state.villagers.find(v => v.id === id)?.species;
                if (species) playNote(noteFor(species));
            } else audio.play('pick');
            if (visit) { setLine(actorLine(visit.state, id)); return; }
            if (playing) return;
            // A friend still on the boat comes ashore when touched (§11.1).
            if (own.arrivals.includes(id)) { void disembark(); return; }
            if (id !== 'visitor') guide.pause();
            if (id === 'pokomoko' && firstPokomokoTap.current && own.landmarks.some(item => item.kind === 'bench' && item.cell)) {
                firstPokomokoTap.current = false;
                setLine(`ぽこもこを つまんで ベンチへ はこんでみよう${own.tutorial === 'first-home' ? '。おうちの たねも おけるよ' : ''}`);
            } else setLine(actorLine(own, id));
            if (own.villagers.some(v => v.id === id)) { loadFaces(); setSelected(`villager:${id}`); }
        }}
        onActorDrag={clearPlayMoment}
        onActorPlay={(id, kind) => {
            if (id === 'pokomoko') firstPokomokoTap.current = false;
            const friend = state.villagers.find(v => v.id === id);
            const name = id === 'pokomoko' ? 'ぽこもこ' : friend ? villagerName(friend) : 'なかま';
            const message = kind === 'bench' ? `${name}が ベンチで ひとやすみ` : `${name}が ブランコを こいでるよ`;
            setPlayMoment(message);
            window.clearTimeout(playLineTimer.current);
            playLineTimer.current = window.setTimeout(() => setPlayMoment(current => current === message ? undefined : current), 4200);
        }} />;

    const worldLoading = worldStep !== 'ready' && <GrowingLoading step={worldStep === 'failed' ? 'world' : worldStep} overlay failed={worldStep === 'failed'}
        failureDetail={graphicsFailure} onRetry={() => { setGraphicsFailure(undefined); setWorldStep('world'); setWorldAttempt(value => value + 1); }} onLearn={onLearn} />;
    if (show) return <div className="island-life growing-island" data-growing-island="show" data-garden-time={time}>
        <Suspense fallback={null}>{world}</Suspense>{worldLoading}
        <button className="growing-chip growing-show-exit" onClick={() => setShow(false)}>おわる</button>
    </div>;

    return <div className="island-life growing-island" data-growing-island={visit ? 'visit' : 'ready'} data-home-ui-candidate="island-direct-play-v2" data-garden-time={time} data-dawn={dawn ? 'true' : undefined}
        onPointerDownCapture={event => dismissRevisitFlower(event.target)} onClickCapture={event => dismissRevisitFlower(event.target)}>
        {guideRequest && <GrowingGuideEntry request={guideRequest} ready={active && worldStep === 'ready' && !island.busy && !island.syncing && !island.error}
            onEnter={action => {
                if (action.kind === 'goal') goalAction(action.id);
                else if (action.kind === 'starter') starterAction(action.step);
                else if (action.kind === 'memory') memoryTarget(action.evidence);
                onGuideRequestConsumed?.();
            }} />}
        <div className="growing-world-interaction" inert={menu || Boolean(panel && panel !== 'terrain') || Boolean(selected) || Boolean(card) || Boolean(story) || naming !== undefined || Boolean(bridgeChoice)}><Suspense fallback={null}>{world}</Suspense></div>{worldLoading}
        {dawn > 0 && <div className="growing-dawn" aria-hidden="true"><span>☀</span></div>}
        {visit ? <div className="growing-hud-top"><span className="growing-chip">{visit.name}の しま・{CHARACTER_NAME[visit.state.character]}</span></div> : <GrowingHomeTools
            islandName={own.islandName ?? 'ぽこもこの しま'} drops={own.drops} quote={quote} status={placeStatus} menuRef={menuTrigger}
            visible={worldStep === 'ready' && !menu && !panel && !placing && !selected && !card && !story && !bridgeChoice && !bridgeBusy && naming === undefined && !dawn}
            goalVisible={!firstPlay && !guide.cue && !guide.notice && !gifts} expansionVisible={!firstPlay && !guide.cue && !guide.notice && !gifts} expansionLock={expansionLock} menuOpen={menu && naming === undefined}
            onName={() => { namingOwner.current = { profileId, islandId: ownIslandId }; setNaming(own.islandName ?? ''); }}
            onView={() => openHomeTool('view', '.growing-home-view')}
            onExpand={() => openHomeTool('expand', '.growing-home-expand')}
            onPlace={() => { void audio.unlock(); openHomeTool('tray', '.growing-home-place'); }}
            onStored={() => openHomeTool('stored', '.growing-home-stored')}
            onMenu={() => { if (!menu) setMenuPictures(own.villagers.length ? camera.current?.menuPictures(own.villagers) ?? {} : {}); setMenu(!menu); }}
            onGoal={() => openPlaces(placeStatus?.id, 'cue')} />}
        {!visit && panel === 'terrain' && <GrowingTerrainControls onDistance={close => camera.current?.distance(close)} cell={terrainCell} busy={island.busy} canUndo={Boolean(own.terrain?.undo.length)} canRedo={Boolean(own.terrain?.redo.length)}
            brush={brushing ? brush : undefined} onBrush={setBrush}
            onEdit={delta => void changeTerrain('terrain-edit', delta)} onUndo={() => void changeTerrain('terrain-undo')} onRedo={() => void changeTerrain('terrain-redo')} onClose={closeHomeTool} />}
        {!visit && panel === 'view' && <GrowingViewControls canReturn={viewReturn} onReturn={() => camera.current?.restoreView()} onDistance={close => camera.current?.distance(close)} onClose={closeHomeTool} onRotate={direction => setTurn(value => value + direction)} />}
        {!visit && panel === 'expand' && <GrowingExpansion quote={quote} expansionLock={expansionLock} drops={own.drops} busy={island.busy} onClose={closeHomeTool}
            onExpand={side => void run({ type: 'expand', side }, () => { closeHomeTool(); audio.play('assemble'); })} />}
        {naming !== undefined && <form ref={nameForm} className="growing-overlay" role="dialog" aria-modal="true" aria-label="しまの なまえ" onSubmit={event => { event.preventDefault(); if (namingOwner.current?.profileId !== profileId || namingOwner.current.islandId !== ownIslandId) { closeNaming(); return; } if (naming.trim()) void run({ type: 'name', target: 'island', name: naming }, closeNaming); }}>
            <div className="growing-overlay-body growing-name"><label>しまの なまえ<input value={naming} maxLength={12} onChange={e => setNaming(e.target.value)} autoFocus /></label>
                <div className="growing-row"><button type="submit" className="growing-primary">きめる</button><button type="button" onClick={closeNaming}>やめる</button></div></div>
        </form>}
        {menu && !visit && <GrowingIslandMenu villagers={own.villagers} faces={faces} pictures={menuPictures} drops={own.drops} busy={island.busy}
            utilities={menuUtilities}
            bridge={{ built: Boolean(own.bridge), ready: own.villagers.some(v => !v.away && !own.arrivals.includes(v.id)) && bridgeSite(own) !== undefined,
                reason: own.villagers.some(v => !v.away && !own.arrivals.includes(v.id)) ? 'はしの ばしょを あけてね' : 'なかまが きてから' }}
            onBridge={() => { setMenu(false); if (own.bridge) { setSelected('bridge'); setFocus({ id: 'bridge', n: Date.now() }); } else setBridgeChoice('build'); }}
            onClose={() => { setMenu(false); window.requestAnimationFrame(() => menuTrigger.current?.focus({ preventScroll: true })); }}
            onTerrain={() => { setTerrainCell(undefined); openHomeTool('terrain', '.growing-menu-button'); }}
            onVoyages={firstPlay ? undefined : () => openHomeTool('voyages', '.growing-menu-button')}
            onFriends={() => { loadFaces(); openHomeTool('friends', '.growing-menu-button'); }}
            onTrace={() => openHomeTool('trace', '.growing-menu-button')}
            onShow={() => openHomeTool('show', '.growing-menu-button')}
            onFlowers={() => openHomeTool('flowers', '.growing-menu-button')}
            onGuide={() => openBook(undefined, 'menu')} />}
        {Boolean(playMoment || line || visit || showRevisitFlower) && !placing && !panel && !menu && !selected && !bridgeChoice && !bridgeBusy && !guide.cue && !guide.notice && <p className="growing-bubble" role="status"><span aria-hidden="true">ぽこもこ</span>{bubble}
            {showRevisitFlower && revisitFlower && <button type="button" className="growing-revisit-flower" data-revisit-flower-link
                onClick={() => { acknowledgeRevisitFlower(revisitFlower.id); setRevisitOffer(undefined); setSelected(revisitFlower.id); setFocus({ id: revisitFlower.id, n: Date.now() }); }}>
                このまえの おはなへ
            </button>}</p>}
        {guideSafe && <GrowingGuideCue state={own} cue={firstPlay && guide.cue?.id === 'S1' ? { ...guide.cue, hint: 'ここに すみたいって', action: 'おうちを つくる' } : guide.cue} notice={guide.notice} selected={guide.selected} onAction={() => starterAction()}
            onClose={guide.notice ? guide.dismissNotice : guide.pause} onBook={memory => openBook(memory)} />}
        {(island.error || visitError) && <div className="growing-error" role="alert"><p>{island.error || visitError}</p><button onClick={() => { island.clearError(); setVisitError(undefined); }}>とじる</button></div>}
        {visit ? <div className="growing-hud-bottom">
            <button className="growing-open-all" disabled={visit.sent || visitSaving} onClick={() => void leaveFlower()}>{visit.sent ? 'おはなを おいたよ' : 'おはなを おいてくる 🌸'}</button>
            <button className="growing-seed-button" onClick={leaveVisit}>かえる</button>
        </div> : placing ? <GrowingPlacementControls itemName={placementName(own, placing)} valid={Boolean(ghost?.valid)} shortfall={shortfall} pending={island.busy || island.syncing}
            message={ghost?.cell ? ghost.valid ? 'ここで いい？' : placing.kind === 'home' && canPlace(own, ghost.cell, placing.id)
                ? 'ここまで いけないみたい。まわりを あけてみよう' : 'ここには おけないよ' : advised.length ? 'ひかる ところに おくと、まとまって みえるよ' : 'おく ばしょを さわってね'}
            onConfirm={confirm} onChoose={() => { setPanel(placing.mode === 'unstore' ? 'stored' : 'tray'); setPlacing(undefined); setLine(undefined); island.clearError(); }}
            onCancel={() => { if (placing.mode === 'move') setSelected(placing.id); else setPanel(placing.mode === 'unstore' ? 'stored' : 'tray'); setPlacing(undefined); setLine(undefined); island.clearError(); }} /> : <div className="growing-hud-bottom">
            {firstPlay && !panel && !menu && !selected && !card && !story && !bridgeChoice && <button className="growing-seed-button first-play-learn" disabled={island.busy || island.saving} onClick={onLearn}>まなぶ</button>}
            {gifts > 0 && <button className="growing-open-all" onClick={() => void run({ type: 'open-all' }, () => { audio.play('glass'); setLine(undefined); })}>ぜんぶ ひらく</button>}
        </div>}
        {!visit && (panel === 'tray' || panel === 'landmarks' || panel === 'stored') && !placing && <GrowingTray position={catalogPosition} pictures={catalogPictures} key={panel} state={own} onPick={pick} onClose={closeHomeTool} initialTab={panel === 'stored' ? 'stored' : panel === 'landmarks' ? 'landmarks' : 'seeds'} />}
        {!visit && panel === 'trace' && <TracePanel profileId={profileId} onClose={closeHomeTool}
            onSave={(image, glyph) => void run({ type: 'emblem', image, glyph }, () => { setPanel(undefined); audio.play('discovery'); setLine(`「${glyph}」が しまの はたに なったよ！`); })} />}
        {!visit && panel === 'friends' && <FriendsPanel state={own} faces={faces} onClose={closeHomeTool}
            onFocus={id => { setPanel(undefined); setSelected(`villager:${id}`); setFocus({ id, n: Date.now() }); setLine(actorLine(own, id)); }} />}
        {!visit && panel === 'show' && <ShowPanel onPick={choice => void showChoice(choice)} onClose={closeHomeTool} />}
        {!visit && panel === 'voyages' && <VoyageChart profileId={profileId} state={own} busy={island.busy} onClose={closeHomeTool}
            onSail={island.sail} onFocus={id => { setSelected(undefined); setFocus({ id, n: Date.now() }); }} />}
        {!visit && panel === 'flowers' && <FlowerBook pictures={catalogPictures} state={own} onClose={closeHomeTool} />}
        {!visit && panel === 'guide' && <GrowingGuideBook state={own} busy={island.busy} initialMemory={guideMemory} onClose={closeBook}
            onPlaces={() => openPlaces()}
            onChoose={(id, play) => void run({ type: 'choose-goal', id }, () => { guide.pause(); if (play) goalAction(id); })}
            onClear={() => void run({ type: 'choose-goal' })} onTry={goalAction} onResumeStarter={() => void guide.resume().then(() => setPanel(undefined))}
            onStarterAction={() => starterAction()} onStarterChoose={id => void run({ type: 'choose-starter-play', id }, () => goalAction(id))}
            onTarget={memoryTarget} />}
        {!visit && panel === 'places' && <GrowingPlaceBook state={own} busy={island.busy || island.syncing} initialGoal={placeDetail} onClose={closeBook}
            onChoose={id => void run({ type: 'choose-place-goal', id })} onTarget={placeTarget} />}
        {panel === 'visit' && <VisitPicker profiles={siblings} onVisit={id => void startVisit(id)} onClose={() => setPanel(undefined)} />}
        {bridgeChoice && <div className="growing-overlay" role="dialog" aria-modal="true" aria-label={bridgeChoice === 'build' ? 'はしを つくる' : 'はしを しまう'}>
            <div className="growing-overlay-body"><strong>{bridgeChoice === 'build' ? 'ぽこもこに はしを おねがいする？' : 'はしを しまう？'}</strong>
                <p>{bridgeChoice === 'build' ? 'なかまが わたって、むこうの みはらしだいへ いくよ' : 'また いつでも つくれるよ'}</p>
                <div className="growing-row"><button onClick={() => setBridgeChoice(undefined)}>やめる</button><button className="growing-primary" disabled={island.busy}
                    onClick={() => {
                        const site = bridgeSite(own);
                        const command: Command | undefined = bridgeChoice === 'remove' ? { type: 'bridge-remove' }
                            : site === undefined ? undefined : { type: 'bridge-build', x: site };
                        if (!command) { setBridgeChoice(undefined); setLine('はしの ばしょを あけてね'); return; }
                        void run(command, () => { setBridgeChoice(undefined); setLine(command.type === 'bridge-build' ? undefined : 'はしを しまったよ');
                            if (command.type === 'bridge-build') { setBridgeBusy(true); setBridgeBuild(value => value + 1); } });
                    }}>{bridgeChoice === 'build' ? 'つくる' : 'しまう'}</button></div>
            </div>
        </div>}
        {!visit && selected && !placing && <GrowingSheet portrait={selected?.startsWith('villager:') ? faces[selected.slice(9)] : undefined} state={own} target={selected} onAction={sheetAction} onClose={() => setSelected(undefined)} />}
        {card && <CardView url={card.url} busy={!card.blob} frame={card.frame} onFrame={frame => void makeCard(frame)} onSave={() => { if (card.blob) saveImage(card.blob, `${own.islandName ?? 'しま'}-card.png`); }}
            onClose={() => { if (card.url) URL.revokeObjectURL(card.url); setCard(undefined); }} />}
        {story && <StoryView state={own} moments={story} onClose={() => setStory(undefined)} onFocus={id => { if (visit) leaveVisit(); setStory(undefined); setSelected(undefined); setFocus({ id, n: Date.now() }); }} />}
    </div>;
}
