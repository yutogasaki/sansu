import { cloverFound, discover, noteDiscoveries } from './discoveries';
import { adoptSpecies, noteJourney, SPECIES } from './journey';
import { recordSharedPlay } from './experience';
import { grantGrowthMilestones } from './growth';
import { canPurchase, cosmeticsOpen } from './community';
import { ACHIEVEMENTS, noteGuidanceIntent, noteTownBuilds } from './guidance';
import { islandLevel, occupantsOf, refreshUnlocks } from './community';
import { styleAt, syncSoil } from './environment';
import { CAPE_LEVEL, DISTRICT_PRICE_STEP, isKid, FLAG_PATTERNS, HATS, LAND_PRICE, LANDMARK_PRICE, RULES, SEED_PRICE, STYLE_LEVEL } from './rules';
import { bridgeAnchor, bridgeSite, canBuildBridge, isReachable, isVacant, key, occupant, onLand, reachableFromHome } from './space';
import { DEFAULT_DECOR, patternOpen, RUG_COLORS, WORD_GROUPS } from './room';
import { noteColor, PLANTED_COLORS } from './flowers';
import { newPlaceProgress, recordPlaceShown, recordPlaceUse, syncPlaceMilestones } from './placeGoals';
import { PLACE_GOAL_IDS } from './placeTypes';
import { openTown, welcome } from './town';
import type { Cell, Command, GrowingState, Side, TownEvent } from './types';
import type { IslandWorld } from './worldDefinition';
import { hasAuthoredPlacementSupport } from './authoredPlacementSupport';
import { applyTerrainCommand, terrainOwnerSupported } from './terrainEditing';
import { editableIslandWorld, terrainOf } from './editableTerrainWorld';
import { TEND_LIMIT, TENDABLE, tendPrice } from './placementAdvice';

export interface Intent { id: string; islandId?: string; command: Command }

function fail(message: string): never { throw new Error(message); }

/** Seeds and landmarks may replace a spread wild plant; everything else needs an empty cell. */
function claim(state: GrowingState, cell: Cell, except?: string, world?: IslandWorld) {
    if (!onLand(state, cell, world) || world && !hasAuthoredPlacementSupport(world, cell) || !terrainOwnerSupported(state, cell)) fail('ここには おけないよ。');
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
    return (state.land.expanded ? 1 : 0) + state.land.extra.length + state.land.capes.length + (state.land.districts?.length ?? 0);
}

/** Steps 1-3 keep the current contract; steps 4-5 are capes on already-opened sides. */
export function landQuote(state: GrowingState): { step: number; sides: Side[]; price: number } | undefined {
    const step = landStep(state) + 1;
    if (step === 1) return { step, sides: ['west', 'east'], price: LAND_PRICE[0] };
    if (step === 2) return { step, sides: [state.land.expanded === 'west' ? 'east' : 'west'], price: LAND_PRICE[1] };
    if (step === 3) return { step, sides: ['south'], price: LAND_PRICE[2] };
    if (step <= 5 && (state.growth || islandLevel(state) >= CAPE_LEVEL[step - 4])) {
        return { step, sides: (['east', 'west'] as const).filter(side => !state.land.capes.includes(side)), price: LAND_PRICE[step - 1] };
    }
    if (step >= 6) return { step, sides: ['east', 'west', 'south'], price: LAND_PRICE[4] + DISTRICT_PRICE_STEP * (step - 5) };
}

function expand(state: GrowingState, side: Side) {
    const quote = landQuote(state);
    if (!quote || !quote.sides.includes(side)) fail('ひろげる ばしょを もういちど えらんでね。');
    pay(state, quote.price);
    if (quote.step === 1) state.land.expanded = side as 'east' | 'west';
    else if (quote.step <= 3) state.land.extra.push(side);
    else if (quote.step <= 5) state.land.capes.push(side as 'east' | 'west');
    else (state.land.districts ??= []).push(side);
    if (state.growth) state.growth.expanded = true;
    syncSoil(state);
    if (state.bridge) {
        const x = bridgeSite(state);
        if (x === undefined) fail('はしの ばしょが ないよ。はしを しまってから ひろげてね。');
        state.bridge.x = x;
    }
}

function find(state: GrowingState, id: string) {
    return state.plots.find(p => p.id === id) ?? state.landmarks.find(l => l.id === id) ?? state.keepsakes.find(k => k.id === id)
        ?? fail('みつからないよ。');
}

function apply(state: GrowingState, command: Command, world?: IslandWorld): TownEvent[] {
    if (world && !terrainOf(state) && ['expand', 'bridge-build', 'bridge-remove'].includes(command.type))
        fail('この制作中の島では 土地とはしの編集を まだ使えないよ。');
    const events: TownEvent[] = [];
    switch (command.type) {
        case 'choose-place-goal': {
            if (command.id !== undefined && !PLACE_GOAL_IDS.includes(command.id)) fail('もういちど えらんでね。');
            (state.placeProgress ??= newPlaceProgress()).selected = command.id;
            break;
        }
        case 'shared-play': case 'place-used': case 'place-shown': break;
        case 'choose-goal': {
            if (!state.guidance || (command.id !== undefined && !ACHIEVEMENTS.includes(command.id))) fail('もういちど えらんでね。');
            state.guidance.selected = command.id;
            state.guidance.starter.automatic = false;
            break;
        }
        case 'choose-starter-play': {
            if (!state.guidance || !state.guidance.starter.steps.S3 || state.guidance.starter.steps.S4
                || (command.id !== 'A3' && command.id !== 'A4')) fail('もういちど えらんでね。');
            state.guidance.selected = command.id;
            break;
        }
        case 'starter-guide': if (state.guidance) state.guidance.starter.automatic = command.automatic; break;
        case 'ack-revisit-flower': {
            if (state.guidance?.firstFlower?.id === command.id) state.guidance.firstFlower.seen = true;
            break;
        }
        case 'ack-achievements': {
            if (state.guidance) for (const id of command.ids) if (state.guidance.achievements[id] && !state.guidance.notified.includes(id)) state.guidance.notified.push(id);
            break;
        }
        case 'concert-started': case 'learning-returned': break;
        case 'plant': {
            if (command.kind === 'wonder') {
                if (!state.wonderSeeds) fail('ふしぎの たねが まだ ないよ。');
            } else if (!canPurchase(state, `seed:${command.kind}`)) fail('まだ えらべないよ。');
            const tutorial = state.tutorial === 'first-home' && command.kind === 'home';
            if (command.kind === 'home' && !canReachHomePlacement(state, command.cell, undefined, world)) fail('ここまで いけないみたい。まわりを あけてみよう');
            claim(state, command.cell, undefined, world);
            const price = tutorial ? 0 : SEED_PRICE[command.kind];
            pay(state, price);
            const plot = { id: `p${state.nextId++}`, kind: command.kind, cell: { ...command.cell }, plantedAt: state.town.clock,
                stage: 0 as const, growth: 0, origin: 'seed' as const, paid: price };
            state.plots.push(plot);
            if (command.kind === 'wonder') {
                if (state.growth && state.wonderSeeds! <= state.growth.restoredStock.length)
                    Object.assign(plot, { restoredWonder: state.growth.restoredStock.shift() });
                state.wonderSeeds = state.wonderSeeds! - 1;
            }
            if (tutorial) {
                // The first home shows the whole loop once without learning (§14).
                Object.assign(plot, { stage: 1, builtAt: state.town.clock, stagedAt: state.town.clock, style: styleAt(state, plot.cell, undefined, world) });
                state.unopened.push(plot.id);
                events.push({ type: 'built', plotId: plot.id });
                events.push({ type: 'arrived', villagerId: welcome(state, state.town.clock, plot, world).id });
                state.tutorial = 'done';
                const keys = refreshUnlocks(state);
                if (keys.length) events.push({ type: 'unlocked', keys });
            }
            break;
        }
        case 'place': {
            if (!canPurchase(state, `landmark:${command.kind}`)) fail('まだ えらべないよ。');
            const price = LANDMARK_PRICE[command.kind] ?? fail('まだ えらべないよ。');
            let color = command.color;
            if (color !== undefined) {
                // Children plant the base colours; mixed colours only grow on the island.
                const planted = PLANTED_COLORS.find(entry => entry.color === color);
                if (command.kind !== 'flower' || !planted || !cosmeticsOpen(state, planted.level)) fail('まだ えらべないよ。');
            } else if (command.kind === 'flower') color = 'red';
            claim(state, command.cell, undefined, world);
            pay(state, price);
            const id = `l${state.nextId++}`;
            state.landmarks.push({ id, kind: command.kind, cell: { ...command.cell }, growth: 0, ...(color ? { color } : {}) });
            if (command.kind === 'flower' && state.guidance && !state.guidance.firstFlower)
                state.guidance.firstFlower = { id, seen: false };
            if (color) noteColor(state, color);
            break;
        }
        case 'move': {
            const target = find(state, command.id);
            if (!target.cell) fail('しまってある ものは「おく」から えらんでね。');
            if (state.plots.some(p => p.id === command.id && p.kind === 'home') && !canReachHomePlacement(state, command.cell, command.id, world))
                fail('ここまで いけないみたい。まわりを あけてみよう');
            claim(state, command.cell, command.id, world);
            target.cell = { ...command.cell };
            break;
        }
        case 'store': {
            const plot = state.plots.find(p => p.id === command.id);
            if (plot?.stage === 0) {
                state.plots = state.plots.filter(p => p.id !== plot.id);
                state.drops += plot.restoredWonder ? 0 : plot.paid;
                if (plot.restoredWonder && state.growth) state.growth.restoredStock.push(plot.restoredWonder);
                if (plot.kind === 'wonder') state.wonderSeeds = (state.wonderSeeds ?? 0) + 1;
                break;
            }
            if (plot?.kind === 'home' && occupantsOf(state, plot.id).length) fail('だれかが すんでいるよ。');
            find(state, command.id).cell = undefined;
            break;
        }
        case 'unstore': {
            const target = find(state, command.id);
            if (target.cell) fail('もう おいてあるよ。');
            if (state.plots.some(p => p.id === command.id && p.kind === 'home') && !canReachHomePlacement(state, command.cell, command.id, world))
                fail('ここまで いけないみたい。まわりを あけてみよう');
            claim(state, command.cell, undefined, world);
            target.cell = { ...command.cell };
            break;
        }
        case 'pluck': {
            const plot = state.plots.find(p => p.id === command.id && p.kind === 'wild' && p.stage > 0) ?? fail('つめないよ。');
            state.plots = state.plots.filter(p => p.id !== plot.id);
            if (cloverFound(state, plot.id)) discover(state, 'clover');
            break;
        }
        case 'adopt-species': {
            if (!(SPECIES as readonly string[]).includes(command.species)) fail('その いきものは いないよ。');
            adoptSpecies(state, command.species);
            break;
        }
        case 'tend': {
            const owner = state.landmarks.find(l => l.id === command.id && l.cell && TENDABLE.includes(l.kind)) ?? fail('そだてられないよ。');
            if ((owner.tended ?? 0) >= TEND_LIMIT) fail('もう じゅうぶん そだったよ。');
            pay(state, tendPrice(owner.kind));
            owner.tended = (owner.tended ?? 0) + 1;
            break;
        }
        case 'expand': expand(state, command.side); break;
        case 'bridge-build': {
            if (state.bridge) fail('はしは もう あるよ。');
            if (!state.villagers.some(v => !v.away && !state.arrivals.includes(v.id))) fail('なかまが きてから つくろう。');
            if (!canBuildBridge(state, command.x)) fail('はしを かける ばしょを あけてね。');
            state.bridge = { x: command.x };
            break;
        }
        case 'bridge-remove': {
            if (!state.bridge) fail('はしは まだ ないよ。');
            delete state.bridge;
            break;
        }
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
            const outfit = { ...villager.outfit };
            if (command.color !== undefined) {
                if (!cosmeticsOpen(state, STYLE_LEVEL.clothes)) fail('まだ えらべないよ。');
                if (!Number.isInteger(command.color) || command.color < 0 || command.color > 5) fail('いろを えらびなおしてね。');
                outfit.color = command.color;
            }
            if (command.hat !== undefined) {
                if (!cosmeticsOpen(state, STYLE_LEVEL.hats)) fail('まだ えらべないよ。');
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
                if (!patternOpen(command.pattern, state.mastery?.math ?? 0, state.mastery?.vocab ?? 0)) fail('まだ えらべないよ。');
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
        case 'emblem': {
            // なぞって かざる: a traced letter or number becomes the island flag's picture.
            if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(command.image) || command.image.length > 24000) fail('もういちど なぞってね。');
            if (!/^[0-9A-Za-z]$/.test(command.glyph)) fail('もういちど なぞってね。');
            state.emblem = { image: command.image, glyph: command.glyph };
            break;
        }
        case 'ack-moment': {
            if (state.surprise?.pending?.day === command.day) { discover(state, `moment:${state.surprise.pending.moment}`); delete state.surprise.pending; }
            break;
        }
        case 'flag': {
            if (command.color !== undefined) {
                if (!Number.isInteger(command.color) || command.color < 0 || command.color > 7) fail('いろを えらびなおしてね。');
                state.flagColor = command.color;
            }
            if (command.pattern !== undefined) {
                if (!cosmeticsOpen(state, STYLE_LEVEL.flagPattern)) fail('まだ えらべないよ。');
                if (!Number.isInteger(command.pattern) || command.pattern < 0 || command.pattern >= FLAG_PATTERNS) fail('もようを えらびなおしてね。');
                state.flagPattern = command.pattern;
            }
            break;
        }
    }
    if (state.bridge && !reachableFromHome(state).has(key(bridgeAnchor(state))))
        fail('はしまで いけなくなるよ。まわりを あけてね。');
    return events;
}

/**
 * Applies a child's action once. A repeated intent id (double tap, second tab, a lost
 * commit notice) returns the saved state unchanged.
 */
export function applyIntent(previous: GrowingState, intent: Intent, at?: number, world?: IslandWorld): { state: GrowingState; events: TownEvent[] } {
    if (previous.applied.includes(intent.id)) return { state: previous, events: [] };
    const state = structuredClone(previous);
    if (intent.command.type === 'terrain-edit' || intent.command.type === 'terrain-stroke' || intent.command.type === 'terrain-undo' || intent.command.type === 'terrain-redo') {
        if (!applyTerrainCommand(state, intent.command)) return { state: previous, events: [] };
        const journeyEvents = noteJourney(state, at ?? state.nature.realAt);
        noteDiscoveries(state);
        state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
        return { state, events: journeyEvents };
    }
    world ??= editableIslandWorld(state);
    const events = apply(state, intent.command, world);
    if (terrainOf(state)) world = editableIslandWorld(state);
    // Previously earned time also works for the next seed or a restored route.
    if (['plant', 'place', 'move', 'store', 'unstore', 'pluck', 'expand'].includes(intent.command.type) && state.town.bank > 0)
        events.push(...openTown(state, world));
    noteTownBuilds(state, events);
    noteGuidanceIntent(previous, state, intent.command, intent.id, at);
    const now = at ?? state.nature.realAt;
    if (intent.command.type === 'shared-play') recordSharedPlay(state, intent.command, now, world);
    if (intent.command.type === 'place-used') recordPlaceUse(state, intent.command, now, world);
    if (intent.command.type === 'place-shown') recordPlaceShown(state, intent.command, world);
    events.push(...grantGrowthMilestones(state, now));
    refreshUnlocks(state);
    syncPlaceMilestones(state, now, world);
    events.push(...noteJourney(state, now));
    noteDiscoveries(state);
    state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
    return { state, events };
}

export function canPlace(state: GrowingState, cell: Cell, except?: string, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    if (!onLand(state, cell, world) || world && !hasAuthoredPlacementSupport(world, cell) || !terrainOwnerSupported(state, cell)) return false;
    if (isVacant(state, cell, except, world)) return true;
    const found = occupant(state, cell, except);
    return found?.type === 'plot' && found.spread;
}

/** Preview a home's own blocking cell, rather than pretending it is an open path. */
export function canReachHomePlacement(state: GrowingState, cell: Cell, id?: string, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    if (!canPlace(state, cell, id, world)) return false;
    const preview = structuredClone(state);
    const home = preview.plots.find(p => p.id === id);
    if (home) home.cell = cell;
    else preview.plots.push({ id: 'placement-preview', kind: 'home', cell, stage: 0, plantedAt: 0, growth: 0, origin: 'seed', paid: 0 });
    return isReachable(cell, reachableFromHome(preview, undefined, world), world);
}
