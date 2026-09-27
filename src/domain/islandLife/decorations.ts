import type { ItemKind } from './model';
export function isDecoration(kind: ItemKind): kind is 'fence' | 'planter' | 'water-channel' {
    return kind === 'fence' || kind === 'planter' || kind === 'water-channel';
}
