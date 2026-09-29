import type { Character, Like, SeedKind, Species, LandmarkKind } from './types';

/** Starting values from spec 52. Tune them in play, not by editing the experience rules. */
export const RULES = {
    dropsPerCompletion: 2,
    townHoursPerCompletion: 4,
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
    boatBaseHours: 24,
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
} as const;

export const SEED_PRICE: Record<SeedKind, number> = { home: 4, farm: 4, play: 6, wild: 1, market: 8, festival: 10 };

export const LANDMARK_PRICE: Partial<Record<LandmarkKind, number>> = {
    flower: 2, bench: 4, 'water-bowl': 4, sapling: 4, 'water-channel': 2, 'picnic-table': 8,
    planter: 6, swing: 6, lantern: 8, fence: 4, lighthouse: 16,
};

/** Land steps 1-3 keep the current 12/24/48 contract; capes open with the island level. */
export const LAND_PRICE = [12, 24, 48, 72, 96] as const;
export const CAPE_LEVEL = [5, 6] as const;

export const LIKES: Record<Species, readonly [Like, Like]> = {
    rabbit: ['flower', 'play'], otter: ['water', 'food'], fox: ['tree', 'light'], duck: ['water', 'play'],
    squirrel: ['tree', 'food'], hedgehog: ['farm', 'quiet'], bird: ['flower', 'light'],
};

export const FAVORED: Record<Exclude<Character, 'mixed'>, readonly Species[]> = {
    water: ['otter', 'duck'], tree: ['fox', 'squirrel'], flower: ['rabbit', 'bird'],
    farm: ['hedgehog', 'rabbit'], light: ['bird', 'fox'],
};

export const SPECIES: readonly Species[] = ['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'bird'];
/**
 * Species that can sail in today. The duck, squirrel, hedgehog and bird join once their
 * art exists (spec 52 §7.1); a boat never shows a friend the island cannot draw.
 */
export const AVAILABLE_SPECIES: readonly Species[] = ['rabbit', 'otter', 'fox'];

/** Unlock keys are `seed:<kind>` and `landmark:<kind>`. Owned items are always placeable. */
export const UNLOCKS: readonly { key: string; villagers?: number; level?: number }[] = [
    { key: 'seed:home' }, { key: 'seed:wild' },
    { key: 'landmark:flower' }, { key: 'landmark:bench' }, { key: 'landmark:water-bowl' },
    { key: 'seed:farm', villagers: 1 }, { key: 'landmark:sapling', villagers: 1 }, { key: 'landmark:water-channel', villagers: 1 },
    { key: 'landmark:picnic-table', villagers: 2 }, { key: 'landmark:planter', villagers: 2 },
    { key: 'seed:play', level: 2 }, { key: 'landmark:swing', level: 2 },
    { key: 'landmark:lantern', level: 3 }, { key: 'landmark:fence', level: 3 },
    { key: 'seed:market', level: 4 }, { key: 'seed:festival', level: 5 }, { key: 'landmark:lighthouse', level: 6 },
];

export const FOOD_SUPPORT: Partial<Record<SeedKind, number>> = { farm: 2, market: 4 };
export const PLAY_SUPPORT: Partial<Record<SeedKind | LandmarkKind, number>> = {
    play: 4, festival: 6, bench: 1, swing: 2, sandbox: 2, 'garden-hut': 2, library: 2,
};
