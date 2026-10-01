import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canPlace, landQuote, styleAt, waitingSeeds } from '../../../domain/growingIsland';
import { HOME_CELL, landBounds, landCells } from '../../../domain/growingIsland/space';
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
import { useNavigate } from 'react-router-dom';
import './growing.css';

const GrowingWorld = lazy(() => import('./GrowingWorld'));
type Placing = { kind: SeedKind | LandmarkKind; seed: boolean; id?: string; mode: 'new' | 'move' | 'unstore'; cell?: Cell; keepsake?: string; color?: FlowerColor };
type Panel = 'tray' | 'stored' | 'friends' | 'show' | 'visit' | 'flowers' | 'trace' | undefined;
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
export default function GrowingIsland({ profileId, profileName = '', active, sound, onHome }: { profileId: string; profileName?: string; active: boolean; sound: boolean; onHome: () => void }) {
    const island = useGrowingIsland(profileId, active);
    const own = island.record?.state;
    const time = useGardenTime(active);
    const [panel, setPanel] = useState<Panel>(), [menu, setMenu] = useState(false), [turn, setTurn] = useState(0);
    const [placing, setPlacing] = useState<Placing>(), [selected, setSelected] = useState<string>();
    const [line, setLine] = useState<string>(), [dawn, setDawn] = useState(0);
    const [cheer, setCheer] = useState(0), [festival, setFestival] = useState(0);
    const [hints, setHints] = useState<Cell[]>([]), [moment, setMoment] = useState<ShownMoment>();
    const [show, setShow] = useState(false), [focus, setFocus] = useState<{ id: string; n: number }>();
    const [card, setCard] = useState<{ url?: string; blob?: Blob; frame?: CardFrame }>(), [story, setStory] = useState<MomentRecord[]>();
    const [faces, setFaces] = useState<Record<string, string>>({});
    const [visit, setVisit] = useState<Visit>(), [siblings, setSiblings] = useState<{ id: string; name: string }[]>([]);
    const [naming, setNaming] = useState<string>();
    const [concert, setConcert] = useState<{ cell: Cell; n: number; until: number }>(), [song, setSong] = useState(0);
    const navigate = useNavigate();
    const [worldStep, setWorldStep] = useState<LoadingStep | 'ready'>('world');
    const camera = useRef<WorldCamera | undefined>(undefined), pendingPicture = useRef(false);
    const audio = useIslandWorkshopAudio(sound && active);
    useIslandAmbience(show ? 'shell-three-notes' : time === 'night' ? 'evening' : 'breeze', sound, active);
    const state = visit?.state ?? own;

    useEffect(() => {
        const reveal = island.reveal; if (!reveal || !own) return;
        const changed = reveal.town.some(e => e.type !== 'quiet' && e.type !== 'boat');
        if (changed) { setDawn(reveal.id); pendingPicture.current = true; }
        if (reveal.town.some(e => e.type === 'level')) { setFestival(reveal.id); audio.play('discovery'); }
        const shown = reveal.town.find(e => e.type === 'moment');
        if (shown?.type === 'moment') window.setTimeout(() => setMoment({ id: reveal.id, moment: shown.moment, cell: shown.cell }), 2200);
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
    useEffect(() => { if (sound && bubble && !show) speak(bubble); }, [sound, bubble, show]);

    const ghost = useMemo<Ghost | undefined>(() => {
        if (!own || !placing) return undefined;
        const allowed = landCells(own).filter(cell => canPlace(own, cell, placing.id));
        const valid = Boolean(placing.cell && allowed.some(c => c.x === placing.cell!.x && c.z === placing.cell!.z));
        return { kind: placing.kind, seed: placing.seed, cell: placing.cell, valid, allowed, keepsake: placing.keepsake, color: placing.color,
            style: placing.cell && placing.seed ? styleAt(own, placing.cell) : 'plain' };
    }, [own, placing]);

    const loadFaces = useCallback(() => {
        const people = own?.villagers ?? [];
        const missing = people.filter(v => !faces[v.id]);
        if (!missing.length || !camera.current) return faces;
        const next = { ...faces, ...camera.current.portraits(missing, 128) }; setFaces(next); return next;
    }, [own, faces]);

    if (!state || !own) return <div className="island-life growing-island" data-growing-island="loading">
        {island.error ? <div className="growing-error" role="alert"><p>{island.error}</p><button onClick={() => void island.sync()}>もういちど</button></div>
            : <GrowingLoading step={island.step} />}
    </div>;

    const run = async (command: Command, after?: () => void) => { if (await island.dispatch(command)) { after?.(); return true; } return false; };
    const pick = (choice: Pick) => {
        setPanel(undefined); setSelected(undefined); setLine('おく ばしょを えらんでね');
        if (choice.mode === 'unstore') setPlacing({ kind: choice.kind, seed: choice.seed, id: choice.id, mode: 'unstore', keepsake: choice.keepsake });
        else setPlacing({ kind: choice.kind, seed: choice.mode === 'seed', mode: 'new', color: choice.mode === 'landmark' ? choice.color : undefined });
    };
    const confirm = () => {
        if (!placing?.cell || !ghost?.valid) return;
        const cell = placing.cell;
        const command: Command = placing.mode === 'move' ? { type: 'move', id: placing.id!, cell }
            : placing.mode === 'unstore' ? { type: 'unstore', id: placing.id!, cell }
                : placing.seed ? { type: 'plant', kind: placing.kind as SeedKind, cell } : { type: 'place', kind: placing.kind as LandmarkKind, cell, ...(placing.color ? { color: placing.color } : {}) };
        void run(command, () => {
            audio.play(placing.kind === 'water-bowl' || placing.kind === 'water-channel' ? 'water' : placing.seed ? 'sand' : 'wood');
            setPlacing(undefined);
            if (placing.seed && placing.mode === 'new' && placing.kind === 'home') setCheer(c => c + 1);
            setLine(placing.seed && placing.mode === 'new' ? 'たねを おいたよ。まなぶと そだつよ' : undefined);
        });
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
        setPanel(undefined);
        const record = await readGrowingIsland(id), sibling = siblings.find(s => s.id === id);
        if (!record || !sibling) { setLine('まだ その しまは ひらかれていないみたい'); return; }
        setVisit({ id, name: sibling.name, state: record.state, sent: await flowerSentToday(profileId, id) }); setLine(undefined);
        setSelected(undefined); setPlacing(undefined);
    };

    const world = <GrowingWorld state={state} time={time} ghost={visit ? undefined : ghost} selectedId={visit ? undefined : selected} turn={turn} cheer={cheer} festival={festival}
        hints={visit ? [] : hints} moment={visit ? undefined : moment} show={show} focus={focus} concert={concert} onCamera={c => { camera.current = c; }}
        onPop={() => audio.play('glass')} onStage={setWorldStep}
        onCell={cell => { void audio.unlock(); if (visit) return; if (placing) setPlacing({ ...placing, cell }); else setLine(undefined); }}
        onSelect={id => {
            if (placing) return;
            // えんそうかい (§4): friends gather; each one plays their own note when touched. A
            // sibling's bandstand plays too: visiting can be shared play without changing anything.
            const stand = state.landmarks.find(l => l.id === id && l.kind === 'bandstand');
            if (stand?.cell && !(concert && Date.now() < concert.until)) {
                const length = Math.max(30000, playTune(sound, song) + 2000);
                setConcert({ cell: stand.cell, n: Date.now(), until: Date.now() + length }); setPanel(undefined);
                setLine(`えんそうかいだよ！「${TUNES[song % TUNES.length].name}」 みんなを さわって おとを ならそう`); setSong(song + 1); return;
            }
            if (visit) return;
            setSelected(id); setPanel(undefined);
        }}
        onOpen={id => { if (visit) return; void run({ type: 'open', id }, () => setLine(own.unopened.length > 1 ? 'まだ つぼみが あるよ' : undefined)); }}
        onDisembark={() => { if (!visit) void disembark(); }}
        onActorTap={id => {
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
            setLine(actorLine(own, id)); if (own.villagers.some(v => v.id === id)) setSelected(`villager:${id}`);
        }} />;

    if (show) return <div className="island-life growing-island" data-growing-island="show" data-garden-time={time}>
        <Suspense fallback={null}>{world}</Suspense>{worldStep !== 'ready' && <GrowingLoading step={worldStep} overlay />}
        <button className="growing-chip growing-show-exit" onClick={() => setShow(false)}>おわる</button>
    </div>;

    return <div className="island-life growing-island" data-growing-island={visit ? 'visit' : 'ready'} data-garden-time={time} data-dawn={dawn ? 'true' : undefined}>
        <Suspense fallback={null}>{world}</Suspense>{worldStep !== 'ready' && <GrowingLoading step={worldStep} overlay />}
        {dawn > 0 && <div className="growing-dawn" aria-hidden="true"><span>☀</span></div>}
        <div className="growing-hud-top">
            {visit ? <span className="growing-chip">{visit.name}の しま・{CHARACTER_NAME[visit.state.character]}</span> : <>
                <button className="growing-chip" data-growing-character onClick={() => setNaming(own.islandName ?? '')}>
                    {own.islandName ? `${own.islandName}・` : ''}{CHARACTER_NAME[own.character]}</button>
                <span className="growing-chip" aria-label={`しずく ${own.drops}`}>💧 {own.drops}</span>
                <button className="growing-chip growing-menu-button" aria-expanded={menu} onClick={() => setMenu(!menu)}>メニュー</button>
            </>}
        </div>
        {naming !== undefined && <form className="growing-overlay" onSubmit={event => { event.preventDefault(); if (naming.trim()) void run({ type: 'name', target: 'island', name: naming }, () => setNaming(undefined)); }}>
            <div className="growing-overlay-body growing-name"><label>しまの なまえ<input value={naming} maxLength={12} onChange={e => setNaming(e.target.value)} autoFocus /></label>
                <div className="growing-row"><button type="submit" className="growing-primary">きめる</button><button type="button" onClick={() => setNaming(undefined)}>やめる</button></div></div>
        </form>}
        {menu && !visit && <section className="growing-menu" aria-label="メニュー">
            <div className="growing-row">
                <button onClick={() => { setMenu(false); setSelected(undefined); onHome(); }}>いえ</button>
                <button onClick={() => { setMenu(false); loadFaces(); setPanel('friends'); }}>なかま</button>
                <button onClick={() => { setMenu(false); setPanel('show'); }}>みせる</button>
                <button onClick={() => { setMenu(false); setPanel('flowers'); }}>はなずかん</button>
            </div>
            <div className="growing-row">
                <button onClick={() => { setMenu(false); setPanel('trace'); }}>なぞる</button>
                <button onClick={() => { setMenu(false); setPanel('stored'); }}>もちもの</button>
                <button onClick={() => { setMenu(false); navigate('/settings'); }}>せってい</button>
            </div>
            <div className="growing-row"><button onClick={() => setTurn(turn - 1)}>⟲ まわす</button><button onClick={() => setTurn(turn + 1)}>まわす ⟳</button></div>
            {quote && <div className="growing-row">{quote.sides.map(side => <button key={side} disabled={own.drops < quote.price}
                onClick={() => void run({ type: 'expand', side }, () => { setMenu(false); audio.play('assemble'); })}>
                {side === 'east' ? 'ひがし' : side === 'west' ? 'にし' : 'みなみ'}へ ひろげる 💧{quote.price}</button>)}</div>}
        </section>}
        {!placing && <p className="growing-bubble" role="status"><span aria-hidden="true">ぽこもこ</span>{bubble}</p>}
        {island.error && <div className="growing-error" role="alert"><p>{island.error}</p><button onClick={island.clearError}>とじる</button></div>}
        {visit ? <div className="growing-hud-bottom">
            <button className="growing-open-all" disabled={visit.sent} onClick={async () => {
                if (await sendFlower(profileId, profileName, visit.id)) audio.play('discovery');
                setVisit({ ...visit, sent: true }); setLine(`おはなを おいてきたよ。${visit.name}が みたら よろこぶね`);
            }}>{visit.sent ? 'おはなを おいたよ' : 'おはなを おいてくる 🌸'}</button>
            <button className="growing-seed-button" onClick={() => { setVisit(undefined); setLine(undefined); }}>かえる</button>
        </div> : placing ? <div className="growing-placing">
            <p>{ghost?.cell ? ghost.valid ? 'ここで いい？' : 'ここには おけないよ' : 'おく ばしょを さわってね'}</p>
            <button className="growing-primary" disabled={!ghost?.valid || island.busy} onClick={confirm}>ここに おく</button>
            <button onClick={() => { setPlacing(undefined); setLine(undefined); }}>やめる</button>
        </div> : <div className="growing-hud-bottom">
            {gifts > 0 && <button className="growing-open-all" onClick={() => void run({ type: 'open-all' }, () => { audio.play('glass'); setLine(undefined); })}>ぜんぶ ひらく</button>}
            <button className="growing-seed-button" data-attention={own.tutorial === 'first-home' ? 'true' : undefined}
                onClick={() => { void audio.unlock(); setPanel(panel === 'tray' ? undefined : 'tray'); setSelected(undefined); }}>たね</button>
        </div>}
        {!visit && (panel === 'tray' || panel === 'stored') && !placing && <GrowingTray key={panel} state={own} onPick={pick} onClose={() => setPanel(undefined)} initialTab={panel === 'stored' ? 'stored' : 'seeds'} />}
        {!visit && panel === 'trace' && <TracePanel profileId={profileId} onClose={() => setPanel(undefined)}
            onSave={(image, glyph) => void run({ type: 'emblem', image, glyph }, () => { setPanel(undefined); audio.play('discovery'); setLine(`「${glyph}」が しまの はたに なったよ！`); })} />}
        {!visit && panel === 'friends' && <FriendsPanel state={own} faces={faces} onClose={() => setPanel(undefined)}
            onFocus={id => { setPanel(undefined); setFocus({ id, n: Date.now() }); setLine(actorLine(own, id)); }} />}
        {!visit && panel === 'show' && <ShowPanel onPick={choice => void showChoice(choice)} onClose={() => setPanel(undefined)} />}
        {!visit && panel === 'flowers' && <FlowerBook state={own} onClose={() => setPanel(undefined)} />}
        {panel === 'visit' && <VisitPicker profiles={siblings} onVisit={id => void startVisit(id)} onClose={() => setPanel(undefined)} />}
        {!visit && selected && !placing && <GrowingSheet state={own} target={selected} onAction={sheetAction} onClose={() => setSelected(undefined)} />}
        {card && <CardView url={card.url} busy={!card.blob} frame={card.frame} onFrame={frame => void makeCard(frame)} onSave={() => { if (card.blob) saveImage(card.blob, `${own.islandName ?? 'しま'}-card.png`); }}
            onClose={() => { if (card.url) URL.revokeObjectURL(card.url); setCard(undefined); }} />}
        {story && <StoryView moments={story} onClose={() => setStory(undefined)} />}
    </div>;
}
