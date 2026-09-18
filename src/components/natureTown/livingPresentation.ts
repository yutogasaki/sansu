import type { DomainEvent, WorldState } from '../../domain/natureTown/types';
import { graph, routeOn } from '../../domain/natureTown/grid';
import { context } from '../../domain/natureTown/world';
export type Connection = 'connected' | 'blocked' | 'far' | 'unassigned';
/** The same walkable graph and service budget as meals, including ordinary ground. */
export function supplyConnections(world: WorldState): Map<string, Connection> {
    const result = new Map<string, Connection>(), network = graph(world);
    const props = world.props.filter(p => !p.stored), hubs = props.filter(p => p.kind === 'hub');
    for (const prop of props) {
        if (prop.kind === 'home') {
            const hub = hubs.find(h => h.id === prop.hubId);
            const path = hub && routeOn(network, prop.entrance, hub.entrance);
            result.set(prop.id, !hub ? 'unassigned' : !path ? 'blocked' : path.cost > context().config.transport.serviceMaxPathCost ? 'far' : 'connected');
        } else if (prop.kind === 'farm') {
            result.set(prop.id, !hubs.length ? 'unassigned' : hubs.some(h => routeOn(network, prop.entrance, h.entrance)) ? 'connected' : 'blocked');
        }
    }
    return result;
}
export const connectionMessage = (connection?: Connection) => connection === 'blocked' ? '食たくまで 通れる道が ないよ。置き方を かえてみよう。' : connection === 'far' ? '食たくまで とおいよ。近くに おいてみよう。' : connection === 'unassigned' ? 'つなぐ 食たくを えらぼう。' : '食たくまで 歩いて とどけられるよ。';
export function cropStage(growth: number): 'seed' | 'leaves' | 'ripe' {
    return growth < .3 ? 'seed' : growth < .8 ? 'leaves' : 'ripe';
}
export function recentEvent(events: DomainEvent[], id: string, type?: DomainEvent['type']) {
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (event.subjectIds.includes(id) && (!type || event.type === type)) return event;
    }
}
export function eventMessage(event?: DomainEvent, subjectId?: string): string | undefined {
    if (!event || !event.quantity) return;
    if (event.type === 'FoodHarvested') return `さっき ${event.quantity}こ とれたよ`;
    if (event.type === 'MealServed') return `さっき ${event.quantity}人ぶんの 共同食`;
    if (event.type === 'FoodTransferred') return `さっき ${event.quantity}こ ${event.transfer?.toId === subjectId ? 'うけとったよ' : 'わたしたよ'}`;
}
