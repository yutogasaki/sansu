import { isDecoration } from '../../../domain/islandLife/decorations';
import { occupiedCells } from '../../../domain/islandLife/footprint';
import { CATALOG, type Cell, type ItemKind, type LifeItem, type LifeState } from '../../../domain/islandLife/model';
import { cellKey, homeCell, isHouse, isolatedItems, landCells, pathToActivity, usablePlacement, vacant } from '../../../domain/islandLife/space';

export function previewPlacement(state: LifeState, source: ItemKind | LifeItem, cell?: Cell) {
    const item: LifeItem = typeof source === 'string'
        ? { id: '__life-preview__', kind: source, growth: 0, style: 'original' }
        : { ...source };
    if (state.activityVersion === 2 && ['bench', 'swing'].includes(item.kind)) item.access = 'front';
    const base = { ...state, items: [...state.items.filter(i => i.id !== item.id), item] };
    const allowed = landCells(state).filter(p => usablePlacement(base, item.id, p)).map(cellKey);
    const valid = Boolean(cell && allowed.includes(cellKey(cell)));
    const trial = { ...base, items: base.items.map(i => i.id === item.id ? { ...item, cell } : i) };
    const path = cell && !isDecoration(item.kind) ? pathToActivity(trial, homeCell, { ...item, cell }) : undefined;
    const blocked = cell && !valid ? trial.items.find(i => i.cell && !pathToActivity(trial, homeCell, i)) : undefined;
    const previous = blocked && base.items.find(i => i.id === blocked.id);
    const blockedPath = previous?.cell ? pathToActivity(base, homeCell, previous) : undefined;
    const isolated = state.placementVersion === 1 && valid ? isolatedItems(trial) : [];
    const reason = !cell ? 'しまを タップして ばしょを えらぼう。'
        : valid ? isolated.some(i => i.id === item.id) ? 'ここまで あるけないよ。このまま おけるよ。' : isolated.length ? '？の ばしょへ あるけないよ。このまま おけるよ。' : 'ここなら おけるよ。'
        : isHouse(cell) ? 'ここは おうちの ばしょだよ。'
        : !occupiedCells({ ...item, cell }).every(p => vacant(base, p, item.id)) ? 'ここには ほかの ものが あるよ。'
        : item.access === 'front' && !vacant(trial, { x: cell.x, z: cell.z + 1 }) ? 'まえを ひとマス あけて おこう。'
        : blocked ? `${CATALOG[blocked.kind].label}まで あるけなくなるよ。べつの マスを えらぼう。`
        : 'ここまで あるけないよ。べつの マスを えらぼう。';
    return { item: { ...item, cell }, allowed, valid, reason, isolated, path: valid ? path : state.placementVersion === 1 ? undefined : blockedPath };
}
export type PlacementPreview = ReturnType<typeof previewPlacement>;
