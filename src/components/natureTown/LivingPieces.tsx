import { Apple, Sprout, Circle, ShoppingCart } from 'lucide-react';
import type { DomainEvent, Prop } from '../../domain/natureTown/types';
import { cropStage } from './livingPresentation';
/** Bounded visual objects, with the exact count still available for larger inventories. */
export function FoodPile({ count, cart = false }: { count: number; cart?: boolean }) {
    return <span className={`town-food-pile ${cart ? 'on-cart' : ''}`} role="img" aria-label={`食べもの ${count}こ${cart ? '・台車' : ''}`} data-food={count}>
        <span className="town-food-items">{Array.from({ length: Math.min(count, 8) }, (_, i) => <Apple key={i} aria-hidden="true" />)}</span>
        {count > 8 && <small>+{count - 8}</small>}
        {cart && <ShoppingCart className="town-cart-frame" aria-hidden="true"/>}
    </span>;
}
export function FarmPatch({ farm, harvest }: { harvest?: DomainEvent; farm: Extract<Prop, { kind: 'farm' }> }) {
    const stage = cropStage(farm.growth);
    return <span className={`town-farm-patch ${stage}`} data-growth-stage={stage} data-recent-harvest={harvest?.quantity ?? 0} role="img" aria-label={`畑 ${stage === 'seed' ? '芽' : stage === 'leaves' ? '葉が育っている' : '実が育っている'}`}>
        {[0, 1, 2, 3].map(i => <span className="town-crop" key={i}><Sprout aria-hidden="true"/>{stage === 'ripe' && <Apple aria-hidden="true"/>}</span>)}
    </span>;
}
export function FoodTable({ food, meal }: { food: number; meal?: DomainEvent }) {
    const served = meal?.quantity ?? 0;
    return <span className="town-food-table" data-meal-served={served} role="img" aria-label={served ? `さっきの共同食 ${served}人ぶん・在庫 ${food}こ` : `食たくの在庫 ${food}こ`}>
        <span className="town-table-top"><FoodPile count={food}/>{served > 0 && <span className="town-plates">{Array.from({ length: Math.min(served, 6) }, (_, i) => <Circle key={i} aria-hidden="true"/>)}{served > 6 && <small>+{served - 6}</small>}</span>}</span>
        <span className="town-table-leg"/>
    </span>;
}
