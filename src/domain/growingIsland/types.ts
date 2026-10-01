import type { Cell, ItemKind, LifeItem } from '../islandLife/model';
import type { RoomDecor, WallPatternId, WordGroupId } from './room';
import type { FlowerColor } from './flowers';

export type { Cell, ItemKind };

/** Plots are zones the island builds by itself (spec 52 §3). */
export type SeedKind = 'home' | 'farm' | 'play' | 'wild' | 'market' | 'festival' | 'wonder';
/** Instant landmarks: the current catalog plus the late-game lighthouse (§4, §8). */
/** The current catalog plus the island's own landmarks: the lighthouse and the bandstand (§4). */
export type LandmarkKind = ItemKind | 'lighthouse' | 'bandstand' | 'slide' | 'trampoline' | 'fountain' | 'bakery' | 'postbox';
export const OWN_LANDMARKS: readonly string[] = ['lighthouse', 'bandstand', 'slide', 'trampoline', 'fountain', 'bakery', 'postbox'];
export type PlotStyle = 'water' | 'tree' | 'flower' | 'light' | 'plain';
/**
 * Animal friends, and the island's two children: the girl is always えま and the boy always
 * えいた, one of each per island (spec 52 §7.1). Pokomoko is not a species.
 */
export type Species = 'rabbit' | 'otter' | 'fox' | 'duck' | 'squirrel' | 'hedgehog' | 'bird' | 'girl' | 'boy' | 'penguin' | 'owl' | 'frog';
export type Like = 'flower' | 'water' | 'tree' | 'light' | 'food' | 'play' | 'farm' | 'quiet';
export type Trait = 'lively' | 'mellow' | 'shy' | 'hungry';
export type Character = 'water' | 'tree' | 'flower' | 'farm' | 'light' | 'mixed';
export type Side = 'east' | 'west' | 'south';

export interface Plot {
    id: string;
    kind: SeedKind;
    cell?: Cell;
    /** Town hour when the seed was placed; building waits six town hours from here. */
    plantedAt: number;
    builtAt?: number;
    /** Town hour of the latest stage change; home growth waits from here. */
    stagedAt?: number;
    /** Homes: 0 seed, 1 tent, 2 hut, 3 house, 4 two storeys. Other plots: 0 seed, 1 built. */
    stage: 0 | 1 | 2 | 3 | 4;
    style?: PlotStyle;
    /** Wild plants grow on the nature clock, in the same hour units as flowers. */
    growth: number;
    origin: 'seed' | 'spread';
    paid: number;
    roof?: number;
}

export interface Landmark {
    id: string;
    kind: LandmarkKind;
    cell?: Cell;
    growth: number;
    /** Nature hour when a sapling matured; drives the big tree and the island's lord tree. */
    maturedAt?: number;
    rotation?: 0 | 1 | 2 | 3;
    legacy?: Pick<LifeItem, 'style' | 'foodStage' | 'foodStock' | 'access'>;
    /** The sibling who left this flower during a visit (§13). */
    from?: string;
    /** A flower's colour (§5.1); older flowers without one are pink. */
    color?: FlowerColor;
}

export interface Keepsake { id: string; unitId: string; cell?: Cell }

export interface Variant { color: number; accessory: number; sparkle: boolean }

export interface Visitor { ordinal: number; species: Species; variant: Variant; trait: Trait }

export interface Villager {
    id: string;
    species: Species;
    variant: Variant;
    trait: Trait;
    name?: string;
    /** A plot id, or `pokomoko` for friends who share Pokomoko's house. */
    home: string;
    arrivedAt: number;
    away?: boolean;
    legacyId?: 'rabbit' | 'otter';
    /** Island Lv8 lets children choose clothes colours and Lv9 hats (§8). */
    outfit?: { color?: number; hat?: number };
}

export interface GrowingState {
    rules: 'growing-island-v1';
    seed: string;
    islandName?: string;
    flagColor?: number;
    /** Island Lv7 lets children draw a pattern on the island flag (§8). */
    flagPattern?: number;
    drops: number;
    land: { expanded?: 'east' | 'west'; extra: Side[]; capes: ('east' | 'west')[] };
    plots: Plot[];
    landmarks: Landmark[];
    keepsakes: Keepsake[];
    villagers: Villager[];
    /** The visitor sails in and waits on the pier from `dockAt` (a town hour). */
    pier: { visitor: Visitor; next: Visitor; rolled: number; dockAt: number };
    town: { clock: number; bank: number };
    nature: { hours: number; realAt: number; lastSpread: number; lastMix?: number };
    soil: Record<string, number>;
    genki: { current: number; best: number };
    character: Character;
    unlocked: string[];
    /** Presentation queue: plots to open with a tap and villagers waiting on the boat. */
    unopened: string[];
    arrivals: string[];
    tutorial: 'first-home' | 'done';
    learned: string[];
    /** Completions at or before this time were counted and their ids pruned (§18.1). */
    learnedFloor?: number;
    enrolledAt: number;
    /** Old light is kept untouched until spec 51 chapter 06 decides its conversion. */
    legacyLight?: number;
    /** Learning levels already rewarded with keepsakes; the first sync sets the baseline (§10). */
    mastery?: { math: number; vocab: number };
    /** Flower gifts from siblings' visits that were already received (§13). */
    gifts?: string[];
    /** Flower colours the island has grown, for the flower book (§5.1). */
    flowerBook?: FlowerColor[];
    /** ふしぎの たね waiting to be planted; island levels 3, 5, 7 and 9 bring one each (§3.5). */
    wonderSeeds?: number;
    /** Pokomoko's room: wallpaper drawn with learned words, chosen shapes and rug (§13.1). */
    room?: RoomDecor;
    applied: string[];
    nextId: number;
}

export type Command =
    | { type: 'plant'; kind: SeedKind; cell: Cell }
    | { type: 'place'; kind: LandmarkKind; cell: Cell; color?: FlowerColor }
    | { type: 'move'; id: string; cell: Cell }
    | { type: 'store'; id: string }
    | { type: 'unstore'; id: string; cell: Cell }
    | { type: 'pluck'; id: string }
    | { type: 'expand'; side: Side }
    | { type: 'name'; target: string; name: string }
    | { type: 'paint'; target: string; color: number }
    | { type: 'open'; id: string }
    | { type: 'open-all' }
    | { type: 'disembark'; id: string }
    | { type: 'away'; id: string; away: boolean }
    | { type: 'dress'; id: string; color?: number; hat?: number }
    | { type: 'flag'; color?: number; pattern?: number }
    | { type: 'decorate'; pattern?: WallPatternId; rug?: number; hidden?: WordGroupId[] };

export type TownEvent =
    | { type: 'built'; plotId: string }
    | { type: 'grew'; plotId: string; stage: number }
    | { type: 'arrived'; villagerId: string }
    | { type: 'level'; level: number }
    | { type: 'character'; character: Character }
    | { type: 'unlocked'; keys: string[] }
    | { type: 'blocked'; reason: 'full' | 'food' | 'unreachable'; plotId?: string }
    | { type: 'boat'; hoursLeft: number }
    | { type: 'keepsake'; unitId: string }
    | { type: 'wonder-seed' }
    | { type: 'gift'; from: string; landmarkId?: string }
    | { type: 'moment'; moment: Moment; cell?: Cell }
    | { type: 'quiet' };

/** Small surprises of the day (§11.2). Presentation only: none of them changes the island. */
export type Moment = 'rainbow' | 'friends' | 'butterflies' | 'guest-water' | 'guest-grove' | 'whale' | 'rainbow-bird' | 'moon-rabbit';

export type NatureEvent =
    | { type: 'bloomed'; id: string }
    | { type: 'matured'; id: string }
    | { type: 'big-tree'; id: string }
    | { type: 'lord-tree'; id: string }
    | { type: 'spread'; plotId: string }
    | { type: 'mixed'; id: string; color: FlowerColor }
    | { type: 'new-color'; color: FlowerColor };
