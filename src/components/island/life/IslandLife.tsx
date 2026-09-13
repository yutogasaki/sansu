import { isFacility, occupiesCell } from '../../../domain/islandLife/footprint';
import type { RuleEligibility } from '../../../domain/islandLife/discovery';
import { useLiveDiscovery } from './useLiveDiscovery';
import { placementUndo } from '../../../domain/islandLife/placementUndo';
import { observationVisit } from '../../../domain/islandLife/observationVisit';
import { removalRefund } from '../../../domain/islandLife/purchases';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Sprout, Home, Move, Archive, Trash2, Check, X, Undo2 } from 'lucide-react';
import { CATALOG, LIFE_CANDIDATE, LIFE_RULES, learningDay, type Cell, type ItemKind, type LifeCommand, type ResidentId } from '../../../domain/islandLife/model';
import { cellKey, districts, isHouse, landCells } from '../../../domain/islandLife/space';
import { replayLife } from '../../../domain/islandLife/simulation';
import type { useIslandLife } from './useIslandLife';
import LifeWorld from './LifeWorld';
import LifeObservation from './LifeObservation';
import LifeMemories from './LifeMemories';
import LifeProductPreview from './LifeProductPreview';
import LifeResidentsSummary from './LifeResidentsSummary';
import LifeResidentPortrait from './LifeResidentPortrait';
import LifeAppearance from './LifeAppearance';
import LifeLand from './LifeLand';
import { LifeResources, LifeGrowthSummary, LifeResourceGuide } from './LifeResources';
import LifeCatalogPages from './LifeCatalogPages';
import { previewPlacement } from './placement';
import { rewardDelta } from './rewardCue';
import { growthSnapshot, growthTransitions, type GrowthTransition } from './growthCue';
import { lifeGrowthStatus, type LifeGrowthStatus } from './growthStatus';
import { observationSnapshot, observationTransitions, type LifeObservationCue } from './observationCue';
import './life.css';
import './life-feedback.css';
import './life-growth.css';
import './life-close.css';
import './life-belongings.css';
import './life-resources.css';
import './life-world-first.css';

const productStories = { flower: 'めを そだてて おはなに', bench: 'ひとやすみの ばしょ', swing: 'すわって ゆらゆら', lantern: 'あかりの そばに あつまるかな', sapling: '木かげに そだつ なえ', 'water-bowl': '水を のぞく うつわ', 'picnic-table': 'おやつと おしゃべりの ばしょ', pinwheel: 'かぜと くるくる', 'flower-arch': 'おはなの したを くぐろう', sandbox: 'すなで おやまや おしろを', 'garden-hut': 'どうぐを だして おていれ', library: 'ほんを ひらいて ひとやすみ' };
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
export default function IslandLife({ controls, onHome, disabled, islandName }: {
    controls: ReturnType<typeof useIslandLife>; onHome: () => void; disabled: boolean; islandName: string;
}) {
    const { record, error, busy, refresh } = controls;
    const liveDiscovery = useLiveDiscovery(record?.profileId);
    const [menuOpen, setMenuOpen] = useState(false);
    const [observed, setObserved] = useState<string>();
    const [observedResident, setObservedResident] = useState<ResidentId>();
    const [gathering, setGathering] = useState<{ ruleId: RuleEligibility['ruleId']; participantIds: string[] }>();
    const [memoriesOpen, setMemoriesOpen] = useState(false);
    const observationOrigin = useRef<string | undefined>(undefined);
    const [dockOpen, setDockOpen] = useState(false);
    const [page, setPage] = useState(0), [cellPage, setCellPage] = useState(0);
    const [gridOpen, setGridOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const buildTrigger = useRef<HTMLButtonElement>(null), informationTrigger = useRef<HTMLButtonElement>(null);
    const previousPanel = useRef<'menu' | 'information' | undefined>(undefined);
    const actionRunning = useRef(false), retryCompletion = useRef<(() => void) | undefined>(undefined);
    const lastObservedDrops = useRef<number | undefined>(undefined);
    const lastObservedLight = useRef<number | undefined>(undefined);
    const lastObservedGrowth = useRef<Record<string, number> | undefined>(undefined);
    const lastObservedObservation = useRef<Record<string, string> | undefined>(undefined);
    const state = useMemo(() => record ? { ...replayLife(record), ...(import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true' ? { facilityPresentation: 'carry-care-v1' as const, landscapeVersion: 'groves-water-v1' as const, relationVersion: 'water-bench-v1' as const } : {}), worldStyle: import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true' ? 'canopy-dots-c3-v1' as const : 'moon-garden-v1' as const } : undefined, [record]);
    useEffect(() => {
        if (!observed) { setGathering(undefined); observationOrigin.current = undefined; return; }
        const target = state?.items.find(i => i.id === observed && i.cell);
        const origin = target ? JSON.stringify([record?.profileId, target.id, target.cell]) : undefined;
        if (!origin || observationOrigin.current && observationOrigin.current !== origin) setObserved(undefined);
        else observationOrigin.current = origin;
    }, [observed, state, record?.profileId]);
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
    const [undo, setUndo] = useState<{ profileId: string; actionId: string }>();
    const undoCommand = record && undo?.profileId === record.profileId ? placementUndo(record, undo.actionId) : undefined;
    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), 7000);
        return () => window.clearTimeout(timer);
    }, [notice]);
    const item = state?.items.find(i => i.id === selected);
    const placement = useMemo(() => state && (kind || moving && item)
        ? previewPlacement(state, kind ?? item!, cell) : undefined, [state, kind, moving, item, cell]);
    const showWorld = () => { setMenuOpen(false); setDockOpen(false); setGridOpen(false); };
    useEffect(() => {
        if (!menuOpen && !dockOpen) {
            if (previousPanel.current && !observed && !memoriesOpen) (previousPanel.current === 'menu' ? buildTrigger : informationTrigger).current?.focus();
            previousPanel.current = undefined;
            return;
        }
        previousPanel.current = menuOpen ? 'menu' : 'information';
        (menuOpen ? menuRef : dockRef).current?.focus();
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setMenuOpen(false); setDockOpen(false); }
        };
        window.addEventListener('keydown', close);
        return () => window.removeEventListener('keydown', close);
    }, [menuOpen, dockOpen, observed, memoriesOpen]);
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
    const doAction = async (command: LifeCommand, message: string, undoOf?: string) => {
        if (locked || actionRunning.current) return;
        setNotice('');
        const id = crypto.randomUUID();
        const complete = () => {
            if (undoOf) setUndo(undefined);
            else if (['buy', 'move', 'store'].includes(command.type)) setUndo({ profileId: record.profileId, actionId: id });
            setNotice(message); setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false);
            if (command.type === 'buy') { setSelected(id); setTab('items'); }
            if (command.type === 'buy' || command.type === 'move') showWorld();
            if (command.type === 'remove') setSelected(undefined);
        };
        actionRunning.current = true; retryCompletion.current = complete;
        try { if (await refresh({ id, revision: record.revision, command, undoOf })) { complete(); retryCompletion.current = undefined; } }
        finally { actionRunning.current = false; }
    };
    const retryAction = async () => {
        if (locked || actionRunning.current) return;
        actionRunning.current = true;
        try { if (await controls.retry()) { retryCompletion.current?.(); retryCompletion.current = undefined; } }
        finally { actionRunning.current = false; }
    };
    const chooseCell = (next: Cell) => {
        if (locked || observed || memoriesOpen) return;
        if (kind || moving) { setCell(next); return; }
        const found = state.items.find(i => occupiesCell(i, next));
        if (found) { setSelected(found.id); setTab('items'); setDockOpen(false); setMenuOpen(true); setRemoving(false); }
        else if (isHouse(next)) onHome();
    };
    const resetPanelForTab = (next: typeof tab) => {
        setObserved(undefined); setMemoriesOpen(false);
        setEarnedDrops(undefined); setEarnedLight(undefined); setGrownItems([]); setObservationCues([]);
        setNotice(''); setPage(0); if (next !== 'style') setSelected(undefined); setTab(next);
        setKind(undefined); setCell(undefined); setMoving(false); setRemoving(false);
    };
    const switchTab = (next: typeof tab) => {
        const willOpen = next !== tab || !menuOpen;
        resetPanelForTab(next); setMenuOpen(willOpen); setDockOpen(false);
    };
    const openMenuTab = (next: typeof tab) => {
        resetPanelForTab(next); setMenuOpen(true); setDockOpen(false);
    };
    const tryObservation = (itemId: string) => {
        if (!locked && observationVisit(state, itemId).kind === 'ready') void refresh({ id: crypto.randomUUID(), revision: record.revision, command: { type: 'observe', itemId } });
    };
    const openMemories = () => { showWorld(); setObserved(undefined); setMemoriesOpen(true); };
    const openLifeControls = () => {
        setObserved(undefined); setMemoriesOpen(false);
        if (error) { setMenuOpen(true); setDockOpen(false); return; }
        setDockOpen(true);
    };
    const products = (Object.keys(CATALOG) as ItemKind[]).filter(kind => !['sapling', 'water-bowl', 'picnic-table', 'pinwheel', 'flower-arch', 'sandbox', 'garden-hut', 'library'].includes(kind)
        || import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true').filter(kind => !isFacility(kind) || !state.items.some(i => i.kind === kind));
    const pageCount = Math.max(1, Math.ceil((tab === 'build' ? products.length : state.items.length) / 2));
    const currentPage = Math.min(page, pageCount - 1);
    const cells = landCells(state), cellPages = Math.ceil(cells.length / 6);
    const pager = <div className="life-pager"><button aria-label="まえの ページ" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage + 1} / {pageCount}</span><button aria-label="つぎの ページ" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)}>→</button></div>;
    const goal = Math.min(LIFE_RULES.dailyGoal, state.days[learningDay(state.now)] ?? 0);
    const notificationTab = grownItems.length || observationCues.length ? 'items' : earnedDrops !== undefined ? 'build' : 'style';
    return <section className="island-life" data-life-candidate={LIFE_CANDIDATE} data-life-destination={state.target} data-life-revision={record.revision} data-life-drops={state.drops} data-life-light={state.light} data-life-items={state.items.length} data-life-districts={places.map(p => p.label).join(',')} data-life-panel-open={menuOpen || dockOpen || observed || memoriesOpen || Boolean(placement) ? 'true' : undefined}>
        <div className="life-hud" data-life-hud="life-world-first-v1">
        <LifeResources state={state} />
        {!menuOpen && !dockOpen && !placement && !observed && !memoriesOpen && (earnedDrops !== undefined || earnedLight !== undefined || grownItems.length > 0 || observationCues.length > 0) && <button className="life-earned" data-life-earned={earnedDrops} data-life-light-earned={earnedLight}
            data-life-growth-earned={grownItems.map(item => item.id).join(',') || undefined} data-life-observation-earned={observationCues.map(item => item.id).join(',') || undefined} aria-live="polite"
            onClick={() => switchTab(notificationTab)}>
            <span className="life-earned-message">{grownItems.length ? <>おはなが <strong>{grownItems[0].message}</strong></>
                : observationCues.length ? <strong>{observationCues[0].message}</strong>
                    : earnedDrops !== undefined ? <>学んだぶん <strong>+{earnedDrops} しずく</strong></>
                        : <>みんなが あそんだ <strong>+{earnedLight} ひかり</strong></>}</span>
            <span className="life-earned-action">{notificationTab === 'items' ? 'ようすを みる →' : notificationTab === 'style' ? 'いろを えらぶ →' : 'つくる →'}</span>
        </button>}
        </div>
        <div className="life-viewport">
        <LifeWorld profileId={record.profileId} presented={liveDiscovery.presented} state={state} selected={selected} cell={cell} placement={placement} onCell={chooseCell} controlsVisible={!menuOpen && !dockOpen && !observed && !memoriesOpen}>
            <button ref={buildTrigger} className="life-home-action life-build-action" type="button" disabled={locked} onClick={() => openMenuTab('build')}>
                <LifeProductPreview kind="flower" growth={LIFE_RULES.bloomHours} /><span>つくる</span>
            </button>
            <button ref={informationTrigger} className="life-home-action" type="button" aria-label="しまの ようす" aria-expanded={dockOpen} aria-controls="life-dock-dialog" onClick={openLifeControls}>
                <LifeResidentPortrait resident="pokomoko" style={state.heroStyle} /><span>ようす</span>
            </button>
        </LifeWorld>
        {observed && !placement && !menuOpen && !dockOpen && (() => {
            const target = state.items.find(i => i.id === observed && i.cell && (gathering || ['flower', 'sapling', 'water-bowl', 'bench', 'picnic-table', 'library', 'garden-hut'].includes(i.kind)));
            return target ? <LifeObservation key={`${record.profileId}:${target.id}:${target.cell!.x}:${target.cell!.z}:${target.style}`}
                record={record} state={state} item={target} initialResidentId={observedResident} gathering={gathering} close={() => setObserved(undefined)} memories={openMemories} tryVisit={() => tryObservation(target.id)} selectionFailure={error}
                tryRelation={(targetId, residentId) => locked ? Promise.resolve(false) : refresh({ id: crypto.randomUUID(), revision: record.revision, command: { type: 'observe-relation', itemId: target.id, residentId, ...(targetId ? { targetId } : {}) } })} /> : null;
        })()}
        {memoriesOpen && <LifeMemories key={record.profileId} profileId={record.profileId} state={state} close={() => setMemoriesOpen(false)}
            observe={(id, residentId) => { setGathering(undefined); setMemoriesOpen(false); setObservedResident(residentId); setObserved(id); if (!residentId) tryObservation(id); }}
            observeGathering={group => { setGathering(group); setMemoriesOpen(false); setObserved(group.participantIds[0]); }} />}
        {placement && <div className="life-placement life-controls" data-life-placement-valid={placement.valid} data-life-placement-cell={cell && cellKey(cell)}>
            <h3>{CATALOG[placement.item.kind].label}を {moving ? 'うごかす' : 'おく'}</h3>
            <p role="status">{cell && (placement.valid ? <Check size={18} /> : <X size={18} />)}{placement.reason}</p>
            <div className="life-placement-actions"><button className="island-primary" disabled={locked || !placement.valid} onClick={() => cell && void doAction(kind ? { type: 'buy', kind, cell } : { type: 'move', itemId: selected!, cell }, 'ここに おいたよ。どんな くらしに なるかな？')}>ここに おく</button>
                <button disabled={locked} onClick={() => { setKind(undefined); setMoving(false); setCell(undefined); }}>やめる</button></div>
            <button className="life-grid-toggle" aria-expanded={gridOpen} onClick={() => setGridOpen(!gridOpen)}>マスから えらぶ</button>
            {gridOpen && <div className="life-cell-picker"><div className="life-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>{cells.slice(cellPage * 6, cellPage * 6 + 6).map(p => <button key={cellKey(p)} aria-label={`ばしょ ${p.x + 1} ${p.z + 1}`} data-life-cell={cellKey(p)} aria-pressed={cell && cellKey(cell) === cellKey(p)} disabled={locked || !placement.allowed.includes(cellKey(p))} onClick={() => { setCell(p); setGridOpen(false); }}>{p.x + 1},{p.z + 1}</button>)}</div><div className="life-pager"><button aria-label="まえの マス" disabled={cellPage === 0} onClick={() => setCellPage(cellPage - 1)}>←</button><span>{cellPage + 1} / {cellPages}</span><button aria-label="つぎの マス" disabled={cellPage + 1 >= cellPages} onClick={() => setCellPage(cellPage + 1)}>→</button></div></div>}

        </div>}
        {menuOpen && !placement && <div ref={menuRef} tabIndex={-1} className="life-controls life-menu" role="dialog" aria-modal="false" aria-label="しまの メニュー">
            <div className="life-menu-heading"><div className="life-menu-title">{(() => { const Icon = tabOptions.find(([id]) => id === tab)?.[2] ?? Sprout; return <Icon size={17} aria-hidden="true" />; })()}<b>{{ build: 'つくる', items: 'もちもの', style: 'いろ', land: 'ひろげる' }[tab]}</b></div>{tab === 'items' && !item && pageCount > 1 && pager}<button aria-label="メニューを とじる" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
            <div className="life-menu-body">
            {undoCommand && <button type="button" data-life-undo disabled={locked || Boolean(error)} onClick={() => void doAction(undoCommand, undoCommand.type === 'store' ? 'しまってある ところに もどしたよ。' : 'まえの ばしょに もどしたよ。', undo!.actionId)}><Undo2 size={16} />もどす</button>}
            <div className="life-menu-tabs" role="group" aria-label="しまの ていれ">{tabOptions.map(([id, name, Icon]) =>
                <button key={id} type="button" aria-pressed={tab === id} onClick={() => openMenuTab(id)}><Icon size={15} /><span>{name}</span></button>)}</div>
            {error && <div className="life-error" role="alert"><p>{error}</p><button onClick={() => void retryAction()} disabled={locked}>もういちど</button><button onClick={() => { retryCompletion.current = undefined; controls.clearError(); }} disabled={locked}>よみなおす</button></div>}
            {notice && !error && <p role="status" className="life-notice">{notice}</p>}
            {tab === 'build' && <>
                {!products.some(k => state.drops >= CATALOG[k].price) && <p className="life-menu-hint" data-life-build-hint role="status">まなぶと しずくが ふえるよ。</p>}
                <LifeCatalogPages>{Array.from({ length: Math.ceil(products.length / 2) }, (_, productPage) => <div className="life-catalog" key={productPage}>{products.slice(productPage * 2, productPage * 2 + 2).map(k => { const missing = CATALOG[k].price - state.drops; return <button key={k} data-life-buy={k} data-life-kind={k} aria-pressed={kind === k}
                    disabled={locked || missing > 0} onClick={() => { setKind(k); setCell(undefined); setSelected(undefined); setNotice(''); showWorld(); }}>
                    <LifeProductPreview kind={k} /><b>{CATALOG[k].label}</b><small className="life-product-story">{productStories[k]}</small><span>{missing > 0 ? `あと ${missing} しずく` : `しずく ${CATALOG[k].price}`}</span></button>; })}</div>)}</LifeCatalogPages>
            </>}
            {tab === 'items' && <>
                <div className="life-items">{!item && state.items.slice(currentPage * 2, currentPage * 2 + 2).map((i, index) => { const growth = lifeGrowthStatus(i, state); return <button key={i.id} data-life-item={i.id} data-life-growth-stage={growth.stage}
                    data-life-growth-next-hours={growth.remainingHours} aria-pressed={selected === i.id} onClick={() => { setSelected(i.id); setMoving(false); setRemoving(false); setCell(undefined); }} disabled={locked}>
                    <LifeProductPreview kind={i.kind} growth={i.growth} style={i.style} /><span className="life-item-name"><b>{CATALOG[i.kind].label}</b><small>{currentPage * 2 + index + 1}</small></span><span className="life-item-growth">{!i.cell ? <small>しまってある</small> : <>{(i.kind === 'flower' || i.kind === 'sapling') && <GrowthDots status={growth} />}<small>{growth.label}</small>{growth.nextLabel && <small className="life-growth-next">あと 約{growth.remainingHours}じかんで {growth.nextLabel}</small>}</>}</span></button>; })}</div>
                {!state.items.length && <div className="life-inventory-empty"><Archive size={30} aria-hidden="true" /><b>なにを おこうかな？</b><p>つくった ものが ここに ならぶよ。</p><button className="island-primary" onClick={() => openMenuTab('build')}>つくるものを えらぶ</button></div>}
                {item && <div className="life-item-actions"><h3><button aria-label="もちものの 一覧へ" onClick={() => { setSelected(undefined); setRemoving(false); }}>←</button> {CATALOG[item.kind].label}</h3>
                    <LifeProductPreview kind={item.kind} growth={item.growth} style={item.style} />
                    {(() => { const growth = lifeGrowthStatus(item, state); return <div className="life-item-growth-detail" data-life-growth-stage={growth.stage}><div>{(item.kind === 'flower' || item.kind === 'sapling') && <GrowthDots status={growth} />}<strong>{item.cell ? growth.label : 'しまってある'}</strong></div>
                        <small>{!['flower', 'sapling'].includes(item.kind) ? (item.cell ? 'しまに おいてあるよ' : 'また しまに おけるよ') : !item.cell ? 'おくと また そだつよ' : growth.nextLabel ? `あと 約${growth.remainingHours}じかんで ${growth.nextLabel}` : 'いちばん おおきく そだったよ'}</small>{item.cell && growth.nextLabel && <small>追加で まなばない ときの めやすだよ。</small>}</div>; })()}
                    {['flower', 'sapling', 'water-bowl', 'bench', 'picnic-table', 'library', 'garden-hut'].includes(item.kind) && item.cell && <button hidden={removing} disabled={locked} onClick={() => { showWorld(); setObservedResident(undefined); setObserved(item.id); if (item.kind === 'bench' || item.kind === 'picnic-table' || isFacility(item.kind)) tryObservation(item.id); }}>みてみる</button>}
                    <button hidden={removing} disabled={locked || !item.cell || (item.kind === 'lantern' || item.kind === 'pinwheel')} onClick={() => void doAction({ type: 'visit', itemId: item.id }, 'ぽこもこの いきさきを きめたよ。だれか くるかな？')}>ぽこもこを よぶ</button>
                    <button hidden={removing} disabled={locked} onClick={() => { setMoving(true); setCell(undefined); setRemoving(false); setNotice(''); showWorld(); }}><Move size={16} />{item.cell ? 'うごかす' : 'おく'}</button>
                    <button hidden={removing} disabled={locked || !item.cell} onClick={() => void doAction({ type: 'store', itemId: item.id }, 'そだったまま しまったよ。')}><Archive size={16} />しまう</button>
                    {item.kind !== 'lantern' && <button hidden={removing} disabled={locked} onClick={() => openMenuTab('style')}><Sparkles size={16} />いろを かえる</button>}
                    <button className="life-remove-action" hidden={removing} disabled={locked} onClick={() => setRemoving(true)}><Trash2 size={16} />とりのぞく</button>
                    {removing && <div className="life-confirm"><p>とりのぞくと、しずく {removalRefund(item)} が もどるよ。この ものの そだちは もどせないよ。</p>
                        <button disabled={locked} onClick={() => void doAction({ type: 'remove', itemId: item.id }, 'しずくが もどったよ。')}>とりのぞくと きめる</button><button disabled={locked} onClick={() => setRemoving(false)}>やめる</button></div>}
                </div>}
            </>}
            {tab === 'style' && <LifeAppearance state={state} item={item} locked={locked} onHero={() => setSelected(undefined)} onAction={doAction} />}
            {tab === 'land' && <LifeLand state={state} locked={locked} onAction={doAction} />}
            </div>
        </div>}
        </div>
        {dockOpen && !menuOpen && !placement && <div ref={dockRef} tabIndex={-1} id="life-dock-dialog" className="life-dock" role="dialog" aria-modal="false" aria-labelledby="life-dock-title">
        {(error || notice) && <p className="life-dock-notice" role="status">{error || notice}{error && <button onClick={() => { setMenuOpen(true); setDockOpen(false); }}>ひらく</button>}</p>}
        <div className="life-caption"><div className="life-caption-title"><span className="life-caption-mark" aria-hidden="true"><Sprout size={16} /></span><div><p className="life-eyebrow">ぽこもこの にわ</p><h2 id="life-dock-title">{places.length ? places.map(p => p.label).join(' と ') : 'みんなの ようす'}</h2></div></div>
            <div className="life-caption-actions"><button className="island-text-button" onClick={onHome} disabled={locked}><Home size={17} />いえへ</button><button className="life-dock-close" type="button" aria-label="しまの ようすを とじる" onClick={() => setDockOpen(false)}><X size={17} /></button></div></div>
        <div className="life-information-body">
            <LifeResidentsSummary state={state} now={state.now + elapsed} />
            <button type="button" className="life-memory-entry" onClick={openMemories}>しまの おもいで</button>
            <details className="life-island-notes">
                <summary>そだちと しずく・ひかり<span aria-hidden="true">＋</span></summary>
                <p className="life-island-name">{islandName}</p>
                <LifeGrowthSummary state={state} goal={goal} />
                <LifeResourceGuide />
            </details>
        </div>

        </div>
        }
        {!dockOpen && !menuOpen && !placement && <div className="life-dock-closed">
            {undoCommand && !observed && !memoriesOpen && <button type="button" className="island-secondary" data-life-undo disabled={locked || Boolean(error)} onClick={() => void doAction(undoCommand, undoCommand.type === 'store' ? 'しまってある ところに もどしたよ。' : 'まえの ばしょに もどしたよ。', undo!.actionId)}><Undo2 size={16} />もどす</button>}
            {liveDiscovery.error && !observed && !memoriesOpen && <p className="life-dock-closed-notice" role="alert">{liveDiscovery.error}<button type="button" onClick={() => void liveDiscovery.retry()}>もういちど</button></p>}
            {(error || notice) && <p className="life-dock-closed-notice" role="status">{error || notice}{error && <button type="button" onClick={() => openMenuTab(tab)}>ひらく</button>}</p>}
        </div>}
        {import.meta.env.DEV && <details className="life-dev"><summary>試作</summary><p>独立した試作の島です。通常の学習記録・旧島の所有物は変更しません。家の中は既存画面です。時間送りはこの島だけに作用します。</p>
            {[6, 24].map(hours => <button key={hours} disabled={locked} onClick={() => void refresh({ id: crypto.randomUUID(), revision: record.revision, advanceHours: hours as 6 | 24 })}>試作を {hours}時間すすめる</button>)}
        </details>}
    </section>;
}
