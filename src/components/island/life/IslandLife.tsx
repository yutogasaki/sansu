import { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Sparkles, Sprout, Flower2, Armchair, FerrisWheel, Lamp, ArrowRight, Home, Move, Archive, Trash2, Check, X } from 'lucide-react';
import { CATALOG, LIFE_CANDIDATE, LIFE_RULES, growthStage, learningDay, vigor, type Cell, type ItemKind, type LifeCommand, type Style } from '../../../domain/islandLife/model';
import { cellKey, districts, isHouse, landCells } from '../../../domain/islandLife/space';
import { replayLife } from '../../../domain/islandLife/simulation';
import { activityLabel, activityPhase, residentReaction } from '../../../domain/islandLife/activity';
import type { useIslandLife } from './useIslandLife';
import LifeWorld from './LifeWorld';
import { previewPlacement } from './placement';
import './life.css';

const icons = { flower: Flower2, bench: Armchair, swing: FerrisWheel, lantern: Lamp };
const residentNames = { pokomoko: 'ぽこもこ', rabbit: 'うさぎ', otter: 'カワウソ' };
export default function IslandLife({ controls, onLearn, onHome, disabled }: {
    controls: ReturnType<typeof useIslandLife>; onLearn: () => void; onHome: () => void; disabled: boolean;
}) {
    const { record, error, busy, refresh } = controls;
    const worldHeader = useRef<HTMLDivElement>(null);
    const actionRunning = useRef(false), retryCompletion = useRef<(() => void) | undefined>(undefined);
    const state = useMemo(() => record ? replayLife(record) : undefined, [record]);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const start = performance.now(); setElapsed(0);
        const timer = window.setInterval(() => setElapsed(performance.now() - start), 1000);
        return () => clearInterval(timer);
    }, [record]);
    const [tab, setTab] = useState<'build' | 'items' | 'style' | 'land'>('build');
    const [kind, setKind] = useState<ItemKind>(), [selected, setSelected] = useState<string>();
    const [cell, setCell] = useState<Cell>(), [moving, setMoving] = useState(false), [removing, setRemoving] = useState(false);
    const [notice, setNotice] = useState('');
    const item = state?.items.find(i => i.id === selected);
    const placement = useMemo(() => state && (kind || moving && item)
        ? previewPlacement(state, kind ?? item!, cell) : undefined, [state, kind, moving, item, cell]);
    const showWorld = () => requestAnimationFrame(() => worldHeader.current?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    if (!state || !record) return <section className="life-controls"><p role="status">{error ?? 'しまを ひらいているよ…'}</p>
        <button className="island-secondary" onClick={() => void refresh()}>もういちど</button><button className="island-primary" onClick={onLearn}>まなぶ</button></section>;
    const locked = disabled || busy;
    const places = districts(state);
    const doAction = async (command: LifeCommand, message: string) => {
        if (locked || actionRunning.current) return;
        const id = crypto.randomUUID();
        const complete = () => {
            setNotice(message); setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false);
            if (command.type === 'buy') { setSelected(id); setTab('items'); }
            if (command.type === 'buy' || command.type === 'move') worldHeader.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
            if (command.type === 'remove') setSelected(undefined);
        };
        actionRunning.current = true; retryCompletion.current = complete;
        try { if (await refresh({ id, revision: record.revision, command })) { complete(); retryCompletion.current = undefined; } }
        finally { actionRunning.current = false; }
    };
    const retryAction = async () => {
        if (locked || actionRunning.current) return;
        actionRunning.current = true;
        try { if (await controls.retry()) { retryCompletion.current?.(); retryCompletion.current = undefined; } }
        finally { actionRunning.current = false; }
    };
    const chooseCell = (next: Cell) => {
        if (locked) return;
        if (kind || moving) { setCell(next); return; }
        const found = state.items.find(i => i.cell && cellKey(i.cell) === cellKey(next));
        if (found) { setSelected(found.id); setTab('items'); setRemoving(false); }
        else if (isHouse(next)) onHome();
    };
    const switchTab = (next: typeof tab) => { setTab(next); setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false); };
    const goal = Math.min(LIFE_RULES.dailyGoal, state.days[learningDay(state.now)] ?? 0);
    return <section className="island-life" data-life-candidate={LIFE_CANDIDATE} data-life-destination={state.target} data-life-revision={record.revision} data-life-drops={state.drops} data-life-light={state.light} data-life-items={state.items.length} data-life-districts={places.map(p => p.label).join(',')}>
        <div ref={worldHeader} className="life-wallet"><span><Droplets size={18} />しずく <strong>{state.drops}</strong></span><span><Sparkles size={18} />ひかり <strong>{state.light}</strong></span>
            <span title={`いぶき ${vigor(state) * 100}%`}><Sprout size={18} />{vigor(state) === 1 ? 'すくすく' : 'ゆっくり そだつ'}</span></div>
        <LifeWorld state={state} selected={selected} cell={cell} placement={placement} onCell={chooseCell} />
        {placement && <div className="life-placement life-controls" data-life-placement-valid={placement.valid} data-life-placement-cell={cell && cellKey(cell)}>
            <h3>{CATALOG[placement.item.kind].label}を {moving ? 'うごかす' : 'おく'}</h3>
            <p role="status">{cell && (placement.valid ? <Check size={18} /> : <X size={18} />)}{placement.reason}</p>
            <div className="life-placement-actions"><button className="island-primary" disabled={locked || !placement.valid} onClick={() => cell && void doAction(kind ? { type: 'buy', kind, cell } : { type: 'move', itemId: selected!, cell }, 'ここに おいたよ。どんな くらしに なるかな？')}>ここに おく</button>
                <button disabled={locked} onClick={() => { setKind(undefined); setMoving(false); setCell(undefined); }}>やめる</button></div>
            <details><summary>マスから えらぶ</summary><div className="life-grid" style={{ gridTemplateColumns: `repeat(${state.expanded ? 9 : 6}, 1fr)` }}>{landCells(state).map(p => <button key={cellKey(p)} aria-label={`ばしょ ${p.x + 1} ${p.z + 1}`} data-life-cell={cellKey(p)} aria-pressed={cell && cellKey(cell) === cellKey(p)} disabled={locked || !placement.allowed.includes(cellKey(p))} onClick={() => setCell(p)}>{p.x + 1},{p.z + 1}</button>)}</div></details>
        </div>}
        <div className="life-caption"><div><p className="life-eyebrow">ぽこもこの にわ</p><h2>{places.length ? places.map(p => p.label).join(' と ') : 'なにを つくろう？'}</h2></div>
            <button className="island-text-button" onClick={onHome} disabled={locked}><Home size={17} />いえへ</button></div>
        <div className="life-residents" aria-label="みんなのようす">{state.residents.map(r => {
            const target = state.items.find(i => i.id === r.visit?.itemId);
            const reaction = residentReaction(state, r, state.now + elapsed);
            return <span key={r.id} data-life-resident={r.id} data-life-target={target?.kind ?? 'home'} data-life-activity={activityPhase(state, r, state.now + elapsed)}><b>{residentNames[r.id]}</b>{reaction?.label ?? activityLabel(state, r, state.now + elapsed)}</span>;
        })}</div>
        <div className="life-controls">
            <button className="island-primary life-learn" onClick={onLearn} disabled={disabled}>まなぶ<ArrowRight size={20} /></button>
            <p className="life-goal">{goal === LIFE_RULES.dailyGoal ? 'きょうの いぶきが みちたよ' : `きょうの いぶき ${goal} / ${LIFE_RULES.dailyGoal} といたぶんは のこるよ`}</p>
            <div className="life-tabs" role="group" aria-label="しまの ていれ">{([['build', 'つくる'], ['items', 'もちもの'], ['style', 'いろ'], ['land', 'ひろげる']] as const).map(([id, name]) =>
                <button key={id} aria-pressed={tab === id} disabled={locked} onClick={() => switchTab(id)}>{name}</button>)}</div>
            {error && <div className="life-error" role="alert"><p>{error}</p><button onClick={() => void retryAction()} disabled={locked}>もういちど</button><button onClick={() => { retryCompletion.current = undefined; controls.clearError(); }} disabled={locked}>よみなおす</button></div>}
            {notice && !error && <p role="status" className="life-notice">{notice}</p>}
            {tab === 'build' && <div className="life-catalog">{(Object.keys(CATALOG) as ItemKind[]).map(k => { const Icon = icons[k]; return <button key={k} data-life-buy={k} aria-pressed={kind === k}
                disabled={locked || state.drops < CATALOG[k].price} onClick={() => { setKind(k); setCell(undefined); setSelected(undefined); setNotice(''); showWorld(); }}>
                <Icon size={26} /><b>{CATALOG[k].label}</b><span>しずく {CATALOG[k].price}</span></button>; })}</div>}
            {tab === 'items' && <>
                <div className="life-items">{state.items.map((i, index) => <button key={i.id} data-life-item={i.id} aria-pressed={selected === i.id} onClick={() => { setSelected(i.id); setMoving(false); setRemoving(false); setCell(undefined); }} disabled={locked}>
                    {CATALOG[i.kind].label} {index + 1}<small>{!i.cell ? 'しまってある' : i.kind === 'flower' ? ['めが でた', 'つぼみ', 'さいた'][growthStage(i)] : 'おいてある'}</small></button>)}</div>
                {!state.items.length && <p>しずくで、さいしょの ひとつを えらぼう。</p>}
                {item && <div className="life-item-actions"><h3>{CATALOG[item.kind].label}</h3>
                    <button disabled={locked || !item.cell || item.kind === 'lantern'} onClick={() => void doAction({ type: 'visit', itemId: item.id }, 'ぽこもこの いきさきを きめたよ。だれか くるかな？')}>ぽこもこを よぶ</button>
                    <button disabled={locked} onClick={() => { setMoving(true); setCell(undefined); setRemoving(false); setNotice(''); showWorld(); }}><Move size={16} />{item.cell ? 'うごかす' : 'おく'}</button>
                    <button disabled={locked || !item.cell} onClick={() => void doAction({ type: 'store', itemId: item.id }, 'そだったまま しまったよ。')}><Archive size={16} />しまう</button>
                    <button disabled={locked} onClick={() => setRemoving(true)}><Trash2 size={16} />とりのぞく</button>
                    {removing && <div className="life-confirm"><p>とりのぞくと、しずく {Math.floor(CATALOG[item.kind].price / 2)} が もどるよ。この ものの そだちは もどせないよ。</p>
                        <button disabled={locked} onClick={() => void doAction({ type: 'remove', itemId: item.id }, 'しずくが もどったよ。')}>とりのぞくと きめる</button><button disabled={locked} onClick={() => setRemoving(false)}>やめる</button></div>}
                </div>}
            </>}
            {tab === 'style' && <><p>{item ? CATALOG[item.kind].label : 'ぽこもこ'}の いろを えらぼう。</p><button onClick={() => setSelected(undefined)} disabled={locked}>ぽこもこの いろ</button><div className="life-styles">{([['original', 'もとの いろ'], ['sunshine', 'ひだまり'], ['starlight', 'ほしあかり']] as const).map(([style, label]) => <button key={style} data-life-style={style} disabled={locked || !state.styles.includes(style) && state.light < LIFE_RULES.stylePrice}
                onClick={() => void doAction({ type: 'style', style: style as Style, itemId: item?.id }, 'いろが かわったよ。いつでも もどせるよ。')}><i className={`life-swatch ${style}`} /><b>{label}</b><small>{state.styles.includes(style) ? 'つかえる' : `ひかり ${LIFE_RULES.stylePrice}`}</small></button>)}</div></>}
            {tab === 'land' && (state.expanded ? <p>ひろがった しまに、すきな ばしょを つくろう。</p> : <><p>しずく {LIFE_RULES.expansionPrice} で、みぎか ひだりへ３列ひろがるよ。</p><div className="life-land">{([['west', 'ひだりへ'], ['east', 'みぎへ']] as const).map(([side, label]) => <button key={side} disabled={locked || state.drops < LIFE_RULES.expansionPrice} onClick={() => void doAction({ type: 'expand', side }, 'しまが ひろがったよ！')}>{label} ひろげる</button>)}</div></>)}
        </div>
        {import.meta.env.DEV && <details className="life-dev"><summary>開発用：時間と保存の確認</summary><p>独立した試作の島です。通常の学習記録・旧島の所有物は変更しません。家の中は既存画面です。時間送りはこの島だけに作用します。</p>
            {[6, 24].map(hours => <button key={hours} disabled={locked} onClick={() => void refresh({ id: crypto.randomUUID(), revision: record.revision, advanceHours: hours as 6 | 24 })}>試作を {hours}時間すすめる</button>)}
        </details>}
    </section>;
}
