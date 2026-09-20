import type { ItemKind } from './model';
export function isDecoration(kind: ItemKind): kind is 'fence' | 'planter' {
    return kind === 'fence' || kind === 'planter';
}
