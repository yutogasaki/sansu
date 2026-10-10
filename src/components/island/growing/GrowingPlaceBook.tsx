import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { GrowingState } from '../../../domain/growingIsland';
import { PLACE_CATALOG } from '../../../domain/growingIsland/placeCatalog';
import { placeStatuses } from '../../../domain/growingIsland/placeGoals';
import { derivePlaceRelations } from '../../../domain/growingIsland/placeRelations';
import { derivePlaces } from '../../../domain/growingIsland/places';
import type { PlaceGoalId, PlaceStage } from '../../../domain/growingIsland/placeTypes';
import './growingPlaceBook.css';

const STAGES: PlaceStage[] = ['seeded', 'connected', 'grown', 'lived'];
const STAGE_NAMES: Record<PlaceStage, string> = { seeded: 'おく', connected: 'つながる', grown: 'そだつ', lived: 'あそぶ' };
const ROLE_NAMES: Record<string, string> = { tree: '木', seat: 'ベンチ', home: 'いえ', water: '水ばち', channel: 'みずみち', flower: 'はな', play: 'あそびば' };
const GROWTH_NOTES: Partial<Record<PlaceGoalId, string>> = {
    P01: '木が そだつあいだも、ベンチで あそべるよ',
    P02: '木のいえと 大木を そだてよう。いまの木や いえは そのまま のこるよ',
    P03: 'みずみちで つなごう。さかの上からは 段の泉に なるよ',
    P04: '海のそばで、いえの入口と あそびばの まわりを あけよう',
    P05: 'すきな色の はなで いいよ。めずらしい色は なくても そだつよ',
    P06: '森・泉・花・集会所から、すきな3しゅるいを つなごう',
};

export interface GrowingPlaceBookProps {
    state: GrowingState;
    busy: boolean;
    initialGoal?: PlaceGoalId;
    onClose: () => void;
    onChoose: (id?: PlaceGoalId) => void;
    onTarget: (id: string) => void;
}

/** A freely chosen destination; the live island continues above this small book. */
export function GrowingPlaceBook({ state, busy, initialGoal, onClose, onChoose, onTarget }: GrowingPlaceBookProps) {
    const statuses = placeStatuses(state);
    const selected = state.placeProgress?.selected;
    const [detail, setDetail] = useState<PlaceGoalId>(initialGoal ?? selected ?? statuses.find(status => status.place)?.id ?? 'P01');
    const [page, setPage] = useState<'now' | 'memory'>('now');
    const [variant, setVariant] = useState<string>();
    const uid = useId(), heading = useRef<HTMLHeadingElement>(null), close = useRef(onClose);
    useEffect(() => { close.current = onClose; }, [onClose]);
    useEffect(() => {
        const previous = document.activeElement;
        heading.current?.focus({ preventScroll: true });
        const escape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); close.current(); }
        };
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('keydown', escape);
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);
    const goal = PLACE_CATALOG.goals.find(goal => goal.id === detail)!;
    const status = statuses.find(status => status.id === detail)!;
    const evidence = state.placeProgress?.milestones[detail];
    const layout = goal.variants.find(layout => layout.id === variant) ?? goal.variants.find(layout => layout.id === status.place?.variant) ?? goal.variants[0];
    const relations = derivePlaceRelations(state, derivePlaces(state));
    const combos = PLACE_CATALOG.combinations.filter(combo => detail === 'P06' || combo.families.includes(goal.family));
    const currentReady = status.stage === 'grown' || status.stage === 'lived';
    const target = evidence?.anchorId;
    const targetItem = target ? [...state.plots, ...state.landmarks].find(item => item.id === target) : undefined;
    const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'now' : event.key === 'End' ? 'memory' : page === 'now' ? 'memory' : 'now';
        setPage(next);
        event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-place-tab="${next}"]`)?.focus();
    };
    const open = (id: PlaceGoalId) => { setDetail(id); setVariant(undefined); };
    return <section className="growing-place-book" aria-labelledby={`${uid}-heading`} data-visual-candidate="place-goals-native05-v1">
        <header className="growing-place-header"><div><span>すきな かたちへ</span><h2 id={`${uid}-heading`} ref={heading} tabIndex={-1}>そだつ場所</h2></div>
            <button onClick={onClose}>とじる <span aria-hidden="true">×</span></button></header>
        <div className="growing-place-tabs" role="tablist" aria-label="場所のページ">
            {(['now', 'memory'] as const).map(tab => <button key={tab} id={`${uid}-${tab}-tab`} role="tab" data-place-tab={tab}
                aria-selected={page === tab} aria-controls={`${uid}-${tab}-page`} tabIndex={page === tab ? 0 : -1}
                onKeyDown={tabKey} onClick={() => setPage(tab)}>{tab === 'now' ? 'いまの しま' : 'そだった おもいで'}</button>)}
        </div>
        <div className="growing-place-page" id={`${uid}-${page}-page`} role="tabpanel" aria-labelledby={`${uid}-${page}-tab`}>
            <article className="growing-place-detail" data-place-detail={detail}>
                <figure><GrowingPlaceArt id={detail} /><figcaption>そだった姿の めやす</figcaption></figure>
                <div><h3>{goal.name}</h3>
                    {page === 'now' ? <>
                        <ol className="growing-place-stages" aria-label="いまの育ちかた">{STAGES.map((stage, i) => <li key={stage}
                            data-reached={STAGES.indexOf(status.stage) >= i || undefined} aria-current={status.stage === stage ? 'step' : undefined}>{STAGE_NAMES[stage]}</li>)}</ol>
                        <p className="growing-place-live" role="status">{status.hint}</p>
                        {status.missing.some(line => line !== status.hint) && <p className="growing-place-note">{status.missing.filter(line => line !== status.hint).slice(0, 2).join('・')}</p>}
                        <p className="growing-place-note">{GROWTH_NOTES[detail]}</p>
                        <div className="growing-place-actions">
                            {selected === detail ? <button disabled={busy} onClick={() => onChoose()}>目標を はずす</button>
                                : <button className="growing-place-primary" disabled={busy} onClick={() => onChoose(detail)}>ここを そだてたい</button>}
                            {status.place && <button disabled={busy} onClick={() => onTarget(status.place!.anchorId)}>この場所へ</button>}
                        </div>
                        <p className="growing-place-note">{selected === detail ? 'えらんでいる場所。いつでも かえられるよ' : 'えらばなくても そだつよ'}</p>
                    </> : evidence ? <>
                        <p>この場所が そだった おもいでだよ</p>
                        <p className="growing-place-note">{currentReady && status.place?.revision === evidence.revision ? 'いまの しまにも つながっているよ' : '置きかえても おもいでは のこるよ'}</p>
                        {targetItem && <button disabled={busy} onClick={() => onTarget(targetItem.id)}>{targetItem.cell ? 'いまの場所へ' : 'もちものへ'}</button>}
                        {!targetItem && <p className="growing-place-note">ほんの中に おもいでが のこっているよ</p>}
                    </> : <><p>そだった場所が、ここに のこるよ</p><button onClick={() => setPage('now')}>いまの しまを みる</button></>}
                </div>
            </article>
            {page === 'now' && layout && <details className="growing-place-layouts">
                <summary>おなじ材料で かたちが かわる</summary>
                <p className="growing-place-inputs">{goal.inputs.map(input => `${ROLE_NAMES[input.role] ?? input.role} ${input.count}`).join('・')}</p>
                <div className="growing-place-layout-choices" aria-label="置きかたの例">{goal.variants.map(example => <button key={example.id}
                    aria-pressed={layout.id === example.id} onClick={() => setVariant(example.id)}>{example.label}</button>)}</div>
                <GrowingPlaceLayout items={layout.demo} />
                <p>{layout.result}</p><small>置きかたの例。いまの しまの絵では ないよ</small>
            </details>}
            <div className="growing-place-cards" aria-label={page === 'now' ? 'すきな場所を えらぶ' : 'ほかの おもいで'}>
                {statuses.filter(item => page === 'now' || state.placeProgress?.milestones[item.id]).map(item => <button key={item.id}
                    data-place-goal={item.id} aria-pressed={detail === item.id} onClick={() => open(item.id)}>
                    <GrowingPlaceArt id={item.id} /><strong>{item.name}</strong>
                    <span>{page === 'memory' ? 'そだった おもいで' : selected === item.id ? 'えらんでいる' : item.stage === 'grown' || item.stage === 'lived' ? 'いま つながる' : item.place ? STAGE_NAMES[item.stage] : 'すきな場所から'}</span>
                </button>)}
            </div>
            {page === 'now' && <details className="growing-place-combos"><summary>となりへ つなげてみよう</summary>
                {combos.map(combo => <article key={combo.id} data-place-combo={combo.id}><strong>{combo.name}</strong>
                    <span>{relations.some(relation => relation.id === combo.id) ? 'いま つながっているよ' : combo.visible}</span><p>{combo.play}</p></article>)}
                <p className="growing-place-note">道と入口を あけて、となりでも あそべる場所へ。順番は じゆうだよ</p>
            </details>}
        </div>
    </section>;
}

/** Hand-drawn aspiration diagrams follow native-05; live state is described separately. */
export function GrowingPlaceArt({ id }: { id: PlaceGoalId }) {
    const grove = <g><path d="M44 100Q70 112 133 100M79 81L65 114M113 80L130 110" fill="none" stroke="#b87b43" strokeWidth="8" strokeLinecap="round" />
        <path d="M79 98Q86 62 83 51M110 98Q104 64 110 46" fill="none" stroke="#ac7043" strokeWidth="12" strokeLinecap="round" />
        <ellipse cx="67" cy="52" rx="32" ry="17" fill="#688daa" transform="rotate(-13 67 52)" /><ellipse cx="110" cy="41" rx="37" ry="22" fill="#786fbe" transform="rotate(15 110 41)" />
        <ellipse cx="125" cy="67" rx="29" ry="17" fill="#537f8b" /><path d="M70 99h47m-42 8v-8m37 8v-8" stroke="#945a43" strokeWidth="6" strokeLinecap="round" /></g>;
    const treeHome = <g><path d="M50 114Q75 99 81 77L83 38Q102 22 119 42L122 79Q132 103 152 114" fill="#bf834a" stroke="#9f633e" strokeWidth="3" />
        <path d="M89 106v-31q15-21 28 0v31" fill="#725445" /><path d="M47 70q52-38 106-4l-4 12q-56-24-99 6z" fill="#c99558" stroke="#936844" strokeWidth="2" />
        <path d="M60 78v22m79-29v35M56 74Q102 45 150 70" fill="none" stroke="#dba267" strokeWidth="4" />
        <ellipse cx="67" cy="32" rx="42" ry="19" fill="#7165b4" transform="rotate(-15 67 32)" /><ellipse cx="121" cy="30" rx="47" ry="23" fill="#668999" transform="rotate(13 121 30)" />
        <path d="M70 114q-12-8 2-14q17-8 0-14" fill="none" stroke="#ddb279" strokeWidth="5" strokeLinecap="round" />
        <path d="M144 106v-19l-13-10-13 10v19z" fill="#edcf8d" /><path d="M116 87l15-13 16 13" fill="none" stroke="#9b6356" strokeWidth="6" strokeLinecap="round" /></g>;
    const spring = <g><path d="M39 74l-9-35 17-16 17 29 10-16 15 36z" fill="#8e83bd" /><path d="M44 31l3 32 15-11" fill="none" stroke="#c4b9dc" strokeWidth="3" />
        <ellipse cx="67" cy="77" rx="37" ry="17" fill="#718aaf" /><ellipse cx="66" cy="73" rx="32" ry="12" fill="#246bae" />
        <path d="M88 80q12 24 35 21v9q-34 3-41-26z" fill="#73beda" /><ellipse cx="129" cy="108" rx="36" ry="15" fill="#6685a0" /><ellipse cx="129" cy="104" rx="29" ry="10" fill="#347cac" />
        <path d="M78 74q-15-5-27 0m62 29q13-5 27 0" fill="none" stroke="#9bd0e4" strokeWidth="2" /><path d="M106 87q10-15 28-8l3 7-28 8z" fill="#ba9562" /></g>;
    const shell = <g><path d="M26 99Q41 39 79 38q53-1 93 55Q111 70 26 99z" fill="#829ecb" opacity=".9" stroke="#6d7cba" strokeWidth="3" />
        <path d="M40 93Q57 50 80 39m-18 50Q79 55 86 40m5 44Q104 57 95 42m26 40Q126 62 108 47m40 40Q152 78 128 61" fill="none" stroke="#c3b5df" strokeWidth="3" />
        <path d="M40 91v25m112-29v27" stroke="#a18685" strokeWidth="5" /><path d="M55 112v-21l17-10 17 10v21zM119 115V94l15-10 15 10v21z" fill="#f0d3a4" />
        <path d="M52 92l20-15 20 15m24 3l18-14 18 14" stroke="#b97075" strokeWidth="6" fill="none" /><path d="M91 117q12-33 26 0" stroke="#cc93b7" strokeWidth="6" fill="none" /></g>;
    const flowers = <g><path d="M44 116Q59 63 81 49m62 67Q129 69 111 43M86 115V56" stroke="#688890" strokeWidth="6" fill="none" />
        {[{ x: 71, y: 52, color: '#a77dc2' }, { x: 106, y: 42, color: '#dd9cae' }, { x: 139, y: 64, color: '#778bc4' }].map(({ x, y, color }) => <g key={x} transform={`translate(${x} ${y})`}>
            {[0, 60, 120].map(angle => <ellipse key={angle} rx="34" ry="14" fill={color} transform={`rotate(${angle})`} />)}<ellipse rx="10" ry="6" fill="#efc783" /></g>)}
        <path d="M75 107h46m-41 8v-8m36 8v-8" stroke="#9b6654" strokeWidth="6" strokeLinecap="round" /></g>;
    return <svg className="growing-place-art" viewBox="0 0 190 135" aria-hidden="true" focusable="false"><ellipse cx="95" cy="108" rx="83" ry="21" fill="#edf0f5" />
        {id === 'P01' ? grove : id === 'P02' ? treeHome : id === 'P03' ? spring : id === 'P04' ? shell : id === 'P05' ? flowers : <>
            <g transform="translate(2 41) scale(.52)">{treeHome}</g><g transform="translate(87 7) scale(.52)">{spring}</g>
            <g transform="translate(43 73) scale(.43)">{flowers}</g><g transform="translate(95 51) scale(.47)">{shell}</g>
            <path d="M54 105q17-20 49-23q24-2 42 13" fill="none" stroke="#c4b59c" strokeWidth="4" strokeDasharray="7 5" />
        </>}
    </svg>;
}

export function GrowingPlaceLayout({ items }: { items: { role: string; x: number; z: number }[] }) {
    const maxX = Math.max(5, ...items.map(item => item.x)), maxZ = Math.max(4, ...items.map(item => item.z));
    const cell = 28, padding = 18;
    return <svg className="growing-place-layout" viewBox={`0 0 ${(maxX + 1) * cell + padding * 2} ${(maxZ + 1) * cell + padding * 2}`} role="img" aria-label="材料の置きかたの例">
        {Array.from({ length: (maxX + 1) * (maxZ + 1) }, (_, index) => <rect key={index} x={padding + index % (maxX + 1) * cell} y={padding + Math.floor(index / (maxX + 1)) * cell} width={cell - 2} height={cell - 2} rx="4" fill="#edf0f5" />)}
        {items.map(({ role, x, z }, index) => <g key={index} transform={`translate(${padding + x * cell + 13} ${padding + z * cell + 13})`}><title>{ROLE_NAMES[role] ?? role}</title>
            {role === 'tree' ? <><path d="M0 2v9" stroke="#a77249" strokeWidth="4" /><ellipse cy="-3" rx="10" ry="8" fill="#7d82b8" /></>
                : role === 'flower' ? <><circle r="10" fill="#d99caf" /><circle r="4" fill="#edc784" /></>
                    : role === 'home' ? <><rect x="-9" y="-4" width="18" height="14" rx="2" fill="#e5c896" /><path d="M-12-4L0-12 12-4" fill="#a97c88" /></>
                        : role === 'seat' ? <><path d="M-10 0h20M-8 4v6m16-6v6" stroke="#ab7855" strokeWidth="5" /></>
                            : role === 'channel' ? <rect x="-13" y="-3" width="26" height="6" rx="3" fill="#65a9ca" />
                                : role === 'water' ? <ellipse rx="11" ry="8" fill="#5b91c2" />
                                    : <path d="M-10 8Q0-18 10 8" fill="none" stroke="#9a91c2" strokeWidth="5" />}
        </g>)}
    </svg>;
}
