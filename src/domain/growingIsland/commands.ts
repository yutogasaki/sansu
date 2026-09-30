import { islandLevel, occupantsOf, refreshUnlocks } from './community';
import { styleAt, syncSoil } from './environment';
import { CAPE_LEVEL, isKid, FLAG_PATTERNS, HATS, LAND_PRICE, LANDMARK_PRICE, RULES, SEED_PRICE, STYLE_LEVEL } from './rules';
import { isVacant, occupant, onLand } from './space';
import { DEFAULT_DECOR, patternOpen, RUG_COLORS, WORD_GROUPS } from './room';
import { noteColor, PLANTED_COLORS } from './flowers';
import { welcome } from './town';
import type { Cell, Command, GrowingState, Side, TownEvent } from './types';

export interface Intent { id: string; command: Command }

function fail(message: string): never { throw new Error(message); }

/** Seeds and landmarks may replace a spread wild plant; everything else needs an empty cell. */
function claim(state: GrowingState, cell: Cell, except?: string) {
    if (!onLand(state, cell)) fail('ここには おけないよ。');
    const found = occupant(state, cell, except);
    if (!found) return;
    if (found.type === 'plot' && found.spread) { state.plots = state.plots.filter(p => p.id !== found.id); return; }
    fail('ここには もう ものが あるよ。');
}

function pay(state: GrowingState, price: number) {
    if (state.drops < price) fail('しずくが もうすこし いるよ。');
    state.drops -= price;
}

function landStep(state: GrowingState) {
    return (state.land.expanded ? 1 : 0) + state.land.extra.length + state.land.capes.length;
}

/** Steps 1-3 keep the current contract; steps 4-5 are capes on already-opened sides. */
export function landQuote(state: GrowingState): { step: number; sides: Side[]; price: number } | undefined {
    const step = landStep(state) + 1;
    if (step === 1) return { step, sides: ['west', 'east'], price: LAND_PRICE[0] };
    if (step === 2) return { step, sides: [state.land.expanded === 'west' ? 'east' : 'west'], price: LAND_PRICE[1] };
    if (step === 3) return { step, sides: ['south'], price: LAND_PRICE[2] };
    if (step <= 5 && islandLevel(state) >= CAPE_LEVEL[step - 4]) {
        return { step, sides: (['east', 'west'] as const).filter(side => !state.land.capes.includes(side)), price: LAND_PRICE[step - 1] };
    }
}

function expand(state: GrowingState, side: Side) {
    const quote = landQuote(state);
    if (!quote || !quote.sides.includes(side)) fail('ひろげる ばしょを もういちど えらんでね。');
    pay(state, quote.price);
    if (quote.step === 1) state.land.expanded = side as 'east' | 'west';
    else if (quote.step <= 3) state.land.extra.push(side);
    else state.land.capes.push(side as 'east' | 'west');
    syncSoil(state);
}

function find(state: GrowingState, id: string) {
    return state.plots.find(p => p.id === id) ?? state.landmarks.find(l => l.id === id) ?? state.keepsakes.find(k => k.id === id)
        ?? fail('みつからないよ。');
}

function apply(state: GrowingState, command: Command): TownEvent[] {
    const events: TownEvent[] = [];
    switch (command.type) {
        case 'plant': {
            if (!state.unlocked.includes(`seed:${command.kind}`)) fail('まだ えらべないよ。');
            const tutorial = state.tutorial === 'first-home' && command.kind === 'home';
            claim(state, command.cell);
            const price = tutorial ? 0 : SEED_PRICE[command.kind];
            pay(state, price);
            const plot = { id: `p${state.nextId++}`, kind: command.kind, cell: { ...command.cell }, plantedAt: state.town.clock,
                stage: 0 as const, growth: 0, origin: 'seed' as const, paid: price };
            state.plots.push(plot);
            if (tutorial) {
                // The first home shows the whole loop once without learning (§14).
                Object.assign(plot, { stage: 1, builtAt: state.town.clock, stagedAt: state.town.clock, style: styleAt(state, plot.cell) });
                state.unopened.push(plot.id);
                events.push({ type: 'built', plotId: plot.id });
                events.push({ type: 'arrived', villagerId: welcome(state, state.town.clock, plot).id });
                state.tutorial = 'done';
                const keys = refreshUnlocks(state);
                if (keys.length) events.push({ type: 'unlocked', keys });
            }
            break;
        }
        case 'place': {
            if (!state.unlocked.includes(`landmark:${command.kind}`)) fail('まだ えらべないよ。');
            const price = LANDMARK_PRICE[command.kind] ?? fail('まだ えらべないよ。');
            let color = command.color;
            if (color !== undefined) {
                // Children plant the base colours; mixed colours only grow on the island.
                const planted = PLANTED_COLORS.find(entry => entry.color === color);
                if (command.kind !== 'flower' || !planted || islandLevel(state) < planted.level) fail('まだ えらべないよ。');
            } else if (command.kind === 'flower') color = 'red';
            claim(state, command.cell);
            pay(state, price);
            state.landmarks.push({ id: `l${state.nextId++}`, kind: command.kind, cell: { ...command.cell }, growth: 0, ...(color ? { color } : {}) });
            if (color) noteColor(state, color);
            break;
        }
        case 'move': {
            const target = find(state, command.id);
            if (!target.cell) fail('しまってある ものは「おく」から えらんでね。');
            claim(state, command.cell, command.id);
            target.cell = { ...command.cell };
            break;
        }
        case 'store': {
            const plot = state.plots.find(p => p.id === command.id);
            if (plot?.stage === 0) {
                state.plots = state.plots.filter(p => p.id !== plot.id);
                state.drops += plot.paid;
                break;
            }
            if (plot?.kind === 'home' && occupantsOf(state, plot.id).length) fail('だれかが すんでいるよ。');
            find(state, command.id).cell = undefined;
            break;
        }
        case 'unstore': {
            const target = find(state, command.id);
            if (target.cell) fail('もう おいてあるよ。');
            claim(state, command.cell);
            target.cell = { ...command.cell };
            break;
        }
        case 'pluck': {
            const plot = state.plots.find(p => p.id === command.id && p.kind === 'wild' && p.stage > 0) ?? fail('つめないよ。');
            state.plots = state.plots.filter(p => p.id !== plot.id);
            break;
        }
        case 'expand': expand(state, command.side); break;
        case 'name': {
            const name = command.name.trim();
            if (!name || [...name].length > 12) fail('なまえは 1〜12もじで つけてね。');
            if (command.target === 'island') state.islandName = name;
            else {
                const villager = state.villagers.find(v => v.id === command.target) ?? fail('みつからないよ。');
                if (isKid(villager.species)) fail('えまと えいたの なまえは そのままだよ。');
                villager.name = name;
            }
            break;
        }
        case 'paint': {
            // Eight colours and two wonder patterns (polka dots, colour blocks).
            if (!Number.isInteger(command.color) || command.color < 0 || command.color > 9) fail('いろを えらびなおしてね。');
            if (command.target === 'flag') state.flagColor = command.color;
            else (state.plots.find(p => p.id === command.target && p.kind === 'home') ?? fail('みつからないよ。')).roof = command.color;
            break;
        }
        case 'open': state.unopened = state.unopened.filter(id => id !== command.id); break;
        case 'open-all': state.unopened = []; state.arrivals = []; break;
        case 'disembark': state.arrivals = state.arrivals.filter(id => id !== command.id); break;
        case 'away': (state.villagers.find(v => v.id === command.id) ?? fail('みつからないよ。')).away = command.away || undefined; break;
        case 'dress': {
            // Clothes colours open at Lv8 and hats at Lv9; both are free and can change any time.
            const villager = state.villagers.find(v => v.id === command.id) ?? fail('みつからないよ。');
            const level = islandLevel(state), outfit = { ...villager.outfit };
            if (command.color !== undefined) {
                if (level < STYLE_LEVEL.clothes) fail('まだ えらべないよ。');
                if (!Number.isInteger(command.color) || command.color < 0 || command.color > 5) fail('いろを えらびなおしてね。');
                outfit.color = command.color;
            }
            if (command.hat !== undefined) {
                if (level < STYLE_LEVEL.hats) fail('まだ えらべないよ。');
                if (!Number.isInteger(command.hat) || command.hat < 0 || command.hat > HATS) fail('ぼうしを えらびなおしてね。');
                outfit.hat = command.hat || undefined;
            }
            villager.outfit = outfit.color === undefined && outfit.hat === undefined ? undefined : outfit;
            break;
        }
        case 'decorate': {
            // Free and changeable any time; a shape opens with the math level already reached.
            const room = { ...DEFAULT_DECOR, ...state.room };
            if (command.pattern !== undefined) {
                if (!patternOpen(command.pattern, state.mastery?.math ?? 0)) fail('まだ えらべないよ。');
                room.pattern = command.pattern;
            }
            if (command.rug !== undefined) {
                if (!Number.isInteger(command.rug) || command.rug < 0 || command.rug >= RUG_COLORS.length) fail('いろを えらびなおしてね。');
                room.rug = command.rug;
            }
            if (command.hidden !== undefined) {
                const ids = new Set<string>(WORD_GROUPS.map(g => g.id));
                if (command.hidden.some(id => !ids.has(id))) fail('いろを えらびなおしてね。');
                room.hidden = [...new Set(command.hidden)];
                if (!room.hidden.length) delete room.hidden;
            }
            state.room = room;
            break;
        }
        case 'flag': {
            if (command.color !== undefined) {
                if (!Number.isInteger(command.color) || command.color < 0 || command.color > 7) fail('いろを えらびなおしてね。');
                state.flagColor = command.color;
            }
            if (command.pattern !== undefined) {
                if (islandLevel(state) < STYLE_LEVEL.flagPattern) fail('まだ えらべないよ。');
                if (!Number.isInteger(command.pattern) || command.pattern < 0 || command.pattern >= FLAG_PATTERNS) fail('もようを えらびなおしてね。');
                state.flagPattern = command.pattern;
            }
            break;
        }
    }
    return events;
}

/**
 * Applies a child's action once. A repeated intent id (double tap, second tab, a lost
 * commit notice) returns the saved state unchanged.
 */
export function applyIntent(previous: GrowingState, intent: Intent): { state: GrowingState; events: TownEvent[] } {
    if (previous.applied.includes(intent.id)) return { state: previous, events: [] };
    const state = structuredClone(previous);
    const events = apply(state, intent.command);
    state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
    return { state, events };
}

export function canPlace(state: GrowingState, cell: Cell, except?: string) {
    if (isVacant(state, cell, except)) return true;
    const found = occupant(state, cell, except);
    return found?.type === 'plot' && found.spread;
}
