import type { Cell, ItemKind, LifeItem, LifeState } from '../../../domain/islandLife/model';
import { cellKey, homeCell, isHouse, landCells, pathToActivity, usablePlacement, vacant } from '../../../domain/islandLife/space';

export function previewPlacement(state: LifeState, source: ItemKind | LifeItem, cell?: Cell) {
    const item: LifeItem = typeof source === 'string'
        ? { id: '__life-preview__', kind: source, growth: 0, style: 'original' }
        : { ...source };
    if (state.activityVersion === 2 && ['bench', 'swing'].includes(item.kind)) item.access = 'front';
    const base = { ...state, items: [...state.items.filter(i => i.id !== item.id), item] };
    const allowed = landCells(state).filter(p => usablePlacement(base, item.id, p)).map(cellKey);
    const valid = Boolean(cell && allowed.includes(cellKey(cell)));
    const trial = { ...base, items: base.items.map(i => i.id === item.id ? { ...item, cell } : i) };
    const path = cell ? pathToActivity(trial, homeCell, { ...item, cell }) : undefined;
    const reason = !cell ? 'しまを タップして ばしょを えらぼう。'
        : valid ? 'ここなら おけるよ。てんてんは とおりみち。'
        : isHouse(cell) ? 'ここは おうちの ばしょだよ。'
        : !vacant(base, cell, item.id) ? 'ここには ほかの ものが あるよ。'
        : item.access === 'front' && !vacant(trial, { x: cell.x, z: cell.z + 1 }) ? 'まえを ひとマス あけて おこう。'
        : 'みんなの とおりみちを あけて おこう。';
    return { item: { ...item, cell }, allowed, valid, reason, path: valid ? path : undefined };
}
export type PlacementPreview = ReturnType<typeof previewPlacement>;
