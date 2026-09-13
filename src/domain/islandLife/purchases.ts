import { CATALOG, type ItemKind, type LifeAction, type LifeCommand, type LifeItem, type LifePurchaseReceipt } from './model';

/** Historical prices are independent of the shop. Never edit an issued version. */
export const LEGACY_LIFE_PRICES: Readonly<Record<ItemKind, number>> = Object.freeze({
    flower: 2, bench: 4, swing: 6, lantern: 8,
});

export function commandFingerprint(command: LifeCommand): string {
    switch (command.type) {
        case 'buy': return JSON.stringify(['buy', command.kind, command.cell.x, command.cell.z]);
        case 'move': return JSON.stringify(['move', command.itemId, command.cell.x, command.cell.z]);
        case 'expand': return JSON.stringify(['expand', command.side]);
        case 'style': return JSON.stringify(['style', command.style, command.itemId ?? null]);
        default: return JSON.stringify([command.type, command.itemId]);
    }
}

function quoteFingerprint(kind: ItemKind, price: number) {
    return JSON.stringify(['life-48-v1', kind, price]);
}

export function purchaseReceipt(action: LifeAction): LifePurchaseReceipt | undefined {
    if (action.command.type !== 'buy') return undefined;
    const kind = action.command.kind;
    const price = CATALOG[kind]?.price;
    // A new price requires a new explicit version before it can be issued.
    if (price === undefined || price !== LEGACY_LIFE_PRICES[kind]) throw new Error('この価格は もういちど たしかめてね。');
    return { priceVersion: 'life-48-v1', actualPaidDrops: price,
        quoteFingerprint: quoteFingerprint(kind, price), itemInstanceId: action.id, committedAt: action.at };
}

export function paidDrops(action: LifeAction): number {
    if (action.command.type !== 'buy') throw new Error('Purchase required');
    const price = LEGACY_LIFE_PRICES[action.command.kind];
    if (price === undefined) throw new Error('Unknown historical item');
    const receipt = action.purchaseReceipt;
    if (receipt && (receipt.priceVersion !== 'life-48-v1' || receipt.actualPaidDrops !== price
        || receipt.quoteFingerprint !== quoteFingerprint(action.command.kind, price)
        || receipt.itemInstanceId !== action.id || receipt.committedAt !== action.at)) {
        throw new Error('購入の記録を確認できません。');
    }
    return receipt?.actualPaidDrops ?? price;
}

export function removalRefund(item: Pick<LifeItem, 'kind' | 'paidDrops'>) {
    return Math.floor((item.paidDrops ?? LEGACY_LIFE_PRICES[item.kind]) / 2);
}
