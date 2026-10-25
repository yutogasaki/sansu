import type { CatalogPictures } from './catalogPictures';
import { canPurchase, cosmeticsOpen } from '../../../domain/growingIsland/community';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { LANDMARK_PRICE, SEED_PRICE } from '../../../domain/growingIsland';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland';
import { PLANTED_COLORS, type FlowerColor } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';
import { LANDMARK_LABEL, SEED_LABEL, SEED_PLACE_NAME } from './growingCopy';
import { CATALOG_GROUPS as GROUPS, storedCatalog } from './storedCatalog';

export interface CatalogPosition { tab: 'new' | 'stored'; category: string; scroll: number; item?: { attr: string; value: string } }

export type Pick = { mode: 'seed'; kind: SeedKind } | { mode: 'landmark'; kind: LandmarkKind; color?: FlowerColor }
    | { mode: 'unstore'; id: string; kind: SeedKind | LandmarkKind; seed: boolean; keepsake?: string };

const SEEDS: SeedKind[] = ['home', 'farm', 'play', 'wild', 'market', 'festival', 'wonder'];
const LANDMARKS: LandmarkKind[] = ['flower', 'bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table', 'planter', 'swing', 'lantern', 'fence', 'lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'bakery', 'postbox'];

/** The catalog describes the result; seed/landmark remain placement commands only. */
export function GrowingTray({ state, onPick, onClose, initialTab = 'seeds', pictures = {}, position }: { position?: CatalogPosition; pictures?: CatalogPictures; state: GrowingState; onPick: (pick: Pick) => void; onClose: () => void; initialTab?: 'seeds' | 'landmarks' | 'stored' }) {
    const tutorial = state.tutorial === 'first-home';
    const [tab, setTab] = useState<'new' | 'stored'>(!tutorial && (position?.tab === 'stored' || initialTab === 'stored') ? 'stored' : 'new');
    const [category, setCategory] = useState(position?.category ?? 'すべて');
    const id = useId();
    const tabs = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const section = tabs.current?.closest('section');
        const panel = section?.querySelector<HTMLElement>('[role="tabpanel"]');
        if (panel && position) panel.scrollTop = position.scroll;
        const item = position?.item;
        const target = item ? Array.from(section?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(button => button.getAttribute(item.attr) === item.value) : undefined;
        (target ?? tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]'))?.focus({ preventScroll: true });
    // Initial position belongs to this opening; later filters are the child's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const seeds = SEEDS.filter(kind => (kind === 'wonder' ? (state.wonderSeeds ?? 0) > 0 : canPurchase(state, `seed:${kind}`)) && (!tutorial || kind === 'home'));
    const landmarks = tutorial ? [] : LANDMARKS.filter(kind => canPurchase(state, `landmark:${kind}`));
    const groups = GROUPS.filter(group => group.seeds.some(kind => seeds.includes(kind)) || group.landmarks.some(kind => landmarks.includes(kind)));
    const stored = storedCatalog(state);
    const filters = tab === 'new' ? groups.map(group => group.name) : stored.groups.map(group => group.name);
    const activeCategory = filters.includes(category) ? category : 'すべて';
    const frequent = stored.groups.find(group => group.name === 'しまに 多いもの')?.items ?? [];
    const storedGroups = stored.groups.map(group => ({ ...group,
        items: activeCategory === 'すべて' && group.name !== 'しまに 多いもの'
            ? group.items.filter(item => !frequent.includes(item)) : group.items,
    })).filter(group => group.items.length && (activeCategory === 'すべて' || activeCategory === group.name));
    const art = (key: string, fallback: React.ReactNode) => pictures[key] ? <img className="growing-catalog-picture" src={pictures[key]} alt="" /> : fallback;
    const info = (name: string, key: string, note: string) => <details className="growing-catalog-detail"><summary aria-label={`${name}を くわしく`}>くわしく</summary><div>{pictures[key] && <img src={pictures[key]} alt={name} />}<strong>{name}</strong><p>{note}</p></div></details>;
    const price = (value: number) => <span className="growing-price" aria-label={`しずく ${value}`}>💧{value}</span>;
    const switchTab = (event: KeyboardEvent<HTMLDivElement>) => {
        if (tutorial || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'new' : event.key === 'End' ? 'stored' : tab === 'new' ? 'stored' : 'new';
        setTab(next); setCategory('すべて');
        tabs.current?.querySelector<HTMLButtonElement>(`[id="${id}-${next}-tab"]`)?.focus();
    };
    return <section className="growing-tray growing-catalog" aria-label="しまに おく" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
        <header>
            <div><h2>しまに おく</h2><p>すきな ものを えらんでね</p></div>
            <button className="growing-close" onClick={onClose} aria-label="とじる">×</button>
        </header>
        <div ref={tabs} role="tablist" aria-label="置くもの" className="growing-tabs" onKeyDown={switchTab}>
            <button id={`${id}-new-tab`} role="tab" aria-controls={`${id}-new`} tabIndex={tab === 'new' ? 0 : -1} aria-selected={tab === 'new'} onClick={() => { setTab('new'); setCategory('すべて'); }}>あたらしく おく</button>
            {!tutorial && <button id={`${id}-stored-tab`} role="tab" aria-controls={`${id}-stored`} tabIndex={tab === 'stored' ? 0 : -1} aria-selected={tab === 'stored'} onClick={() => { setTab('stored'); setCategory('すべて'); }}>もちもの{stored.count > 0 ? ` (${stored.count})` : ''}</button>}
        </div>
        <div role="tabpanel" id={`${id}-${tab}`} aria-labelledby={`${id}-${tab}-tab`}>
            {!tutorial && filters.length > 0 && <div className="growing-catalog-filters" aria-label="品物の しゅるい">
                {['すべて', ...filters].map(name => <button key={name} aria-pressed={activeCategory === name} onClick={() => setCategory(name)}>{name}</button>)}
            </div>}
            {tab === 'new' ? <>
                {state.town.bank > 0 && <p className="growing-flower-note">まなびの じかんが たまっているよ。おうちや はたけが そだつよ</p>}
                {groups.filter(group => activeCategory === 'すべて' || activeCategory === group.name).map(group => <section className="growing-catalog-group" key={group.name} aria-label={group.name}>
                    <h3>{group.name}</h3>
                    <div className="growing-grid growing-grid-seeds">
                        {group.seeds.filter(kind => seeds.includes(kind)).map(kind => {
                            const cost = tutorial ? 0 : SEED_PRICE[kind];
                            return <div key={kind} className="growing-catalog-tile"><button className="growing-card" data-growing-seed={kind} onClick={() => onPick({ mode: 'seed', kind })}>
                                <span className="growing-card-icon" aria-hidden="true">{art(`seed:${kind}`, SEED_LABEL[kind].icon)}</span>
                                <strong>{SEED_PLACE_NAME[kind]}{kind === 'wonder' && (state.wonderSeeds ?? 0) > 1 ? ` ×${state.wonderSeeds}` : ''}</strong>
                                <small>{kind === 'wild' ? '花や 草に。じかんで ひろがるよ' : SEED_LABEL[kind].note}</small>
                                <small className="growing-catalog-growth">まなぶと そだつ</small><small>そだった すがたの 一例</small>
                                {cost === 0 ? <span className="growing-price growing-free">むりょう</span> : price(cost)}
                            </button>{info(SEED_PLACE_NAME[kind], `seed:${kind}`, SEED_LABEL[kind].note)}</div>;
                        })}
                        {group.landmarks.includes('flower') && landmarks.includes('flower') && PLANTED_COLORS.filter(p => cosmeticsOpen(state, p.level)).map(({ color }) =>
                            <div key={color} className="growing-catalog-tile"><button className="growing-card" data-growing-flower={color} onClick={() => onPick({ mode: 'landmark', kind: 'flower', color })}>
                                <span className="growing-card-icon" aria-hidden="true">{art(`flower:${color}`, <span className="growing-flower-dot" style={{ background: FLOWER_PAINT[color] }} />)}</span>
                                <strong>{FLOWER_NAME[color]}の はな</strong><small className="growing-catalog-growth">じかんで そだつ</small>{price(LANDMARK_PRICE.flower ?? 0)}
                            </button>{info(`${FLOWER_NAME[color]}の はな`, `flower:${color}`, 'じかんで そだつよ。すきな ところに おいてみよう')}</div>)}
                        {group.landmarks.filter(kind => kind !== 'flower' && landmarks.includes(kind)).map(kind => <div key={kind} className="growing-catalog-tile"><button className="growing-card" data-growing-landmark={kind} onClick={() => onPick({ mode: 'landmark', kind })}>
                            <span className="growing-card-icon" aria-hidden="true">{art(`landmark:${kind}`, LANDMARK_LABEL[kind]?.icon)}</span>
                            <strong>{LANDMARK_LABEL[kind]?.name}</strong><small className="growing-catalog-growth">{kind === 'sapling' ? 'じかんで そだつ' : 'すぐ つかえる'}</small>{price(LANDMARK_PRICE[kind] ?? 0)}
                        </button>{info(LANDMARK_LABEL[kind]?.name ?? '', `landmark:${kind}`, kind === 'sapling' ? 'じかんで 木が そだつよ' : 'しまに おいて つかってみよう')}</div>)}
                    </div>
                </section>)}
            </> : <>
                <p className="growing-flower-note">{stored.count ? 'しまってある ものを、しずくを つかわずに おけるよ' : 'しまってある ものは まだ ないよ'}</p>
                {state.keepsakes.some(k => !k.cell) && <p className="growing-flower-note">まなびの きねんひんも、すきな ばしょに おけるよ</p>}
                {storedGroups.map(group => <section className="growing-catalog-group" key={group.name} aria-label={group.name}>
                    <h3>{group.name}</h3>
                    <div className="growing-grid growing-grid-seeds">
                        {group.items.map(item => <button key={item.id} className="growing-card" data-growing-stored={item.id} onClick={() => onPick({ mode: 'unstore', id: item.id, kind: item.kind, seed: item.seed, keepsake: item.keepsake })}>
                            <span className="growing-card-icon" aria-hidden="true">{art(item.id, item.label.icon)}</span><strong>{item.label.name}{item.count > 1 ? ` ×${item.count}` : ''}</strong>
                            {item.keepsake && <small>{item.keepsake.startsWith('math:') ? 'さんすう' : 'えいご'} Lv{item.keepsake.split(':')[1]}の きねん</small>}
                        </button>)}
                    </div>
                </section>)}
            </>}
        </div>
    </section>;
}
