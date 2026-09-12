import { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Sparkles, Sprout, Flower2, Armchair, FerrisWheel, Lamp, Home, Move, Archive, Trash2, Check, X } from 'lucide-react';
import { CATALOG, LIFE_CANDIDATE, LIFE_RULES, learningDay, vigor, type Cell, type ItemKind, type LifeCommand, type Style } from '../../../domain/islandLife/model';
import { cellKey, districts, isHouse, landCells } from '../../../domain/islandLife/space';
import { replayLife } from '../../../domain/islandLife/simulation';
import { activityLabel, activityPhase, residentFavoriteLabel, residentReaction } from '../../../domain/islandLife/activity';
import type { useIslandLife } from './useIslandLife';
import LifeWorld from './LifeWorld';
import { previewPlacement } from './placement';
import { rewardDelta } from './rewardCue';
import { growthSnapshot, growthTransitions, type GrowthTransition } from './growthCue';
import { lifeGrowthStatus, type LifeGrowthStatus } from './growthStatus';
import { observationSnapshot, observationTransitions, type LifeObservationCue } from './observationCue';
import './life.css';
import './life-feedback.css';
import './life-growth.css';

const icons = { flower: Flower2, bench: Armchair, swing: FerrisWheel, lantern: Lamp };
const residentNames = { pokomoko: 'ぽこもこ', rabbit: 'うさぎ', otter: 'カワウソ' };
const tabOptions = [
    ['build', 'つくる', Sprout],
    ['items', 'もちもの', Archive],
    ['style', 'いろ', Sparkles],
    ['land', 'ひろげる', Move],
] as const;
function GrowthDots({ status }: { status: LifeGrowthStatus }) {
    return <span className="life-growth-dots" role="img" aria-label={`そだち ${status.stage + 1} / 3`}>
        {[0, 1, 2].map(stage => <i className="life-growth-dot" key={stage} data-grown={stage <= status.stage} data-current={stage === status.stage} />)}
    </span>;
}
export default function IslandLife({ controls, onHome, disabled }: {
    controls: ReturnType<typeof useIslandLife>; onHome: () => void; disabled: boolean;
}) {
    const { record, error, busy, refresh } = controls;
    const [menuOpen, setMenuOpen] = useState(false);
    const [page, setPage] = useState(0), [cellPage, setCellPage] = useState(0);
    const [gridOpen, setGridOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const actionRunning = useRef(false), retryCompletion = useRef<(() => void) | undefined>(undefined);
    const lastObservedDrops = useRef<number | undefined>(undefined);
    const lastObservedLight = useRef<number | undefined>(undefined);
    const lastObservedGrowth = useRef<Record<string, number> | undefined>(undefined);
    const lastObservedObservation = useRef<Record<string, string> | undefined>(undefined);
    const state = useMemo(() => record ? replayLife(record) : undefined, [record]);
    const [elapsed, setElapsed] = useState(0);
    const [earnedDrops, setEarnedDrops] = useState<number>();
    const [earnedLight, setEarnedLight] = useState<number>();
    const [grownItems, setGrownItems] = useState<GrowthTransition[]>([]);
    const [observationCues, setObservationCues] = useState<LifeObservationCue[]>([]);
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
    const showWorld = () => { setMenuOpen(false); setGridOpen(false); };
    useEffect(() => {
        if (!menuOpen) return;
        menuRef.current?.focus();
        const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
        window.addEventListener('keydown', close);
        return () => window.removeEventListener('keydown', close);
    }, [menuOpen]);
    useEffect(() => {
        if (!record) return;
        const current = replayLife(record);
        let previousDrops = lastObservedDrops.current;
        let previousLight = lastObservedLight.current;
        let previousGrowth = lastObservedGrowth.current;
        let previousObservation = lastObservedObservation.current;
        try {
            const savedDrops = window.sessionStorage.getItem(`sansu:island-life-seen-drops:${record.profileId}`);
            const savedLight = window.sessionStorage.getItem(`sansu:island-life-seen-light:${record.profileId}`);
            const savedGrowth = window.sessionStorage.getItem(`sansu:island-life-seen-growth:${record.profileId}`);
            const savedObservation = window.sessionStorage.getItem(`sansu:island-life-seen-observation:${record.profileId}`);
            if (previousDrops === undefined && savedDrops !== null && Number.isFinite(Number(savedDrops))) previousDrops = Number(savedDrops);
            if (previousLight === undefined && savedLight !== null && Number.isFinite(Number(savedLight))) previousLight = Number(savedLight);
            if (previousGrowth === undefined && savedGrowth !== null) {
                const parsed: unknown = JSON.parse(savedGrowth);
                if (parsed && typeof parsed === 'object') {
                    const valid = Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[0] === 'string' && Number.isInteger(entry[1]));
                    previousGrowth = Object.fromEntries(valid);
                }
            }
            if (previousObservation === undefined && savedObservation !== null) {
                const parsed: unknown = JSON.parse(savedObservation);
                if (parsed && typeof parsed === 'object') {
                    const valid = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string');
                    previousObservation = Object.fromEntries(valid);
                }
            }
            window.sessionStorage.setItem(`sansu:island-life-seen-drops:${record.profileId}`, String(current.drops));
            window.sessionStorage.setItem(`sansu:island-life-seen-light:${record.profileId}`, String(current.light));
            window.sessionStorage.setItem(`sansu:island-life-seen-growth:${record.profileId}`, JSON.stringify(growthSnapshot(current.items)));
            window.sessionStorage.setItem(`sansu:island-life-seen-observation:${record.profileId}`, JSON.stringify(observationSnapshot(current)));
        } catch { /* Private browsing or storage denial should not block the island. */ }
        lastObservedDrops.current = current.drops;
        lastObservedLight.current = current.light;
        lastObservedGrowth.current = growthSnapshot(current.items);
        lastObservedObservation.current = observationSnapshot(current);
        const dropsGain = rewardDelta(current.drops, previousDrops);
        const lightGain = rewardDelta(current.light, previousLight);
        if (dropsGain !== undefined) setEarnedDrops(dropsGain);
        if (lightGain !== undefined) setEarnedLight(lightGain);
        const transitions = growthTransitions(current.items, previousGrowth);
        if (transitions.length) setGrownItems(transitions);
        const observations = observationTransitions(current, previousObservation);
        if (observations.length) setObservationCues(observations);
    }, [record]);
    useEffect(() => {
        if (earnedDrops === undefined && earnedLight === undefined && !grownItems.length && !observationCues.length) return;
        const id = window.setTimeout(() => { setEarnedDrops(undefined); setEarnedLight(undefined); setGrownItems([]); setObservationCues([]); }, 7000);
        return () => window.clearTimeout(id);
    }, [earnedDrops, earnedLight, grownItems, observationCues]);
    if (!state || !record) return <section className="life-controls"><p role="status">{error ?? 'しまを ひらいているよ…'}</p>
        <button className="island-secondary" onClick={() => void refresh()}>もういちど</button></section>;
    const locked = disabled || busy;
    const places = districts(state);
    const doAction = async (command: LifeCommand, message: string) => {
        if (locked || actionRunning.current) return;
        const id = crypto.randomUUID();
        const complete = () => {
            setNotice(message); setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false);
            if (command.type === 'buy') { setSelected(id); setTab('items'); }
            if (command.type === 'buy' || command.type === 'move') showWorld();
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
        if (found) { setSelected(found.id); setTab('items'); setMenuOpen(true); setRemoving(false); }
        else if (isHouse(next)) onHome();
    };
    const switchTab = (next: typeof tab) => { setEarnedDrops(undefined); setEarnedLight(undefined); setGrownItems([]); setObservationCues([]); setMenuOpen(next !== tab || !menuOpen); setPage(0); if (next !== 'style') setSelected(undefined); setTab(next); setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false); };
    const products = Object.keys(CATALOG) as ItemKind[];
    const pageCount = Math.max(1, Math.ceil((tab === 'build' ? products.length : state.items.length) / 2));
    const currentPage = Math.min(page, pageCount - 1);
    const cells = landCells(state), cellPages = Math.ceil(cells.length / 6);
    const pager = <div className="life-pager"><button aria-label="まえの ページ" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage + 1} / {pageCount}</span><button aria-label="つぎの ページ" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)}>→</button></div>;
    const goal = Math.min(LIFE_RULES.dailyGoal, state.days[learningDay(state.now)] ?? 0);
    return <section className="island-life" data-life-candidate={LIFE_CANDIDATE} data-life-destination={state.target} data-life-revision={record.revision} data-life-drops={state.drops} data-life-light={state.light} data-life-items={state.items.length} data-life-districts={places.map(p => p.label).join(',')}>
        <div className="life-wallet" aria-label="しまの もちもの">
            <span className="life-wallet-item life-wallet-item--drops" data-life-resource="drops"><Droplets size={18} /><span>しずく</span><strong>{state.drops}</strong></span>
            <span className="life-wallet-item life-wallet-item--light" data-life-resource="light" title="みんなが たのしむと ふえるよ"><Sparkles size={18} /><span>ひかり</span><strong>{state.light}</strong></span>
            <span className="life-wallet-item life-wallet-item--growth" data-life-resource="growth" title={`いぶき ${vigor(state) * 100}%`}><Sprout size={18} /><span>{vigor(state) === 1 ? 'すくすく' : 'ゆっくり そだつ'}</span></span>
        </div>
        <div className="life-viewport">
        <LifeWorld state={state} selected={selected} cell={cell} placement={placement} onCell={chooseCell} />
        {(earnedDrops !== undefined || earnedLight !== undefined || grownItems.length > 0 || observationCues.length > 0) && <button className="life-earned" data-life-earned={earnedDrops} data-life-light-earned={earnedLight}
            data-life-growth-earned={grownItems.map(item => item.id).join(',') || undefined} data-life-observation-earned={observationCues.map(item => item.id).join(',') || undefined} aria-live="polite"
            onClick={() => switchTab(grownItems.length || observationCues.length ? 'items' : earnedLight !== undefined ? 'style' : 'build')}>
            {earnedDrops !== undefined && <span className="life-earned-message">学んだぶん <strong>+{earnedDrops} しずく</strong></span>}
            {earnedLight !== undefined && <span className="life-earned-message">みんなが あそんだ <strong>+{earnedLight} ひかり</strong></span>}
            {grownItems.map(item => <span className="life-earned-message" key={item.id}>おはなが <strong>{item.message}</strong></span>)}
            {observationCues.map(item => <span className="life-earned-message" key={item.id}><strong>{item.message}</strong> <span aria-hidden="true">{item.symbol}</span></span>)}
            <span className="life-earned-action">{grownItems.length ? 'そだちを みる →' : observationCues.length ? 'ようすを みる →' : earnedLight !== undefined ? 'いろを えらぶ →' : 'つくるものを えらぶ →'}</span>
        </button>}
        {placement && <div className="life-placement life-controls" data-life-placement-valid={placement.valid} data-life-placement-cell={cell && cellKey(cell)}>
            <h3>{CATALOG[placement.item.kind].label}を {moving ? 'うごかす' : 'おく'}</h3>
            <p role="status">{cell && (placement.valid ? <Check size={18} /> : <X size={18} />)}{placement.reason}</p>
            <div className="life-placement-actions"><button className="island-primary" disabled={locked || !placement.valid} onClick={() => cell && void doAction(kind ? { type: 'buy', kind, cell } : { type: 'move', itemId: selected!, cell }, 'ここに おいたよ。どんな くらしに なるかな？')}>ここに おく</button>
                <button disabled={locked} onClick={() => { setKind(undefined); setMoving(false); setCell(undefined); }}>やめる</button></div>
            <button className="life-grid-toggle" aria-expanded={gridOpen} onClick={() => setGridOpen(!gridOpen)}>マスから えらぶ</button>
            {gridOpen && <div className="life-cell-picker"><div className="life-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>{cells.slice(cellPage * 6, cellPage * 6 + 6).map(p => <button key={cellKey(p)} aria-label={`ばしょ ${p.x + 1} ${p.z + 1}`} data-life-cell={cellKey(p)} aria-pressed={cell && cellKey(cell) === cellKey(p)} disabled={locked || !placement.allowed.includes(cellKey(p))} onClick={() => { setCell(p); setGridOpen(false); }}>{p.x + 1},{p.z + 1}</button>)}</div><div className="life-pager"><button aria-label="まえの マス" disabled={cellPage === 0} onClick={() => setCellPage(cellPage - 1)}>←</button><span>{cellPage + 1} / {cellPages}</span><button aria-label="つぎの マス" disabled={cellPage + 1 >= cellPages} onClick={() => setCellPage(cellPage + 1)}>→</button></div></div>}

        </div>}
        {menuOpen && !placement && <div ref={menuRef} tabIndex={-1} className="life-controls life-menu" role="region" aria-label="しまの メニュー">
            <div className="life-menu-heading"><div className="life-menu-title">{(() => { const Icon = tabOptions.find(([id]) => id === tab)?.[2] ?? Sprout; return <Icon size={17} aria-hidden="true" />; })()}<b>{{ build: 'つくる', items: 'もちもの', style: 'いろ', land: 'ひろげる' }[tab]}</b></div>{(tab === 'build' || tab === 'items' && !item) && pageCount > 1 && pager}<button aria-label="メニューを とじる" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
            {error && <div className="life-error" role="alert"><p>{error}</p><button onClick={() => void retryAction()} disabled={locked}>もういちど</button><button onClick={() => { retryCompletion.current = undefined; controls.clearError(); }} disabled={locked}>よみなおす</button></div>}
            {notice && !error && <p role="status" className="life-notice">{notice}</p>}
            {tab === 'build' && <>
                {!products.some(k => state.drops >= CATALOG[k].price) && <p className="life-menu-hint" data-life-build-hint role="status">まなぶと しずくが ふえるよ。</p>}
                <div className="life-catalog">{products.slice(currentPage * 2, currentPage * 2 + 2).map(k => { const Icon = icons[k]; const missing = CATALOG[k].price - state.drops; return <button key={k} data-life-buy={k} data-life-kind={k} aria-pressed={kind === k}
                    disabled={locked || missing > 0} onClick={() => { setKind(k); setCell(undefined); setSelected(undefined); setNotice(''); showWorld(); }}>
                    <i className="life-catalog-icon"><Icon size={24} /></i><b>{CATALOG[k].label}</b><span>{missing > 0 ? `あと ${missing} しずく` : `しずく ${CATALOG[k].price}`}</span></button>; })}</div>
            </>}
            {tab === 'items' && <>
                <div className="life-items">{!item && state.items.slice(currentPage * 2, currentPage * 2 + 2).map((i, index) => { const growth = lifeGrowthStatus(i); return <button key={i.id} data-life-item={i.id} data-life-growth-stage={growth.stage}
                    data-life-growth-next-hours={growth.remainingHours} aria-pressed={selected === i.id} onClick={() => { setSelected(i.id); setMoving(false); setRemoving(false); setCell(undefined); }} disabled={locked}>
                    {CATALOG[i.kind].label} {currentPage * 2 + index + 1}<span className="life-item-growth">{!i.cell ? <small>しまってある</small> : <><GrowthDots status={growth} /><small>{growth.label}</small>{growth.nextLabel && <small className="life-growth-next">あと {growth.remainingHours}じかんで {growth.nextLabel}</small>}</>}</span></button>; })}</div>
                {!state.items.length && <p>しずくで、さいしょの ひとつを えらぼう。</p>}
                {item && <div className="life-item-actions"><h3><button aria-label="もちものの 一覧へ" onClick={() => { setSelected(undefined); setRemoving(false); }}>←</button> {CATALOG[item.kind].label}</h3>
                    {(() => { const growth = lifeGrowthStatus(item); return <div className="life-item-growth-detail" data-life-growth-stage={growth.stage}><div><GrowthDots status={growth} /><strong>{item.cell ? growth.label : 'しまってある'}</strong></div>
                        <small>{!item.cell ? 'おくと そだちが はじまるよ' : growth.nextLabel ? `あと ${growth.remainingHours}じかんで ${growth.nextLabel}` : 'いちばん おおきく そだったよ'}</small></div>; })()}
                    <button hidden={removing} disabled={locked || !item.cell || item.kind === 'lantern'} onClick={() => void doAction({ type: 'visit', itemId: item.id }, 'ぽこもこの いきさきを きめたよ。だれか くるかな？')}>ぽこもこを よぶ</button>
                    <button hidden={removing} disabled={locked} onClick={() => { setMoving(true); setCell(undefined); setRemoving(false); setNotice(''); showWorld(); }}><Move size={16} />{item.cell ? 'うごかす' : 'おく'}</button>
                    <button hidden={removing} disabled={locked || !item.cell} onClick={() => void doAction({ type: 'store', itemId: item.id }, 'そだったまま しまったよ。')}><Archive size={16} />しまう</button>
                    <button hidden={removing} disabled={locked} onClick={() => setRemoving(true)}><Trash2 size={16} />とりのぞく</button>
                    {removing && <div className="life-confirm"><p>とりのぞくと、しずく {Math.floor(CATALOG[item.kind].price / 2)} が もどるよ。この ものの そだちは もどせないよ。</p>
                        <button disabled={locked} onClick={() => void doAction({ type: 'remove', itemId: item.id }, 'しずくが もどったよ。')}>とりのぞくと きめる</button><button disabled={locked} onClick={() => setRemoving(false)}>やめる</button></div>}
                </div>}
            </>}
            {tab === 'style' && <><p>{item ? CATALOG[item.kind].label : 'ぽこもこ'}の いろを えらぼう。</p>{item && <button onClick={() => setSelected(undefined)} disabled={locked}>ぽこもこの いろ</button>}<div className="life-styles">{([['original', 'もとの いろ'], ['sunshine', 'ひだまり'], ['starlight', 'ほしあかり']] as const).map(([style, label]) => <button key={style} data-life-style={style} disabled={locked || !state.styles.includes(style) && state.light < LIFE_RULES.stylePrice}
                onClick={() => void doAction({ type: 'style', style: style as Style, itemId: item?.id }, 'いろが かわったよ。いつでも もどせるよ。')}><i className={`life-swatch ${style}`} /><b>{label}</b><small>{state.styles.includes(style) ? 'つかえる' : `ひかり ${LIFE_RULES.stylePrice}`}</small></button>)}</div></>}
            {tab === 'land' && (state.expanded ? <p>ひろがった しまに、すきな ばしょを つくろう。</p> : <><p>しずく {LIFE_RULES.expansionPrice} で、みぎか ひだりへ３列ひろがるよ。</p><div className="life-land">{([['west', 'ひだりへ'], ['east', 'みぎへ']] as const).map(([side, label]) => <button key={side} disabled={locked || state.drops < LIFE_RULES.expansionPrice} onClick={() => void doAction({ type: 'expand', side }, 'しまが ひろがったよ！')}>{label} ひろげる</button>)}</div></>)}
        </div>}
        </div>
        <div className="life-dock">
        {!menuOpen && (error || notice) && <p className="life-dock-notice" role="status">{error || notice}{error && <button onClick={() => setMenuOpen(true)}>ひらく</button>}</p>}
        <div className="life-caption"><div className="life-caption-title"><span className="life-caption-mark" aria-hidden="true"><Sprout size={16} /></span><div><p className="life-eyebrow">ぽこもこの にわ</p><h2>{places.length ? places.map(p => p.label).join(' と ') : 'なにを つくろう？'}</h2></div></div>
            <button className="island-text-button" onClick={onHome} disabled={locked}><Home size={17} />いえへ</button></div>
        <div className="life-residents" aria-label="みんなのようす">{state.residents.map(r => {
            const target = state.items.find(i => i.id === r.visit?.itemId);
            const reaction = residentReaction(state, r, state.now + elapsed);
            const activity = reaction?.label ?? activityLabel(state, r, state.now + elapsed);
            const favorite = residentFavoriteLabel(r);
            return <span key={r.id} data-life-resident={r.id} data-life-target={target?.kind ?? 'home'} data-life-activity={activityPhase(state, r, state.now + elapsed)} data-life-favorite={favorite}
                title={`${residentNames[r.id]}。${favorite}が すき。${activity}`}>
                <i className="life-resident-dot" aria-hidden="true" /><b>{residentNames[r.id]}</b><small>すき: {favorite}</small><em>{activity}</em>
            </span>;
        })}</div>
            <p className="life-goal">{goal === LIFE_RULES.dailyGoal ? 'きょうの いぶきが みちたよ' : `きょうの いぶき ${goal} / ${LIFE_RULES.dailyGoal} といたぶんは のこるよ`}</p>
            <div className="life-tabs" role="group" aria-label="しまの ていれ">{tabOptions.map(([id, name, Icon]) =>
                <button key={id} data-life-tab={id} aria-pressed={menuOpen && tab === id} disabled={locked} onClick={() => switchTab(id)}><Icon size={16} /><span>{name}</span></button>)}</div>
        </div>
        {import.meta.env.DEV && <details className="life-dev"><summary>試作</summary><p>独立した試作の島です。通常の学習記録・旧島の所有物は変更しません。家の中は既存画面です。時間送りはこの島だけに作用します。</p>
            {[6, 24].map(hours => <button key={hours} disabled={locked} onClick={() => void refresh({ id: crypto.randomUUID(), revision: record.revision, advanceHours: hours as 6 | 24 })}>試作を {hours}時間すすめる</button>)}
        </details>}
    </section>;
}
