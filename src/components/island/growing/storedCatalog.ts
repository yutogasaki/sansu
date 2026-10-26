import { keepsakeKind, type GrowingState, type LandmarkKind, type SeedKind } from '../../../domain/growingIsland';
import { FLOWER_NAME } from './flowerGeometry';
import { HOME_STAGE, KEEPSAKE_NAME, LANDMARK_LABEL, SEED_LABEL, SEED_PLACE_NAME } from './growingCopy';

export const CATALOG_GROUPS: { name: string; seeds: SeedKind[]; landmarks: LandmarkKind[] }[] = [
    { name: 'おうち', seeds: ['home'], landmarks: [] },
    { name: 'たべもの', seeds: ['farm', 'market'], landmarks: ['bakery'] },
    { name: 'あそぶ・やすむ', seeds: ['play', 'festival'], landmarks: ['bench', 'picnic-table', 'swing', 'bandstand', 'slide', 'trampoline', 'pinwheel', 'sandbox', 'library'] },
    { name: '花・木・水', seeds: ['wild'], landmarks: ['flower', 'sapling', 'water-bowl', 'water-channel', 'planter', 'fountain', 'flower-arch', 'garden-hut'] },
    { name: 'あかり・さく・ポスト', seeds: [], landmarks: ['lantern', 'fence', 'lighthouse', 'postbox'] },
    { name: 'ふしぎ', seeds: ['wonder'], landmarks: [] },
];

/** Read-only presentation. Each stack retains a real owner ID for the existing unstore command. */
export function storedCatalog(state: GrowingState) {
    const entries = [
        ...state.keepsakes.map(item => ({ item, seed: false, keepsake: item.unitId, kind: 'flower' as SeedKind | LandmarkKind,
            category: item.unitId.startsWith('species:') ? 'しまの いきもの' : 'まなびの きねん', label: { name: KEEPSAKE_NAME[keepsakeKind(item.unitId)], icon: item.unitId.startsWith('species:') ? '🐚' : '🏅' }, family: `keepsake:${item.unitId}` })),
        ...state.landmarks.map(item => ({ item, seed: false, keepsake: undefined, kind: item.kind as SeedKind | LandmarkKind,
            category: CATALOG_GROUPS.find(g => g.landmarks.includes(item.kind))!.name,
            label: { icon: LANDMARK_LABEL[item.kind]?.icon ?? '📦', name: item.kind === 'flower' ? `${FLOWER_NAME[item.color ?? 'pink']}の はな` : LANDMARK_LABEL[item.kind]?.name ?? 'もちもの' },
            family: `landmark:${item.kind}:${item.kind === 'flower' ? item.color ?? 'pink' : ''}` })),
        ...state.plots.map(item => ({ item, seed: true, keepsake: undefined, kind: item.kind as SeedKind | LandmarkKind,
            category: CATALOG_GROUPS.find(g => g.seeds.includes(item.kind))!.name,
            label: { name: item.kind === 'home' ? HOME_STAGE[item.stage] : SEED_PLACE_NAME[item.kind], icon: SEED_LABEL[item.kind].icon }, family: `seed:${item.kind}` })),
    ];
    const placed = new Map<string, number>();
    for (const entry of entries) if (entry.item.cell) placed.set(entry.family, (placed.get(entry.family) ?? 0) + 1);
    const stacks = new Map<string, { id: string; kind: SeedKind | LandmarkKind; seed: boolean; keepsake?: string; label: { name: string; icon: string }; category: string; count: number; placed: number }>();
    for (const entry of entries) {
        if (entry.item.cell) continue;
        // Include all persisted individual properties, including legacy/provenance. Never merge unlike owners.
        const properties = Object.entries(entry.item).filter(([key]) => key !== 'id' && key !== 'cell').sort(([a], [b]) => a.localeCompare(b));
        const key = JSON.stringify([entry.family, properties]);
        const stack = stacks.get(key);
        if (stack) stack.count++;
        else stacks.set(key, { id: entry.item.id, kind: entry.kind, seed: entry.seed, keepsake: entry.keepsake,
            label: entry.label, category: entry.category, count: 1, placed: placed.get(entry.family) ?? 0 });
    }
    const items = [...stacks.values()].sort((a, b) => b.placed - a.placed);
    const frequent = items.filter(item => item.placed > 0).slice(0, 3);
    const groups = [
        { name: 'しまに 多いもの', items: frequent },
        ...[...CATALOG_GROUPS.map(g => g.name), 'まなびの きねん'].map(name => ({ name, items: items.filter(item => item.category === name) })),
    ].filter(group => group.items.length);
    return { count: items.reduce((total, item) => total + item.count, 0), groups };
}
