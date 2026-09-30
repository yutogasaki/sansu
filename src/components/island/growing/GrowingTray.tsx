import { useState } from 'react';
import { LANDMARK_PRICE, SEED_PRICE } from '../../../domain/growingIsland';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland';
import { islandLevel, keepsakeKind, PLANTED_COLORS, type FlowerColor } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';
import { HOME_STAGE, KEEPSAKE_NAME, LANDMARK_LABEL, SEED_LABEL } from './growingCopy';

export type Pick = { mode: 'seed'; kind: SeedKind } | { mode: 'landmark'; kind: LandmarkKind; color?: FlowerColor }
    | { mode: 'unstore'; id: string; kind: SeedKind | LandmarkKind; seed: boolean; keepsake?: string };

const SEEDS: SeedKind[] = ['home', 'farm', 'play', 'wild', 'market', 'festival'];
const LANDMARKS: LandmarkKind[] = ['flower', 'bench', 'water-bowl', 'sapling', 'water-channel', 'picnic-table', 'planter', 'swing', 'lantern', 'fence', 'lighthouse'];

/** Seeds first and large; landmarks and stored things one swipe away (spec 52 §12.1). */
export function GrowingTray({ state, onPick, onClose }: { state: GrowingState; onPick: (pick: Pick) => void; onClose: () => void }) {
    const [tab, setTab] = useState<'seeds' | 'landmarks' | 'stored'>('seeds');
    const tutorial = state.tutorial === 'first-home';
    const seeds = SEEDS.filter(kind => state.unlocked.includes(`seed:${kind}`) && (!tutorial || kind === 'home'));
    const landmarks = LANDMARKS.filter(kind => state.unlocked.includes(`landmark:${kind}`));
    const stored = [
        ...state.landmarks.filter(l => !l.cell).map(l => ({ id: l.id, kind: l.kind as SeedKind | LandmarkKind, seed: false, label: LANDMARK_LABEL[l.kind] })),
        ...state.plots.filter(p => !p.cell).map(p => ({ id: p.id, kind: p.kind as SeedKind | LandmarkKind, seed: true,
            label: { name: p.kind === 'home' ? HOME_STAGE[p.stage] : SEED_LABEL[p.kind].name, icon: SEED_LABEL[p.kind].icon } })),
        ...state.keepsakes.filter(k => !k.cell).map(k => ({ id: k.id, kind: 'flower' as SeedKind | LandmarkKind, seed: false, keepsake: k.unitId,
            label: { name: KEEPSAKE_NAME[keepsakeKind(k.unitId)], icon: '🏅' } })),
    ];
    const price = (value: number) => <span className="growing-price" aria-label={`しずく ${value}`}>💧{value}</span>;
    return <section className="growing-tray" aria-label="たねと めじるし">
        <header>
            <div role="tablist" className="growing-tabs">
                <button role="tab" aria-selected={tab === 'seeds'} onClick={() => setTab('seeds')}>たね</button>
                {!tutorial && <button role="tab" aria-selected={tab === 'landmarks'} onClick={() => setTab('landmarks')}>めじるし</button>}
                {!tutorial && stored.length > 0 && <button role="tab" aria-selected={tab === 'stored'} onClick={() => setTab('stored')}>しまってある</button>}
            </div>
            <button className="growing-close" onClick={onClose} aria-label="とじる">×</button>
        </header>
        {tab === 'seeds' && <div className="growing-grid growing-grid-seeds">
            {seeds.map(kind => {
                const cost = tutorial ? 0 : SEED_PRICE[kind];
                return <button key={kind} className="growing-card" data-growing-seed={kind} onClick={() => onPick({ mode: 'seed', kind })}>
                    <span className="growing-card-icon" aria-hidden="true">{SEED_LABEL[kind].icon}</span>
                    <strong>{SEED_LABEL[kind].name}</strong><small>{SEED_LABEL[kind].note}</small>
                    {cost === 0 ? <span className="growing-price growing-free">むりょう</span> : price(cost)}
                </button>;
            })}
        </div>}
        {tab === 'landmarks' && <div className="growing-grid">
            {landmarks.includes('flower') && PLANTED_COLORS.filter(p => islandLevel(state) >= p.level).map(({ color }) =>
                <button key={color} className="growing-card" data-growing-flower={color} onClick={() => onPick({ mode: 'landmark', kind: 'flower', color })}>
                    <span className="growing-card-icon growing-flower-dot" aria-hidden="true" style={{ background: FLOWER_PAINT[color] }} />
                    <strong>{FLOWER_NAME[color]}の はな</strong>{price(LANDMARK_PRICE.flower ?? 0)}
                </button>)}
            {landmarks.filter(kind => kind !== 'flower').map(kind => <button key={kind} className="growing-card" data-growing-landmark={kind} onClick={() => onPick({ mode: 'landmark', kind })}>
                <span className="growing-card-icon" aria-hidden="true">{LANDMARK_LABEL[kind]?.icon}</span>
                <strong>{LANDMARK_LABEL[kind]?.name}</strong>{price(LANDMARK_PRICE[kind] ?? 0)}
            </button>)}
        </div>}
        {tab === 'stored' && <div className="growing-grid">
            {stored.map(item => <button key={item.id} className="growing-card" onClick={() => onPick({ mode: 'unstore', id: item.id, kind: item.kind, seed: item.seed, keepsake: 'keepsake' in item ? item.keepsake as string : undefined })}>
                <span className="growing-card-icon" aria-hidden="true">{item.label?.icon}</span><strong>{item.label?.name}</strong>
            </button>)}
        </div>}
    </section>;
}
