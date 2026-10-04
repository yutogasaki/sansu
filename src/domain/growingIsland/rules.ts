import type { Character, Like, SeedKind, Species, LandmarkKind, Trait, Variant } from './types';

/** Starting values from spec 52. Tune them in play, not by editing the experience rules. */
export const RULES = {
    dropsPerCompletion: 2,
    townHoursPerCompletion: 2,
    buildHours: 6,
    dawnHour: 6,
    /** Homes stay small so each new friend usually needs a new seed: the core loop. */
    homeCapacity: [0, 1, 1, 2, 2] as const,
    /** Town hours after building, comfort average and island level for each home stage. */
    homeGrowth: [
        undefined,
        { hours: 24, comfort: 1, level: 2 },
        { hours: 48, comfort: 2, level: 4 },
        { hours: 96, comfort: 3, level: 6 },
    ] as const,
    /** Pokomoko's basket feeds the first two friends; farms feed the rest. */
    baseFood: 2,
    basePlay: 2,
    /** The next boat docks this many town hours after the previous friend arrived. */
    boatBaseHours: 48,
    boatHoursPerVillager: 2,
    likeRadius: 3,
    quietRadius: 2,
    styleRadius: 2,
    genkiLevels: [0, 3, 8, 15, 25, 40, 60, 85, 115, 150] as const,
    characterShare: .3,
    characterMinimum: 6,
    favoredWeight: 3,
    rareBase: .05,
    rareBonus: .10,
    rareRichness: 40,
    natureHourCap: 24 * 7,
    soilBase: .20,
    soilHalfLife: 3,
    spreadEvery: 12,
    spreadChance: .5,
    spreadMoisture: .35,
    wildShare: .4,
    bigTreeHours: 24 * 7,
    lordTreeHours: 24 * 30,
    appliedMemory: 500,
    /** Completion ids kept for de-duplication; older ones collapse into a time floor. */
    learnedMemory: 3000,
} as const;

/** Twenty completions buy one home/farm; small decoration stays within one ten-question block. */
export const SEED_PRICE: Record<SeedKind, number> = { home: 40, farm: 40, play: 60, wild: 10, market: 120, festival: 160, wonder: 0 };
/** Island levels that each bring one ふしぎの たね (§3.5). */
export const WONDER_LEVELS = [3, 5, 7, 9] as const;

export const LANDMARK_PRICE: Partial<Record<LandmarkKind, number>> = {
    flower: 10, bench: 20, 'water-bowl': 20, sapling: 20, 'water-channel': 10, 'picnic-table': 40,
    planter: 30, swing: 30, lantern: 40, fence: 20, lighthouse: 80, bandstand: 30, slide: 40, trampoline: 40, fountain: 50, bakery: 70, postbox: 20,
};

/** Land competes with purchases over weeks; acquired cells and cape unlocks stay intact. */
export const LAND_PRICE = [120, 240, 480, 720, 960] as const;
export const DISTRICT_PRICE_STEP = 240;
export const CAPE_LEVEL = [5, 6] as const;

export const LIKES: Record<Species, readonly [Like, Like]> = {
    rabbit: ['flower', 'play'], otter: ['water', 'food'], fox: ['tree', 'light'], duck: ['water', 'play'],
    squirrel: ['tree', 'food'], hedgehog: ['farm', 'quiet'], bird: ['flower', 'light'],
    girl: ['water', 'play'], boy: ['tree', 'food'],
    penguin: ['water', 'quiet'], owl: ['tree', 'light'], frog: ['water', 'flower'],
};

/** Rare friends: seldom on the boat, a little more often on an island of their own kind (§7.1). */
export const RARE: Partial<Record<Species, { weight: number; home: Character }>> = {
    penguin: { weight: .35, home: 'water' }, owl: { weight: .35, home: 'tree' }, frog: { weight: .35, home: 'flower' },
};

export const likesOf = (friend: { species: Species }) => LIKES[friend.species];

/**
 * The island's two children. Each island meets them once, on the second and third boats,
 * in an order that differs between islands (§7.2); their names and looks never change.
 */
export const KIDS = ['girl', 'boy'] as const;
export const KID: Record<(typeof KIDS)[number], { name: string; trait: Trait; variant: Variant }> = {
    girl: { name: 'えま', trait: 'lively', variant: { color: 0, accessory: 0, sparkle: false } },
    boy: { name: 'えいた', trait: 'lively', variant: { color: 1, accessory: 1, sparkle: false } },
};
export const isKid = (species: Species): species is (typeof KIDS)[number] => species === 'girl' || species === 'boy';

export const FAVORED: Record<Exclude<Character, 'mixed'>, readonly Species[]> = {
    water: ['otter', 'duck'], tree: ['fox', 'squirrel'], flower: ['rabbit', 'bird'],
    farm: ['hedgehog', 'rabbit'], light: ['bird', 'fox'],
};

export const SPECIES: readonly Species[] = ['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'bird', 'girl', 'boy', 'penguin', 'owl', 'frog'];
/** Everyone who can sail in. A boat never shows a friend the island cannot draw. */
export const AVAILABLE_SPECIES: readonly Species[] = SPECIES;

/** Unlock keys are `seed:<kind>` and `landmark:<kind>`. Owned items are always placeable. */
export const UNLOCKS: readonly { key: string; villagers?: number; level?: number }[] = [
    { key: 'seed:home' }, { key: 'seed:wild' },
    { key: 'landmark:flower' }, { key: 'landmark:bench' }, { key: 'landmark:water-bowl' },
    { key: 'seed:farm', villagers: 1 }, { key: 'landmark:sapling', villagers: 1 }, { key: 'landmark:water-channel', villagers: 1 },
    { key: 'landmark:picnic-table', villagers: 2 }, { key: 'landmark:planter', villagers: 2 },
    { key: 'seed:play', level: 2 }, { key: 'landmark:swing', level: 2 }, { key: 'landmark:bandstand', level: 4 }, { key: 'landmark:slide', level: 6 }, { key: 'landmark:postbox', villagers: 3 },
    { key: 'landmark:lantern', level: 3 }, { key: 'landmark:fence', level: 3 }, { key: 'landmark:trampoline', level: 7 }, { key: 'landmark:fountain', level: 8 },
    { key: 'landmark:bakery', level: 4 },
    { key: 'seed:market', level: 4 }, { key: 'seed:festival', level: 5 }, { key: 'landmark:lighthouse', level: 6 },
];

/** Island levels that open the cosmetic choices of §8. */
export const STYLE_LEVEL = { flagPattern: 7, clothes: 8, hats: 9, cardFrame: 10 } as const;
export const FLAG_PATTERNS = 5;
export const HATS = 5;

export const FOOD_SUPPORT: Partial<Record<SeedKind, number>> = { farm: 2, market: 4 };
export const PLAY_SUPPORT: Partial<Record<SeedKind | LandmarkKind, number>> = {
    play: 4, festival: 6, wonder: 3, bench: 1, swing: 2, bandstand: 2, slide: 2, trampoline: 2, postbox: 1, sandbox: 2, 'garden-hut': 2, library: 2,
};
