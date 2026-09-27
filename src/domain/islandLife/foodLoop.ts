import { HOUR, type Cell, type LifeAction, type LifeItem, type LifeRecord, type LifeResident, type LifeState } from './model';
import { pathToActivity } from './space';
import { routeDuration } from './walkingSpace';
import { connectedWaterChannels, shadeInfluence, waterChannelConnections, waterInfluence } from './waterChannels';
import { planSoilStep, soilCourse, soilMoistureAt, soilWetness, type SoilStep } from './soilMoisture';

/** Food belongs to the Island Life replay, never to a second town clock or wallet. */
export interface FoodLoopState {
    plots: Record<string, { hours: number; stock: number }>;
    tables: Record<string, number>;
    pantry: number;
    harvested: number;
    delivered: number;
    eaten: number;
}
export interface FoodTrip {
    sourceId: string;
    tableId: string;
    phase: 'collect' | 'carry';
    toTable: Cell[];
}
export interface FoodCutover {
    rules: 'island-food-v1'; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function cutoverDigest(cutover: FoodCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function prepareFoodCutover(record: LifeRecord): Promise<LifeRecord> {
    if (record.foodCutover) {
        if (record.foodCutover.validationHash !== await cutoverDigest(record.foodCutover)) throw new Error('食べものの切替記録を確認できません。');
        return { ...record, version: 20 };
    }
    if (!record.diagonalCutover) throw new Error('島の通り道をよみなおしてから始めてね。');
    const cutover: FoodCutover = { rules: 'island-food-v1', at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await cutoverDigest(cutover);
    // Fence pre-nature writers before any new rules or purchases are persisted.
    return { ...record, version: 20, foodCutover: cutover };
}
const PLOT_HOURS = 2;
const PLOT_CAPACITY = 3;
const TABLE_CAPACITY = 4;
const PICKUP_MS = 600;
const DELIVERY_MS = 600;
/** Nearby bowls and their connected channels moisten the planter. */
export function foodGrowthConditions(state: LifeState, planter: LifeItem, elapsedGrowthHours = 0) {
    if (!planter.cell) return { water: 0, shade: 0, rate: 0 };
    const water = state.soilMoisture ? soilWetness(soilMoistureAt(state, planter.cell)) : waterInfluence(state, planter.cell);
    const shade = shadeInfluence(state, planter.cell, elapsedGrowthHours);
    // Preserve the existing two-hour starter cycle. Water speeds it up; a grown tree filters light.
    return { water, shade, rate: 1 + 0.5 * water - 0.5 * shade + 0.08 * shade };
}

export function beginFoodLoop(state: LifeState) {
    if (state.food) return;
    state.food = { plots: {}, tables: {}, pantry: 0, harvested: 0, delivered: 0, eaten: 0 };
    syncFoodItems(state);
}

export function syncFoodItems(state: LifeState) {
    const food = state.food;
    if (!food) return;
    const reached = connectedWaterChannels(state);
    const ids = new Set(state.items.map(item => item.id));
    for (const [id, plot] of Object.entries(food.plots)) if (!ids.has(id)) {
        food.pantry += plot.stock; delete food.plots[id];
    }
    for (const [id, stock] of Object.entries(food.tables)) if (!ids.has(id)) {
        food.pantry += stock; delete food.tables[id];
    }
    for (const item of state.items) {
        if (item.kind === 'planter') {
            const plot = food.plots[item.id] ??= { hours: 0, stock: 0 };
            item.foodStage = plot.stock ? 2 : plot.hours >= PLOT_HOURS / 2 ? 1 : 0;
        }
        if (item.kind === 'picnic-table') { food.tables[item.id] ??= 0; item.foodStock = food.tables[item.id]; }
        if (item.kind === 'water-channel') {
            item.waterFlow = Boolean(item.cell && reached.has(`${item.cell.x},${item.cell.z}`));
            item.waterConnections = item.cell ? waterChannelConnections(state, item.cell) : 0;
        }
    }
}

export function growFood(state: LifeState, hours: number, wallHours = hours, step?: SoilStep) {
    if (!state.food || hours <= 0) return;
    const soilStep = state.soilMoisture ? step ?? planSoilStep(state, wallHours, hours) : undefined;
    for (const item of state.items) {
        if (item.kind !== 'planter' || !item.cell) continue;
        const plot = state.food.plots[item.id] ??= { hours: 0, stock: 0 };
        let effectiveHours = 0;
        if (state.soilMoisture) {
            for (const segment of soilCourse(state, item.cell, wallHours, hours, soilStep).segments) {
                effectiveHours += segment.growthHours * (1 + .5 * segment.water - .42 * segment.shade);
            }
        } else {
            const transitions = state.items.filter(other => other.kind === 'sapling' && other.cell)
                .map(other => 18 - other.growth).filter(next => next > 0 && next < hours).sort((a, b) => a - b);
            const boundaries = [0, ...new Set(transitions), hours];
            for (let index = 1; index < boundaries.length; index++) {
                const from = boundaries[index - 1], to = boundaries[index];
                effectiveHours += (to - from) * foodGrowthConditions(state, item, from).rate;
            }
        }
        const total = plot.hours + effectiveHours;
        const harvested = Math.min(PLOT_CAPACITY - plot.stock, Math.floor(total / PLOT_HOURS));
        plot.stock += harvested;
        state.food.harvested += harvested;
        plot.hours = plot.stock === PLOT_CAPACITY ? Math.min(PLOT_HOURS, total - harvested * PLOT_HOURS)
            : total - harvested * PLOT_HOURS;
    }
    syncFoodItems(state);
}

/** A cancelled carrying leg returns the same unit to its source or the pantry. */
export function cancelFoodTrip(state: LifeState, resident: LifeResident) {
    const trip = resident.foodTrip;
    if (!trip || !state.food) return;
    if (trip.phase === 'carry') {
        const plot = state.food.plots[trip.sourceId];
        if (plot && plot.stock < PLOT_CAPACITY) plot.stock++;
        else state.food.pantry++;
    }
    resident.foodTrip = undefined;
    syncFoodItems(state);
}

export function arrangeFoodTrip(state: LifeState) {
    const food = state.food;
    if (!food || state.residents.some(resident => resident.foodTrip)) return;
    // The hero remains available for the child's chosen destination.
    for (const resident of state.residents.filter(r => r.id !== 'pokomoko' && !r.visit && !r.playTour && !r.facilityTrip)) {
        for (const source of state.items.filter(i => i.kind === 'planter' && i.cell && (food.plots[i.id]?.stock ?? 0) > 0)) {
            const toSource = pathToActivity(state, resident.cell, source);
            if (!toSource) continue;
            for (const table of state.items.filter(i => i.kind === 'picnic-table' && i.cell && (food.tables[i.id] ?? 0) < TABLE_CAPACITY)) {
                const toTable = pathToActivity(state, toSource[toSource.length - 1], table);
                if (!toTable) continue;
                resident.foodTrip = { sourceId: source.id, tableId: table.id, phase: 'collect', toTable };
                resident.visit = { itemId: source.id, from: { ...resident.cell }, path: toSource,
                    start: state.now, end: state.now + routeDuration(toSource) + PICKUP_MS };
                return;
            }
        }
    }
}

/** Return true only for a logistics visit; it never mints an activity reward. */
export function settleFoodTrip(state: LifeState, resident: LifeResident): boolean {
    const trip = resident.foodTrip, visit = resident.visit, food = state.food;
    if (!trip || !visit || !food) return false;
    resident.cell = visit.path[visit.path.length - 1];
    if (trip.phase === 'collect') {
        const plot = food.plots[trip.sourceId];
        const source = state.items.find(i => i.id === trip.sourceId && i.cell);
        const table = state.items.find(i => i.id === trip.tableId && i.cell);
        if (!plot?.stock || !source || !table || !trip.toTable.length) {
            cancelFoodTrip(state, resident); resident.visit = undefined; return true;
        }
        plot.stock--;
        trip.phase = 'carry';
        resident.visit = { itemId: table.id, from: { ...resident.cell }, path: trip.toTable,
            start: state.now, end: state.now + routeDuration(trip.toTable) + DELIVERY_MS };
    } else {
        const table = state.items.find(i => i.id === trip.tableId && i.cell);
        if (table) { food.tables[table.id] = (food.tables[table.id] ?? 0) + 1; food.delivered++; }
        else food.pantry++;
        resident.foodTrip = undefined;
        resident.visit = undefined;
    }
    syncFoodItems(state);
    return true;
}

export function eatAtTable(state: LifeState, item: LifeItem | undefined) {
    if (!state.food || item?.kind !== 'picnic-table' || !state.food.tables[item.id]) return false;
    state.food.tables[item.id]--;
    state.food.eaten++;
    syncFoodItems(state);
    return true;
}

export function foodAvailableAtTable(state: LifeState, tableId: string) {
    return !state.food || (state.food.tables[tableId] ?? 0) > 0;
}

/** Inventory conservation is checked in tests and can also diagnose bad saves. */
export function foodInventory(state: LifeState) {
    const food = state.food;
    return food ? food.pantry + Object.values(food.plots).reduce((sum, p) => sum + p.stock, 0)
        + Object.values(food.tables).reduce((sum, stock) => sum + stock, 0)
        + state.residents.filter(r => r.foodTrip?.phase === 'carry').length : 0;
}

export const FOOD_GROWTH_MS = PLOT_HOURS * HOUR;
