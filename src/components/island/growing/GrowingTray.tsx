import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { LANDMARK_PRICE, SEED_PRICE } from '../../../domain/growingIsland';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland';
import { islandLevel, keepsakeKind, PLANTED_COLORS, type FlowerColor } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';
import { HOME_STAGE, KEEPSAKE_NAME, LANDMARK_LABEL, SEED_LABEL, SEED_PLACE_NAME } from './growingCopy';

export type Pick = { mode: 'seed'; kind: SeedKind } | { mode: 'landmark'; kind: LandmarkKind; color?: FlowerColor }
    | { mode: 'unstore'; id: string; kind: SeedKind | LandmarkKind; seed: boolean; keepsake?: string };

const SEEDS: SeedKind[] = ['home', 'farm', 'play', 'wild', 'market', 'festival', 'wonder'];
const LANDMARKS: LandmarkKind[] = ['flower', 'bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table', 'planter', 'swing', 'lantern', 'fence', 'lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'bakery', 'postbox'];
const GROUPS: { name: string; seeds: SeedKind[]; landmarks: LandmarkKind[] }[] = [
    { name: 'おうち', seeds: ['home'], landmarks: [] },
    { name: 'はたけ・おみせ', seeds: ['farm', 'market'], landmarks: ['bakery'] },
    { name: 'あそぶ・やすむ', seeds: ['play', 'festival'], landmarks: ['bench', 'picnic-table', 'swing', 'bandstand', 'slide', 'trampoline'] },
    { name: '花・木・水', seeds: ['wild'], landmarks: ['flower', 'sapling', 'water-bowl', 'water-channel', 'planter', 'fountain'] },
    { name: 'あかり・さく・ポスト', seeds: [], landmarks: ['lantern', 'fence', 'lighthouse', 'postbox'] },
    { name: 'ふしぎ', seeds: ['wonder'], landmarks: [] },
];

/** The catalog describes the result; seed/landmark remain placement commands only. */
export function GrowingTray({ state, onPick, onClose, initialTab = 'seeds' }: { state: GrowingState; onPick: (pick: Pick) => void; onClose: () => void; initialTab?: 'seeds' | 'landmarks' | 'stored' }) {
    const tutorial = state.tutorial === 'first-home';
    const [tab, setTab] = useState<'new' | 'stored'>(!tutorial && initialTab === 'stored' ? 'stored' : 'new');
    const [category, setCategory] = useState('すべて');
    const id = useId();
    const tabs = useRef<HTMLDivElement>(null);
    useEffect(() => { tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true }); }, []);
    const seeds = SEEDS.filter(kind => (kind === 'wonder' ? (state.wonderSeeds ?? 0) > 0 : state.unlocked.includes(`seed:${kind}`)) && (!tutorial || kind === 'home'));
    const landmarks = tutorial ? [] : LANDMARKS.filter(kind => state.unlocked.includes(`landmark:${kind}`));
    const groups = GROUPS.filter(group => group.seeds.some(kind => seeds.includes(kind)) || group.landmarks.some(kind => landmarks.includes(kind)));
    const stored = [
        ...state.keepsakes.filter(k => !k.cell).map(k => ({ id: k.id, kind: 'flower' as SeedKind | LandmarkKind, seed: false, keepsake: k.unitId,
            label: { name: KEEPSAKE_NAME[keepsakeKind(k.unitId)], icon: '🏅' } })),
        ...state.landmarks.filter(l => !l.cell).map(l => ({ id: l.id, kind: l.kind as SeedKind | LandmarkKind, seed: false, label: LANDMARK_LABEL[l.kind] })),
        ...state.plots.filter(p => !p.cell).map(p => ({ id: p.id, kind: p.kind as SeedKind | LandmarkKind, seed: true,
            label: { name: p.kind === 'home' ? HOME_STAGE[p.stage] : SEED_PLACE_NAME[p.kind], icon: SEED_LABEL[p.kind].icon } })),
    ];
    const price = (value: number) => <span className="growing-price" aria-label={`しずく ${value}`}>💧{value}</span>;
    const switchTab = (event: KeyboardEvent<HTMLDivElement>) => {
        if (tutorial || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'new' : event.key === 'End' ? 'stored' : tab === 'new' ? 'stored' : 'new';
        setTab(next);
        tabs.current?.querySelector<HTMLButtonElement>(`[id="${id}-${next}-tab"]`)?.focus();
    };
    return <section className="growing-tray growing-catalog" aria-label="しまに おく" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
        <header>
            <div><h2>しまに おく</h2><p>すきな ものを えらんでね</p></div>
            <button className="growing-close" onClick={onClose} aria-label="とじる">×</button>
        </header>
        <div ref={tabs} role="tablist" aria-label="置くもの" className="growing-tabs" onKeyDown={switchTab}>
            <button id={`${id}-new-tab`} role="tab" aria-controls={`${id}-new`} tabIndex={tab === 'new' ? 0 : -1} aria-selected={tab === 'new'} onClick={() => setTab('new')}>あたらしく おく</button>
            {!tutorial && <button id={`${id}-stored-tab`} role="tab" aria-controls={`${id}-stored`} tabIndex={tab === 'stored' ? 0 : -1} aria-selected={tab === 'stored'} onClick={() => setTab('stored')}>もちもの{stored.length > 0 ? ` (${stored.length})` : ''}</button>}
        </div>
        <div role="tabpanel" id={`${id}-${tab}`} aria-labelledby={`${id}-${tab}-tab`}>
            {tab === 'new' ? <>
                {!tutorial && <div className="growing-catalog-filters" aria-label="品物の しゅるい">
                    {['すべて', ...groups.map(group => group.name)].map(name => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}
                </div>}
                {state.town.bank > 0 && <p className="growing-flower-note">まなびの じかんが たまっているよ。おうちや はたけが そだつよ</p>}
                {groups.filter(group => category === 'すべて' || category === group.name).map(group => <section className="growing-catalog-group" key={group.name} aria-label={group.name}>
                    <h3>{group.name}</h3>
                    <div className="growing-grid growing-grid-seeds">
                        {group.seeds.filter(kind => seeds.includes(kind)).map(kind => {
                            const cost = tutorial ? 0 : SEED_PRICE[kind];
                            return <button key={kind} className="growing-card" data-growing-seed={kind} onClick={() => onPick({ mode: 'seed', kind })}>
                                <span className="growing-card-icon" aria-hidden="true">{SEED_LABEL[kind].icon}</span>
                                <strong>{SEED_PLACE_NAME[kind]}{kind === 'wonder' && (state.wonderSeeds ?? 0) > 1 ? ` ×${state.wonderSeeds}` : ''}</strong>
                                <small>{kind === 'wild' ? '花や 草に。じかんで ひろがるよ' : SEED_LABEL[kind].note}</small>
                                <small className="growing-catalog-growth">まなぶと そだつ</small>
                                {cost === 0 ? <span className="growing-price growing-free">むりょう</span> : price(cost)}
                            </button>;
                        })}
                        {group.landmarks.includes('flower') && landmarks.includes('flower') && PLANTED_COLORS.filter(p => islandLevel(state) >= p.level).map(({ color }) =>
                            <button key={color} className="growing-card" data-growing-flower={color} onClick={() => onPick({ mode: 'landmark', kind: 'flower', color })}>
                                <span className="growing-card-icon growing-flower-dot" aria-hidden="true" style={{ background: FLOWER_PAINT[color] }} />
                                <strong>{FLOWER_NAME[color]}の はな</strong><small className="growing-catalog-growth">じかんで そだつ</small>{price(LANDMARK_PRICE.flower ?? 0)}
                            </button>)}
                        {group.landmarks.filter(kind => kind !== 'flower' && landmarks.includes(kind)).map(kind => <button key={kind} className="growing-card" data-growing-landmark={kind} onClick={() => onPick({ mode: 'landmark', kind })}>
                            <span className="growing-card-icon" aria-hidden="true">{LANDMARK_LABEL[kind]?.icon}</span>
                            <strong>{LANDMARK_LABEL[kind]?.name}</strong><small className="growing-catalog-growth">{kind === 'sapling' ? 'じかんで そだつ' : 'すぐ つかえる'}</small>{price(LANDMARK_PRICE[kind] ?? 0)}
                        </button>)}
                    </div>
                </section>)}
            </> : <>
                <p className="growing-flower-note">{stored.length ? 'しまってある ものを、しずくを つかわずに おけるよ' : 'しまってある ものは まだ ないよ'}</p>
                {state.keepsakes.some(k => !k.cell) && <p className="growing-flower-note">まなびの きねんひんも、すきな ばしょに おけるよ</p>}
                <div className="growing-grid growing-grid-seeds">
                    {stored.map(item => <button key={item.id} className="growing-card" data-growing-stored={item.id} onClick={() => onPick({ mode: 'unstore', id: item.id, kind: item.kind, seed: item.seed, keepsake: 'keepsake' in item ? item.keepsake as string : undefined })}>
                        <span className="growing-card-icon" aria-hidden="true">{item.label?.icon}</span><strong>{item.label?.name}</strong>
                        {'keepsake' in item && <small>{String(item.keepsake).startsWith('math:') ? 'さんすう' : 'えいご'} Lv{String(item.keepsake).split(':')[1]}の きねん</small>}
                    </button>)}
                </div>
            </>}
        </div>
    </section>;
}
