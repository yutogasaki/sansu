import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canPlace, landQuote, styleAt, waitingSeeds } from '../../../domain/growingIsland';
import { HOME_CELL, landBounds, landCells } from '../../../domain/growingIsland/space';
import { canReachHomePlacement } from '../../../domain/growingIsland/commands';
import type { Cell, Command, FlowerColor, GrowingState, LandmarkKind, SeedKind, TownEvent } from '../../../domain/growingIsland';
import { addMoment, flowerSentToday, listMoments, readGrowingIsland, sendFlower, type MomentRecord } from '../../../domain/growingIsland/repository';
import { getAllProfiles } from '../../../domain/user/repository';
import { useGardenTime } from '../life/fantasy/useGardenTime';
import { GrowingLoading, type LoadingStep } from './GrowingLoading';
import { useIslandWorkshopAudio } from '../useIslandWorkshopAudio';
import { useIslandAmbience } from '../useIslandAmbience';
import { actorLine, CHARACTER_NAME, idleLine, revealLine } from './growingCopy';
import { GrowingSheet, type SheetAction } from './GrowingSheet';
import { GrowingTray, type Pick } from './GrowingTray';
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
import { noteFor, playNote, playTune, TUNES } from './notes';
import { TracePanel } from './TracePanel';
import { GrowingGuideBook } from './GrowingGuideBook';
import { GrowingGuideCue } from './GrowingGuideCue';
import { useGrowingGuide } from './useGrowingGuide';
import { ownConcertReceipt } from './concertReceipt';
import { GrowingGuideEntry, type GrowingGuideRequest } from './GrowingGuideEntry';
import { achievementCatalog, starterStep } from '../../../domain/growingIsland/guidance';
import type { AchievementId, GuidanceEvidence, StarterStepId } from '../../../domain/growingIsland/types';
import { useNavigate } from 'react-router-dom';
import { allowPwaUpdateDuringReadOnlyOpening } from '../../../pwa';
import './growing.css';
import { GrowingIslandMenu } from './GrowingIslandMenu';
import type { MenuPictures } from './menuMiniatures';

const GrowingWorld = lazy(() => import('./GrowingWorld'));
type Placing = { kind: SeedKind | LandmarkKind; seed: boolean; id?: string; mode: 'new' | 'move' | 'unstore'; cell?: Cell; keepsake?: string; color?: FlowerColor };
type Panel = 'tray' | 'landmarks' | 'stored' | 'friends' | 'show' | 'visit' | 'flowers' | 'trace' | 'guide' | undefined;
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
export default function GrowingIsland({ profileId, profileName = '', active, sound, onHome, onLearn, guideRequest, onGuideRequestConsumed }: { profileId: string; profileName?: string; active: boolean; sound: boolean; onHome: () => void; onLearn: () => void;
    guideRequest?: GrowingGuideRequest; onGuideRequestConsumed?: () => void }) {
    const island = useGrowingIsland(profileId, active);
    const own = island.record?.state;
    const time = useGardenTime(active);
    const [panel, setPanel] = useState<Panel>(), [menu, setMenu] = useState(false), [turn, setTurn] = useState(0);
    const [guideMemory, setGuideMemory] = useState<AchievementId>();
    const [placing, setPlacing] = useState<Placing>(), [selected, setSelected] = useState<string>();
    const [line, setLine] = useState<string>(), [dawn, setDawn] = useState(0);
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
    const [concert, setConcert] = useState<{ cell: Cell; n: number; until: number; targetId: string; ownerId: string }>(), [song, setSong] = useState(0);
    const navigate = useNavigate();
    const [worldStep, setWorldStep] = useState<LoadingStep | 'ready' | 'failed'>('world');
    const [worldAttempt, setWorldAttempt] = useState(0);
    const [qualityCeiling, setQualityCeiling] = useState(1.25);
    const [graphicsFailure, setGraphicsFailure] = useState<string>();
    const waitingForWorld = Boolean(own) && worldStep !== 'ready';
    useEffect(() => {
        if (active && waitingForWorld) return allowPwaUpdateDuringReadOnlyOpening();
    }, [active, waitingForWorld]);
    const camera = useRef<WorldCamera | undefined>(undefined), pendingPicture = useRef(false);
    const placingInFlight = useRef(false);
    const menuTrigger = useRef<HTMLButtonElement>(null);
    const seedTrigger = useRef<HTMLButtonElement>(null);
    const nameTrigger = useRef<HTMLButtonElement>(null);
    const nameForm = useRef<HTMLFormElement>(null);
    const bookReturnFocus = useRef<HTMLElement | null>(null);
    const bookReturnSource = useRef<'menu' | 'cue'>('menu');
    const closeNaming = useCallback(() => { setNaming(undefined); window.requestAnimationFrame(() => nameTrigger.current?.focus({ preventScroll: true })); }, []);
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
    const audio = useIslandWorkshopAudio(sound && active);
    useIslandAmbience(show ? 'shell-three-notes' : time === 'night' ? 'evening' : 'breeze', sound, active);
    const state = visit?.state ?? own;
    const guideSafe = active && worldStep === 'ready' && !island.busy && !island.syncing && !island.error && !dawn && !visit && !show
        && !panel && !menu && !placing && !selected && !card && !story && naming === undefined;
    const guide = useGrowingGuide({ state: own, active, safe: guideSafe, dispatch: island.dispatch, acknowledge: island.acknowledge });

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
            try { await addMoment(profileId, await canvasBlob(shot, 'image/jpeg', .82), shot.width, shot.height); } catch { /* The story misses one page; the island is saved. */ }
        }, 1600);
        return () => clearTimeout(id);
    }, [own, profileId, visit]);

    const bubble = state ? line ?? (visit ? `${visit.name}の しまに きたよ。みんなに あいさつしよう` : idleLine(state)) : '';
    const waiting = own ? waitingSeeds(own) : 0;
    useEffect(() => { publishWaitingSeeds(waiting); }, [waiting]);
    const spoken = guide.cue?.hint ?? bubble;
    useEffect(() => { if (sound && active && guide.visible && spoken && !show) speak(spoken); }, [sound, active, guide.visible, spoken, show]);

    const ghost = useMemo<Ghost | undefined>(() => {
        if (!own || !placing) return undefined;
        const allowed = landCells(own).filter(cell => canPlace(own, cell, placing.id));
        const valid = Boolean(placing.cell && allowed.some(c => c.x === placing.cell!.x && c.z === placing.cell!.z)
            && (placing.kind !== 'home' || canReachHomePlacement(own, placing.cell, placing.id)));
        return { kind: placing.kind, seed: placing.seed, cell: placing.cell, valid, allowed, keepsake: placing.keepsake, color: placing.color,
            style: placing.cell && placing.seed ? styleAt(own, placing.cell) : 'plain' };
    }, [own, placing]);

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
    const closeBook = () => {
        const origin = bookReturnFocus.current, source = bookReturnSource.current;
        setPanel(undefined);
        window.requestAnimationFrame(() => {
            if (source === 'menu') { menuTrigger.current?.focus({ preventScroll: true }); return; }
            if (origin?.isConnected && origin.closest('.growing-guide-cue')) { origin.focus({ preventScroll: true }); return; }
            const cue = document.querySelector<HTMLElement>('.growing-guide-goal, [data-guidance-starter] button:not(.growing-guide-cue-close)');
            (cue ?? seedTrigger.current ?? menuTrigger.current)?.focus({ preventScroll: true });
        });
    };
    const shortfall = placing ? Math.max(0, placementPrice(own, placing) - own.drops) : 0;
    const pick = (choice: Pick) => {
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
            setLine(placing.seed && placing.mode === 'new' ? 'たねを おいたよ。まなぶと そだつよ' : undefined);
        }).then(async saved => { if (!saved) await island.sync(false); }).finally(() => { placingInFlight.current = false; });
    };
    const sheetAction = (action: SheetAction) => {
        const target = selected; if (!target) return;
        const id = target.startsWith('villager:') ? target.slice(9) : target;
        if (action.type === 'home') { setSelected(undefined); onHome(); return; }
        if (action.type === 'move') {
            const plot = own.plots.find(p => p.id === id), landmark = own.landmarks.find(l => l.id === id), keepsake = own.keepsakes.find(k => k.id === id);
            setPlacing({ kind: (plot?.kind ?? landmark?.kind ?? 'flower')!, seed: Boolean(plot), id, mode: 'move', keepsake: keepsake?.unitId }); setSelected(undefined);
            setLine('うごかす ばしょを えらんでね'); return;
        }
        const command: Command = action.type === 'store' ? { type: 'store', id } : action.type === 'pluck' ? { type: 'pluck', id }
            : action.type === 'paint' ? { type: 'paint', target: id, color: action.color }
                : action.type === 'name' ? { type: 'name', target: id, name: action.name }
                    : action.type === 'flag' ? { type: 'flag', color: action.color, pattern: action.pattern }
                        : action.type === 'dress' ? { type: 'dress', id, color: action.color, hat: action.hat }
                            : { type: 'away', id, away: action.away };
        void run(command, () => { audio.play('pick'); if (action.type === 'store' || action.type === 'pluck') setSelected(undefined); });
    };
    const disembark = async () => { for (const id of own.arrivals) await island.dispatch({ type: 'disembark', id }); audio.play('discovery'); setLine(undefined); };
    const quote = landQuote(own), gifts = own.unopened.length + own.arrivals.length;

    const openBook = (memory?: AchievementId, source: 'menu' | 'cue' = 'cue') => {
        bookReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        bookReturnSource.current = source;
        setGuideMemory(memory); if (memory) guide.dismissNotice();
        setMenu(false); setSelected(undefined); setPanel('guide'); setLine(undefined);
    };
    const goalAction = (id: AchievementId) => {
        setPanel(undefined); setSelected(undefined); setLine(undefined);
        const action = achievementCatalog.find(item => item.id === id)?.action;
        if (action === 'flag') setSelected('flag');
        else if (action === 'move') {
            const item = own.landmarks.find(l => l.kind === 'bench' && l.cell) ?? own.landmarks.find(l => l.cell) ?? own.plots.find(p => p.cell);
            if (item) { setSelected(item.id); setFocus({ id: item.id, n: Date.now() }); }
            else setPanel('stored');
        } else if (action === 'expand') setMenu(true);
        else if (action === 'concert') {
            const stand = own.landmarks.find(l => l.kind === 'bandstand' && l.cell);
            if (stand) { setFocus({ id: stand.id, n: Date.now() }); setLine('ひろばを さわってみよう'); }
            else setPanel(own.landmarks.some(l => l.kind === 'bandstand' && !l.cell) ? 'stored' : 'tray');
        } else if (id === 'A1' && own.arrivals.length) { setLine('ふねの こを さわってみよう'); }
        else if (id === 'A2' && own.unopened.some(id => own.plots.some(p => p.id === id && p.townBuilt))) {
            setFocus({ id: own.unopened.find(id => own.plots.some(p => p.id === id && p.townBuilt))!, n: Date.now() });
            setLine('ひかる つぼみを さわってみよう');
        } else setPanel('tray');
    };
    const starterAction = (wanted?: StarterStepId) => {
        const step = wanted ?? starterStep(own); setPanel(undefined); setLine(undefined);
        if (step === 'S4') onLearn();
        else if (step === 'S2') { const id = own.guidance?.starter.steps.S1?.targetId; if (id) setFocus({ id, n: Date.now() }); }
        else if (step === 'S3') setLine('ふねの こを さわってみよう');
        else if (step === 'S5' && own.drops < 4 && !own.plots.some(p => !p.starter && p.paid > 0 && p.cell)) openBook();
        else goalAction(step === 'S1' ? 'A1' : 'A2');
    };
    const memoryTarget = (evidence: GuidanceEvidence) => {
        setPanel(undefined);
        const id = evidence.targetId;
        if (!id) { setLine('しまを ながめてみよう'); return; }
        if (id === 'flag') { setSelected('flag'); return; }
        const item = [...own.plots, ...own.landmarks, ...own.keepsakes].find(item => item.id === id);
        if (item && !item.cell) { setPanel('stored'); return; }
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

    const world = <GrowingWorld key={worldAttempt} active={active} compact={worldAttempt > 0} qualityCeiling={qualityCeiling} state={state} time={time} ghost={visit ? undefined : ghost} selectedId={visit ? undefined : selected} turn={turn} cheer={cheer} festival={festival}
        hints={visit ? [] : hints} moment={visit ? undefined : moment} show={show} focus={focus} concert={concert} onCamera={c => { camera.current = c; }}
        onPop={() => audio.play('glass')} onStage={setWorldStep} onFailure={setGraphicsFailure} onQualityFallback={ceiling => {
            setQualityCeiling(previous => Math.min(previous, ceiling)); setWorldStep('world'); setWorldAttempt(value => value + 1);
        }}
        onConcertStarted={receipt => { const id = ownConcertReceipt(profileId, Boolean(visit), receipt, concert); if (id) void island.acknowledge('concert-started', id); }}
        onCell={cell => { void audio.unlock(); if (visit) return; setMenu(false); if (placing) setPlacing({ ...placing, cell }); else setLine(undefined); }}
        onSelect={id => {
            if (placing) return;
            setMenu(false);
            // えんそうかい (§4): friends gather; each one plays their own note when touched. A
            // sibling's bandstand plays too: visiting can be shared play without changing anything.
            const stand = state.landmarks.find(l => l.id === id && l.kind === 'bandstand');
            if (stand?.cell && !(concert && Date.now() < concert.until)) {
                const length = Math.max(30000, playTune(sound, song) + 2000);
                if (!visit) guide.pause();
                setConcert({ cell: stand.cell, targetId: stand.id, ownerId: visit?.id ?? profileId, n: Date.now(), until: Date.now() + length }); setPanel(undefined);
                setLine(`えんそうかいだよ！「${TUNES[song % TUNES.length].name}」 みんなを さわって おとを ならそう`); setSong(song + 1); return;
            }
            if (visit) return;
            guide.pause();
            setSelected(id); setPanel(undefined);
        }}
        onOpen={id => { if (visit) return; void run({ type: 'open', id }, () => setLine(own.unopened.length > 1 ? 'まだ つぼみが あるよ' : undefined)); }}
        onDisembark={() => { if (!visit) void disembark(); }}
        onActorTap={id => {
            setMenu(false);
            void audio.unlock();
            const playing = concert && Date.now() < concert.until;
            if (playing && sound) {
                const species = id === 'pokomoko' ? 'pokomoko' : id === 'visitor' ? state.pier.visitor.species : state.villagers.find(v => v.id === id)?.species;
                if (species) playNote(noteFor(species));
            } else audio.play('pick');
            if (visit) { setLine(actorLine(visit.state, id)); return; }
            if (playing) return;
            // A friend still on the boat comes ashore when touched (§11.1).
            if (own.arrivals.includes(id)) { void disembark(); return; }
            if (id !== 'visitor') guide.pause();
            setLine(actorLine(own, id)); if (own.villagers.some(v => v.id === id)) setSelected(`villager:${id}`);
        }} />;

    const worldLoading = worldStep !== 'ready' && <GrowingLoading step={worldStep === 'failed' ? 'world' : worldStep} overlay failed={worldStep === 'failed'}
        failureDetail={graphicsFailure} onRetry={() => { setGraphicsFailure(undefined); setWorldStep('world'); setWorldAttempt(value => value + 1); }} onLearn={onLearn} />;
    if (show) return <div className="island-life growing-island" data-growing-island="show" data-garden-time={time}>
        <Suspense fallback={null}>{world}</Suspense>{worldLoading}
        <button className="growing-chip growing-show-exit" onClick={() => setShow(false)}>おわる</button>
    </div>;

    return <div className="island-life growing-island" data-growing-island={visit ? 'visit' : 'ready'} data-garden-time={time} data-dawn={dawn ? 'true' : undefined}>
        {guideRequest && <GrowingGuideEntry request={guideRequest} ready={active && worldStep === 'ready' && !island.busy && !island.syncing && !island.error}
            onEnter={action => {
                if (action.kind === 'goal') goalAction(action.id);
                else if (action.kind === 'starter') starterAction(action.step);
                else if (action.kind === 'memory') memoryTarget(action.evidence);
                onGuideRequestConsumed?.();
            }} />}
        <Suspense fallback={null}>{world}</Suspense>{worldLoading}
        {dawn > 0 && <div className="growing-dawn" aria-hidden="true"><span>☀</span></div>}
        <div className="growing-hud-top">
            {visit ? <span className="growing-chip">{visit.name}の しま・{CHARACTER_NAME[visit.state.character]}</span> : <>
                <button ref={nameTrigger} className="growing-chip" data-growing-character onClick={() => setNaming(own.islandName ?? '')}>
                    {own.islandName ? `${own.islandName}・` : ''}{CHARACTER_NAME[own.character]}</button>
                <span className="growing-chip" aria-label={`しずく ${own.drops}`}>💧 {own.drops}</span>
                <button ref={menuTrigger} className="growing-chip growing-menu-button" aria-expanded={menu} onClick={() => { if (!menu) setMenuPictures(camera.current?.menuPictures(own.villagers) ?? {}); setMenu(!menu); }}>メニュー</button>
            </>}
        </div>
        {naming !== undefined && <form ref={nameForm} className="growing-overlay" role="dialog" aria-modal="true" aria-label="しまの なまえ" onSubmit={event => { event.preventDefault(); if (naming.trim()) void run({ type: 'name', target: 'island', name: naming }, closeNaming); }}>
            <div className="growing-overlay-body growing-name"><label>しまの なまえ<input value={naming} maxLength={12} onChange={e => setNaming(e.target.value)} autoFocus /></label>
                <div className="growing-row"><button type="submit" className="growing-primary">きめる</button><button type="button" onClick={closeNaming}>やめる</button></div></div>
        </form>}
        {menu && !visit && <GrowingIslandMenu villagers={own.villagers} faces={faces} pictures={menuPictures} drops={own.drops} busy={island.busy} quote={quote}
            onClose={() => { setMenu(false); menuTrigger.current?.focus({ preventScroll: true }); }}
            onFriends={() => { guide.pause(); setMenu(false); loadFaces(); setPanel('friends'); }}
            onSeeds={() => { void audio.unlock(); setMenu(false); setPanel('tray'); setSelected(undefined); }}
            onTrace={() => { guide.pause(); setMenu(false); setPanel('trace'); }}
            onStored={() => { guide.pause(); setMenu(false); setPanel('stored'); }}
            onHome={() => { setMenu(false); setSelected(undefined); onHome(); }}
            onShow={() => { guide.pause(); setMenu(false); setPanel('show'); }}
            onFlowers={() => { guide.pause(); setMenu(false); setPanel('flowers'); }}
            onGuide={() => openBook(undefined, 'menu')} onSettings={() => { setMenu(false); navigate('/settings'); }}
            onRotate={direction => setTurn(value => value + direction)}
            onExpand={side => void run({ type: 'expand', side }, () => { setMenu(false); audio.play('assemble'); })} />}
        {!placing && !panel && !menu && !selected && !guide.cue && !guide.notice && <p className="growing-bubble" role="status"><span aria-hidden="true">ぽこもこ</span>{bubble}</p>}
        {guideSafe && <GrowingGuideCue state={own} cue={guide.cue} notice={guide.notice} selected={guide.selected} onAction={() => starterAction()}
            onClose={guide.notice ? guide.dismissNotice : guide.pause} onBook={memory => openBook(memory)} />}
        {(island.error || visitError) && <div className="growing-error" role="alert"><p>{island.error || visitError}</p><button onClick={() => { island.clearError(); setVisitError(undefined); }}>とじる</button></div>}
        {visit ? <div className="growing-hud-bottom">
            <button className="growing-open-all" disabled={visit.sent || visitSaving} onClick={() => void leaveFlower()}>{visit.sent ? 'おはなを おいたよ' : 'おはなを おいてくる 🌸'}</button>
            <button className="growing-seed-button" onClick={leaveVisit}>かえる</button>
        </div> : placing ? <GrowingPlacementControls itemName={placementName(own, placing)} valid={Boolean(ghost?.valid)} shortfall={shortfall} pending={island.busy || island.syncing}
            message={ghost?.cell ? ghost.valid ? 'ここで いい？' : placing.kind === 'home' && canPlace(own, ghost.cell, placing.id)
                ? 'ここまで いけないみたい。まわりを あけてみよう' : 'ここには おけないよ' : 'おく ばしょを さわってね'}
            onConfirm={confirm} onChoose={() => { setPanel(placing.seed ? 'tray' : 'landmarks'); setPlacing(undefined); setLine(undefined); island.clearError(); }}
            onCancel={() => { setPlacing(undefined); setLine(undefined); island.clearError(); }} /> : <div className="growing-hud-bottom">
            {gifts > 0 && <button className="growing-open-all" onClick={() => void run({ type: 'open-all' }, () => { audio.play('glass'); setLine(undefined); })}>ぜんぶ ひらく</button>}
            <button ref={seedTrigger} className="growing-seed-button" data-attention={guide.cue?.id === 'S1' ? 'true' : undefined}
                onClick={() => { void audio.unlock(); setPanel(panel === 'tray' ? undefined : 'tray'); setSelected(undefined); }}>たね</button>
        </div>}
        {!visit && (panel === 'tray' || panel === 'landmarks' || panel === 'stored') && !placing && <GrowingTray key={panel} state={own} onPick={pick} onClose={() => setPanel(undefined)} initialTab={panel === 'stored' ? 'stored' : panel === 'landmarks' ? 'landmarks' : 'seeds'} />}
        {!visit && panel === 'trace' && <TracePanel profileId={profileId} onClose={() => setPanel(undefined)}
            onSave={(image, glyph) => void run({ type: 'emblem', image, glyph }, () => { setPanel(undefined); audio.play('discovery'); setLine(`「${glyph}」が しまの はたに なったよ！`); })} />}
        {!visit && panel === 'friends' && <FriendsPanel state={own} faces={faces} onClose={() => setPanel(undefined)}
            onFocus={id => { setPanel(undefined); setFocus({ id, n: Date.now() }); setLine(actorLine(own, id)); }} />}
        {!visit && panel === 'show' && <ShowPanel onPick={choice => void showChoice(choice)} onClose={() => setPanel(undefined)} />}
        {!visit && panel === 'flowers' && <FlowerBook state={own} onClose={() => setPanel(undefined)} />}
        {!visit && panel === 'guide' && <GrowingGuideBook state={own} busy={island.busy} initialMemory={guideMemory} onClose={closeBook}
            onChoose={(id, play) => void run({ type: 'choose-goal', id }, () => { guide.pause(); if (play) goalAction(id); })}
            onClear={() => void run({ type: 'choose-goal' })} onTry={goalAction} onResumeStarter={() => void guide.resume().then(() => setPanel(undefined))}
            onStarterAction={() => starterAction()} onTarget={memoryTarget} />}
        {panel === 'visit' && <VisitPicker profiles={siblings} onVisit={id => void startVisit(id)} onClose={() => setPanel(undefined)} />}
        {!visit && selected && !placing && <GrowingSheet state={own} target={selected} onAction={sheetAction} onClose={() => setSelected(undefined)} />}
        {card && <CardView url={card.url} busy={!card.blob} frame={card.frame} onFrame={frame => void makeCard(frame)} onSave={() => { if (card.blob) saveImage(card.blob, `${own.islandName ?? 'しま'}-card.png`); }}
            onClose={() => { if (card.url) URL.revokeObjectURL(card.url); setCard(undefined); }} />}
        {story && <StoryView moments={story} onClose={() => setStory(undefined)} />}
    </div>;
}
