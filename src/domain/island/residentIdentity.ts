/** Shared finite identity and free settings. This leaf has no world or storage dependency. */
export const ISLAND_RESIDENT_IDS = ['otter', 'rabbit', 'fox'] as const;
export type IslandResidentId = typeof ISLAND_RESIDENT_IDS[number];
export const ISLAND_EMBLEMS = ['leaf', 'star', 'flower', 'wave'] as const;
export type IslandEmblem = typeof ISLAND_EMBLEMS[number];
export const ISLAND_AMBIENCES = ['off', 'breeze', 'brook', 'evening'] as const;
export type IslandAmbience = typeof ISLAND_AMBIENCES[number];
export const ISLAND_RESIDENT_LOOKS = ['original', 'scarf', 'cap'] as const;
export type IslandResidentLook = typeof ISLAND_RESIDENT_LOOKS[number];
