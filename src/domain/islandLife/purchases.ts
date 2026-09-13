import { isFacility } from './footprint';
import { CATALOG, type ItemKind, type LifeAction, type LifeCommand, type LifeItem, type LifePurchaseReceipt } from './model';

/** Historical prices are independent of the shop. Never edit an issued version. */
export const LEGACY_LIFE_PRICES: Readonly<Record<Exclude<ItemKind, 'sapling' | 'water-bowl' | 'picnic-table' | 'pinwheel' | 'flower-arch' | 'sandbox' | 'garden-hut' | 'library'>, number>> = Object.freeze({
    flower: 2, bench: 4, swing: 6, lantern: 8,
});

export function commandFingerprint(command: LifeCommand): string {
    switch (command.type) {
        case 'clear-placement': return JSON.stringify(['clear-placement', command.kind, command.cell.x, command.cell.z, command.itemId ?? null]);
        case 'observe-relation': return JSON.stringify(['observe-relation', command.itemId, command.residentId, command.targetId ?? null]);
        case 'buy': return JSON.stringify(['buy', command.kind, command.cell.x, command.cell.z]);
        case 'move': return JSON.stringify(['move', command.itemId, command.cell.x, command.cell.z]);
        case 'expand': return JSON.stringify(['expand', command.side]);
        case 'style': return JSON.stringify(['style', command.style, command.itemId ?? null]);
        default: return JSON.stringify([command.type, command.itemId]);
    }
}

const PLANTS_WATER_PRICES = Object.freeze({ sapling: 4, 'water-bowl': 4 });
export function isPlantsWater(kind: ItemKind): kind is 'sapling' | 'water-bowl' { return kind === 'sapling' || kind === 'water-bowl'; }
export function isWindArch(kind: ItemKind): kind is 'pinwheel' | 'flower-arch' { return kind === 'pinwheel' || kind === 'flower-arch'; }
function priceTerms(kind: ItemKind) {
    return isFacility(kind) ? { version: 'life-v3-facilities-v1' as const, price: kind === 'garden-hut' ? 36 : 72 } : kind === 'sandbox' ? { version: 'life-v3-sandbox-v1' as const, price: 18 } : isWindArch(kind) ? { version: 'life-v3-wind-arch-v1' as const, price: 12 } : kind === 'picnic-table' ? { version: 'life-v3-picnic-v1' as const, price: 8 } : isPlantsWater(kind) ? { version: 'life-v3-plants-water-v1' as const, price: PLANTS_WATER_PRICES[kind] }
        : { version: 'life-48-v1' as const, price: LEGACY_LIFE_PRICES[kind] };
}
function quoteFingerprint(kind: ItemKind, price: number, version: string) { return JSON.stringify([version, kind, price]); }
export function purchaseReceipt(action: LifeAction): LifePurchaseReceipt | undefined {
    if (action.command.type !== 'buy') return undefined;
    const kind = action.command.kind, { version, price } = priceTerms(kind);
    if (price === undefined || CATALOG[kind]?.price !== price) throw new Error('この価格は もういちど たしかめてね。');
    return { priceVersion: version, actualPaidDrops: price,
        quoteFingerprint: quoteFingerprint(kind, price, version), itemInstanceId: action.id, committedAt: action.at };
}
export function paidDrops(action: LifeAction): number {
    if (action.command.type !== 'buy') throw new Error('Purchase required');
    const { version, price } = priceTerms(action.command.kind);
    if (price === undefined) throw new Error('Unknown historical item');
    const receipt = action.purchaseReceipt;
    if ((isPlantsWater(action.command.kind) || action.command.kind === 'picnic-table' || isWindArch(action.command.kind) || action.command.kind === 'sandbox' || isFacility(action.command.kind)) && !receipt) throw new Error('新しい物の購入記録が見つかりません。');
    if (receipt && (receipt.priceVersion !== version || receipt.actualPaidDrops !== price
        || receipt.quoteFingerprint !== quoteFingerprint(action.command.kind, price, version)
        || receipt.itemInstanceId !== action.id || receipt.committedAt !== action.at)) throw new Error('購入の記録を確認できません。');
    return receipt?.actualPaidDrops ?? price;
}
export function removalRefund(item: Pick<LifeItem, 'kind' | 'paidDrops'>) {
    return Math.floor((item.paidDrops ?? priceTerms(item.kind).price) / 2);
}
