import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { canPlace, landQuote, styleAt, waitingSeeds } from '../../../domain/growingIsland';
import { landCells } from '../../../domain/growingIsland/space';
import type { Cell, Command, LandmarkKind, SeedKind } from '../../../domain/growingIsland';
import { gardenTimes, readGardenTime, saveGardenTime, type GardenTime } from '../life/fantasy/presentation';
import { Spinner } from '../../ui/Spinner';
import { actorLine, CHARACTER_NAME, idleLine, revealLine } from './growingCopy';
import { GrowingSheet, type SheetAction } from './GrowingSheet';
import { GrowingTray, type Pick } from './GrowingTray';
import type { Ghost } from './objectLayer';
import { useGrowingIsland } from './useGrowingIsland';
import { publishWaitingSeeds } from './seedBadge';
import './growing.css';

const GrowingWorld = lazy(() => import('./GrowingWorld'));
type Placing = { kind: SeedKind | LandmarkKind; seed: boolean; id?: string; mode: 'new' | 'move' | 'unstore'; cell?: Cell };

function speak(text: string) {
    try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .95;
        window.speechSynthesis.speak(utterance);
    } catch { /* Reading aloud is a convenience; the words stay on screen. */ }
}

/** The growing island home (spec 52): play, plant, learn, open. */
export default function GrowingIsland({ profileId, active, sound, onHome }: { profileId: string; active: boolean; sound: boolean; onHome: () => void }) {
    const island = useGrowingIsland(profileId, active);
    const state = island.record?.state;
    const [time, setTime] = useState<GardenTime>(() => readGardenTime(profileId));
    const [tray, setTray] = useState(false), [menu, setMenu] = useState(false), [turn, setTurn] = useState(0);
    const [placing, setPlacing] = useState<Placing>(), [selected, setSelected] = useState<string>();
    const [line, setLine] = useState<string>(), [dawn, setDawn] = useState(0);
    const [cheer, setCheer] = useState(0), [festival, setFestival] = useState(0);

    useEffect(() => {
        const reveal = island.reveal; if (!reveal || !state) return;
        if (reveal.town.some(e => e.type !== 'quiet' && e.type !== 'boat')) setDawn(reveal.id);
        if (reveal.town.some(e => e.type === 'level')) setFestival(reveal.id);
        setLine(revealLine(state, reveal.town));
        // The reveal is shown once per sync result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [island.reveal?.id]);
    useEffect(() => { if (!dawn) return; const id = window.setTimeout(() => setDawn(0), 1800); return () => clearTimeout(id); }, [dawn]);
    const bubble = state ? line ?? idleLine(state) : '';
    const waiting = state ? waitingSeeds(state) : 0;
    useEffect(() => { publishWaitingSeeds(waiting); }, [waiting]);
    useEffect(() => { if (sound && bubble) speak(bubble); }, [sound, bubble]);

    const ghost = useMemo<Ghost | undefined>(() => {
        if (!state || !placing) return undefined;
        const allowed = landCells(state).filter(cell => canPlace(state, cell, placing.id));
        const valid = Boolean(placing.cell && allowed.some(c => c.x === placing.cell!.x && c.z === placing.cell!.z));
        return { kind: placing.kind, seed: placing.seed, cell: placing.cell, valid, allowed,
            style: placing.cell && placing.seed ? styleAt(state, placing.cell) : 'plain' };
    }, [state, placing]);

    if (!state) return <div className="island-life growing-island" data-growing-island="loading">
        {island.error ? <div className="growing-error" role="alert"><p>{island.error}</p><button onClick={() => void island.sync()}>もういちど</button></div>
            : <Spinner fullScreen message="しまを ひらいているよ…" />}
    </div>;

    const run = async (command: Command, after?: () => void) => { if (await island.dispatch(command)) { after?.(); return true; } return false; };
    const pick = (choice: Pick) => {
        setTray(false); setSelected(undefined); setLine('おく ばしょを えらんでね');
        if (choice.mode === 'unstore') setPlacing({ kind: choice.kind, seed: choice.seed, id: choice.id, mode: 'unstore' });
        else setPlacing({ kind: choice.kind, seed: choice.mode === 'seed', mode: 'new' });
    };
    const confirm = () => {
        if (!placing?.cell || !ghost?.valid) return;
        const cell = placing.cell;
        const command: Command = placing.mode === 'move' ? { type: 'move', id: placing.id!, cell }
            : placing.mode === 'unstore' ? { type: 'unstore', id: placing.id!, cell }
                : placing.seed ? { type: 'plant', kind: placing.kind as SeedKind, cell } : { type: 'place', kind: placing.kind as LandmarkKind, cell };
        void run(command, () => {
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
            const plot = state.plots.find(p => p.id === id), landmark = state.landmarks.find(l => l.id === id);
            setPlacing({ kind: (plot?.kind ?? landmark?.kind)!, seed: Boolean(plot), id, mode: 'move' }); setSelected(undefined);
            setLine('うごかす ばしょを えらんでね'); return;
        }
        const command: Command = action.type === 'store' ? { type: 'store', id } : action.type === 'pluck' ? { type: 'pluck', id }
            : action.type === 'paint' ? { type: 'paint', target: id, color: action.color }
                : action.type === 'name' ? { type: 'name', target: id, name: action.name } : { type: 'away', id, away: action.away };
        void run(command, () => { if (action.type === 'store' || action.type === 'pluck') setSelected(undefined); });
    };
    const disembark = async () => { for (const id of state.arrivals) await island.dispatch({ type: 'disembark', id }); setLine(undefined); };
    const quote = landQuote(state), gifts = state.unopened.length + state.arrivals.length;

    return <div className="island-life growing-island" data-growing-island="ready" data-dawn={dawn ? 'true' : undefined}>
        <Suspense fallback={<Spinner fullScreen message="しまを ひらいているよ…" />}>
            <GrowingWorld state={state} time={time} ghost={ghost} selectedId={selected} turn={turn} cheer={cheer} festival={festival}
                onCell={cell => { if (placing) setPlacing({ ...placing, cell }); else setLine(undefined); }}
                onSelect={id => { if (!placing) { setSelected(id); setTray(false); } }}
                onOpen={id => void run({ type: 'open', id }, () => setLine(state.unopened.length > 1 ? 'まだ つぼみが あるよ' : undefined))}
                onDisembark={() => void disembark()}
                onActorTap={id => {
                    // A friend still on the boat comes ashore when touched (§11.1).
                    if (state.arrivals.includes(id)) { void disembark(); return; }
                    setLine(actorLine(state, id)); if (state.villagers.some(v => v.id === id)) setSelected(`villager:${id}`);
                }} />
        </Suspense>
        {dawn > 0 && <div className="growing-dawn" aria-hidden="true"><span>☀</span></div>}
        <div className="growing-hud-top">
            <span className="growing-chip" data-growing-character>{CHARACTER_NAME[state.character]}</span>
            <span className="growing-chip" aria-label={`しずく ${state.drops}`}>💧 {state.drops}</span>
            <button className="growing-chip growing-menu-button" aria-expanded={menu} onClick={() => setMenu(!menu)}>メニュー</button>
        </div>
        {menu && <section className="growing-menu" aria-label="メニュー">
            <div className="growing-row">{gardenTimes.map(t => <button key={t.id} aria-pressed={time === t.id}
                onClick={() => { setTime(t.id); saveGardenTime(profileId, t.id); }}>{t.label}</button>)}</div>
            <div className="growing-row"><button onClick={() => setTurn(turn - 1)}>⟲ まわす</button><button onClick={() => setTurn(turn + 1)}>まわす ⟳</button></div>
            {quote && <div className="growing-row">{quote.sides.map(side => <button key={side} disabled={state.drops < quote.price}
                onClick={() => void run({ type: 'expand', side }, () => setMenu(false))}>
                {side === 'east' ? 'ひがし' : side === 'west' ? 'にし' : 'みなみ'}へ ひろげる 💧{quote.price}</button>)}</div>}
        </section>}
        {!placing && <p className="growing-bubble" role="status"><span aria-hidden="true">ぽこもこ</span>{bubble}</p>}
        {island.error && <div className="growing-error" role="alert"><p>{island.error}</p><button onClick={island.clearError}>とじる</button></div>}
        {placing ? <div className="growing-placing">
            <p>{ghost?.cell ? ghost.valid ? 'ここで いい？' : 'ここには おけないよ' : 'おく ばしょを さわってね'}</p>
            <button className="growing-primary" disabled={!ghost?.valid || island.busy} onClick={confirm}>ここに おく</button>
            <button onClick={() => { setPlacing(undefined); setLine(undefined); }}>やめる</button>
        </div> : <div className="growing-hud-bottom">
            {gifts > 0 && <button className="growing-open-all" onClick={() => void run({ type: 'open-all' }, () => setLine(undefined))}>ぜんぶ ひらく</button>}
            <button className="growing-seed-button" data-attention={state.tutorial === 'first-home' ? 'true' : undefined}
                onClick={() => { setTray(!tray); setSelected(undefined); }}>たね</button>
        </div>}
        {tray && !placing && <GrowingTray state={state} onPick={pick} onClose={() => setTray(false)} />}
        {selected && !placing && <GrowingSheet state={state} target={selected} onAction={sheetAction} onClose={() => setSelected(undefined)} />}
    </div>;
}
