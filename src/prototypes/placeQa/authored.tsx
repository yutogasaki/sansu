import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GrowingWorld from '../../components/island/growing/GrowingWorld';
import type { Ghost } from '../../components/island/growing/objectLayer';
import { decodeNativeGrowingKit } from '../../components/island/growing/native/decodeNativeGrowingKit';
import worldManifest from '../../../docs/design/2026-10-11-authored-world-foundation/world-manifest.json';
import { compileWorldDefinition, type IslandWorld } from '../../domain/growingIsland/worldDefinition';
import { applyIntent, canPlace, canReachHomePlacement } from '../../domain/growingIsland/commands';
import { key, landCells } from '../../domain/growingIsland/space';
import { derivePlaces } from '../../domain/growingIsland/places';
import { authoredWaterFrame } from '../../domain/growingIsland/authoredWaterFrame';
import { withNative05WaterCarvingScope } from '../../domain/growingIsland/authoredWaterCarving';
import { advanceNature } from '../../domain/growingIsland/nature';
import { syncPlaceMilestones } from '../../domain/growingIsland/placeGoals';
import { LANDMARK_PRICE } from '../../domain/growingIsland/rules';
import type { GrowingState, Cell, Plot, Landmark, LandmarkKind } from '../../domain/growingIsland/types';
import './authored.css';
interface Fixture { schema: string; candidate: string; synthetic: boolean; worldId: string; state: GrowingState }
const names: Record<string, string> = { home: 'いえ', sapling: '木', flower: '花', bench: 'ベンチ', play: 'あそびば', 'water-bowl': '泉', 'water-channel': 'みずみち' };
const waterAssembly = new URLSearchParams(window.location.search).get('water') === 'wide';
const growthDiagnostic = new URLSearchParams(window.location.search).get('grow') === '1';
const purchases: LandmarkKind[] = ['sapling', 'bench', 'flower', 'water-bowl', 'water-channel'];
function AuthoredIsland({ world: base, fixture }: { world: IslandWorld; fixture: Fixture }) {
    const [state, setState] = useState(fixture.state), [selected, setSelected] = useState<string>(), [moving, setMoving] = useState(false), [cell, setCell] = useState<Cell>();
    const frame = useMemo(() => waterAssembly ? authoredWaterFrame(state, base) : undefined, [state, base]);
    const world = frame?.world ?? base;
    const stateRef = useRef(fixture.state);
    const [planting, setPlanting] = useState<LandmarkKind>();
    const [history, setHistory] = useState<unknown[]>([]);
    const [stage, setStage] = useState('scene'), [message, setMessage] = useState('家や木を選んで、置き方を変えられます。');
    const [turn, setTurn] = useState(0), [reset, setReset] = useState(0), [time, setTime] = useState<'day' | 'dusk'>('day');
    const [focus, setFocus] = useState<{ id: string; n: number }>();
    const owners = [...state.plots, ...state.landmarks] as (Plot | Landmark)[], owner = owners.find(item => item.id === selected);
    const allowed = useMemo(() => {
        const placedOwner = [...state.plots, ...state.landmarks].find(item => item.id === selected);
        if (planting) return landCells(state, world).filter(at => canPlace(state, at, undefined, world));
        return placedOwner ? landCells(state, world).filter(at => placedOwner.kind === 'home'
            ? canReachHomePlacement(state, at, placedOwner.id, world) : canPlace(state, at, placedOwner.id, world)) : [];
    }, [selected, planting, state, world]);
    const valid = Boolean(cell && allowed.some(at => key(at) === key(cell)));
    const ghost: Ghost | undefined = planting ? { kind: planting, seed: false, prospectiveOwnerId: `l${state.nextId}`, style: 'plain', cell, valid, allowed,
        ...(planting === 'flower' ? { color: 'white' } : {}) } : moving && owner ? { kind: owner.kind, seed: 'stage' in owner, ownerId: owner.id, style: 'style' in owner ? owner.style ?? 'plain' : 'plain', cell, valid, allowed,
        ...('color' in owner && owner.color ? { color: owner.color } : {}) } : undefined;
    const choose = (id?: string) => { setSelected(id); setMoving(false); setPlanting(undefined); setCell(undefined); if (id) setFocus(old => ({ id, n: (old?.n ?? 0) + 1 })); };
    const command = (action: Parameters<typeof applyIntent>[1]['command']) => {
        try { const before = stateRef.current;
            const result = applyIntent(before, { id: crypto.randomUUID(), command: action }, before.nature.realAt, world); stateRef.current = result.state; setState(result.state);
            if (action.type !== 'place-shown' && action.type !== 'place-used') {
                setHistory(old => [...old, { command: action, at: before.nature.realAt, before: { drops: before.drops, nextId: before.nextId, nature: before.nature.hours }, after: { drops: result.state.drops, nextId: result.state.nextId, nature: result.state.nature.hours }, events: result.events }]);
                setMoving(false); setPlanting(undefined); setCell(undefined); setMessage(action.type === 'place' ? '取得しました。苗と花は自然時間で育ちます。' : '置き方が変わりました。');
            }
            return true;
        } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); return false; }
    };
    const passNature = () => {
        const before = stateRef.current, next = structuredClone(before), now = before.nature.realAt + 18 * 3600000;
        const events = advanceNature(next, now, world); syncPlaceMilestones(next, now, world);
        stateRef.current = next; setState(next); setMoving(false); setPlanting(undefined); setCell(undefined);
        setHistory(old => [...old, { command: { type: 'diagnostic-nature', hours: 18 }, at: now, before: { nature: before.nature.hours }, after: { nature: next.nature.hours }, events }]);
        setMessage('診断の自然時間を18時間進めました。学習の時計は進めていません。');
    };
    const places = useMemo(() => derivePlaces(state, world), [state, world]);
    return <div className="authored-island" data-authored-island data-build-revision={__BUILD_REVISION__} data-visual-candidate={fixture.candidate} data-world-id={world.id} data-world-revision={world.definition.revision ?? 'base'} data-authored-state={JSON.stringify(state)} data-state-owners={JSON.stringify(owners.map(item => [item.id, item.kind, item.cell]))} data-place-progress={JSON.stringify(state.placeProgress)} data-authored-diagnostic-history={JSON.stringify(history)} data-growth-diagnostic={String(growthDiagnostic)}>
        <header><div><p>全島3D · 制作中の診断</p><h1>入り江と丘の島を編集する</h1><span>同じ地形で、置く・選ぶ・歩く。</span></div><a href="/prototypes/place-qa/expansion.html">以前の拡張と比較</a></header>
        <main><section className="authored-stage" aria-label="編集できる島">
            <GrowingWorld key={reset} world={base} authoredWater={waterAssembly} state={state} time={time} turn={turn} cheer={0} festival={0} ghost={ghost} selectedId={selected} focus={focus}
                onSelect={choose} onCell={at => { if (moving || planting) {
                    const finite = Number.isFinite(at.x) && Number.isFinite(at.z);
                    setCell(finite ? at : undefined); setMessage(finite ? '置く場所を選びました。' : 'ここには置けません。');
                } }}
                onPlaceShown={receipt => command({ type: 'place-shown', profileId: 'native05-authored-whole-diagnostic', expectedRevision: 0, ...receipt })}
                onPlaceUse={receipt => command({ type: 'place-used', profileId: 'native05-authored-whole-diagnostic', expectedRevision: 0, ...receipt })}
                onOpen={id => command({ type: 'open', id })} onDisembark={() => command({ type: 'open-all' })} onActorTap={() => {}} onStage={setStage} onFailure={setMessage} />
            {stage !== 'ready' && <p className="authored-status" role="status">{stage === 'failed' ? '表示を読み直してください。' : '島を描いています…'}</p>}
            <div className="authored-view"><button onClick={() => setTurn(turn - 1)} aria-label="左へ回す">↶</button><button onClick={() => { setReset(reset + 1); setFocus(undefined); }}>全景</button><button onClick={() => setTurn(turn + 1)} aria-label="右へ回す">↷</button><button onClick={() => setTime(time === 'day' ? 'dusk' : 'day')}>{time === 'day' ? '夕の光' : '昼の光'}</button></div>
        </section><aside aria-label="島の編集"><p role="status">{message}</p>
            {growthDiagnostic && <><h2>取得と育成の診断 · {state.drops}しずく</h2><div className="authored-actions">
                {purchases.map(kind => <button key={kind} data-purchase-kind={kind} aria-pressed={planting === kind} disabled={!state.unlocked.includes(`landmark:${kind}`) || state.drops < LANDMARK_PRICE[kind]!} onClick={() => { setSelected(undefined); setMoving(false); setPlanting(kind); setCell(undefined); setMessage('取得済みの空いた土地を選んでください。'); }}>{names[kind]} · {LANDMARK_PRICE[kind]}</button>)}
                <button data-advance-nature="18" disabled={Boolean(moving || planting)} onClick={passNature}>自然時間を18時間進める（診断）</button>
                {planting && <><button disabled={!valid} onClick={() => valid && command({ type: 'place', kind: planting, cell: cell!, ...(planting === 'flower' ? { color: 'white' as const } : {}) })}>ここにおく</button><button onClick={() => { setPlanting(undefined); setCell(undefined); }}>やめる</button></>}
            </div></>}
            {owner ? <><h2>{names[owner.kind] ?? owner.kind}</h2><div className="authored-actions">
                <button onClick={() => { setMoving(true); setCell(undefined); setMessage('島の空いているところを選んでください。'); }}>{owner.cell ? 'うごかす' : 'おく'}</button>
                {owner.cell && <button onClick={() => command({ type: 'store', id: owner.id })}>しまう</button>}
                {moving && <><button disabled={!valid} onClick={() => valid && command({ type: owner.cell ? 'move' : 'unstore', id: owner.id, cell: cell! })}>ここにおく</button><button onClick={() => { setMoving(false); setCell(undefined); }}>やめる</button></>}
            </div></> : <h2>島のもの</h2>}
            <div className="authored-owner-list">{owners.map(item => <button key={item.id} data-owner-id={item.id} aria-pressed={selected === item.id} onClick={() => choose(item.id)}>{names[item.kind] ?? item.kind}{item.cell ? '' : '（収納）'}</button>)}</div>
            <p className="authored-places">{places.map(place => `${place.family} ${place.stage}`).join(' · ')}</p>
        </aside></main><footer>明示した合成入力からの{owners.length}所有物・{state.plots.filter(item => item.kind === 'home').length}軒の診断。本人の保存、学習記録には書き込みません。<br/>ドラッグで見回す・ピンチで拡大 · {__BUILD_REVISION__}</footer>
    </div>;
}
const root = createRoot(document.getElementById('app')!);
if (!import.meta.env.DEV) root.render(<p>この制作中の島は開発環境で開いてください。</p>);
else void Promise.all([fetch('/prototypes/place-qa/native05-world.json.gz', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw Error('共通地形がありません。');
    const bytes = await decodeNativeGrowingKit(await response.arrayBuffer(), { sha256: worldManifest.artifact.expandedSha256, gzipSha256: worldManifest.artifact.sha256, bytes: worldManifest.artifact.expandedBytes });
    const base = compileWorldDefinition(JSON.parse(new TextDecoder().decode(bytes)));
    return waterAssembly ? withNative05WaterCarvingScope(base) : base;
}), fetch(waterAssembly ? '/prototypes/place-qa/authored-water-fixture.json' : '/prototypes/place-qa/authored-fixture.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw Error('診断入力がありません。'); return response.json() as Promise<Fixture>; })])
    .then(([world, fixture]) => { if (fixture.schema !== 'sansu-authored-whole-diagnostic-v1' || !fixture.synthetic || fixture.worldId !== world.id) throw Error('診断と地形が一致しません。'); root.render(<AuthoredIsland world={world} fixture={fixture} />); })
    .catch(error => root.render(<p role="alert">{String(error)}</p>));
