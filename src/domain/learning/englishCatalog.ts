import { ENGLISH_WORDS } from '../english/words';
import type { LearningItemMapping, LearningUnitDefinition } from './types';

/** Each saved item identifies one existing lexical sense, including repeated senses. */
export const ENGLISH_LEARNING_UNITS: readonly LearningUnitDefinition[] = ENGLISH_WORDS.map(word => ({
    id: `vocab.recognition.${word.id}`,
    subject: 'vocab',
    label: `${word.surface ?? word.id}：${word.japanese}`,
    strand: 'vocabulary-recognition',
    itemIds: [word.id],
    prerequisites: [],
    suggestedPrerequisites: [],
    availability: 'existing',
}));

/** A correct translation choice is evidence of recognition, not listening or production. */
export const ENGLISH_ITEM_MAPPINGS: readonly LearningItemMapping[] = ENGLISH_WORDS.map(word => ({
    itemId: word.id,
    subject: 'vocab',
    unitId: `vocab.recognition.${word.id}`,
    representation: 'recognition',
    legacyLevel: word.level,
    variants: ['default'],
}));

export interface EnglishCatalogInventory {
    readonly itemCount: number;
    readonly unitCount: number;
    readonly distinctSpellingCount: number;
    readonly legacyCategoryCount: number;
    readonly legacyLevels: readonly { readonly level: number; readonly itemCount: number }[];
    readonly legacyCategories: readonly { readonly category: string; readonly itemCount: number }[];
}

/** Inventory metadata only: legacy levels and categories are not validated proficiency bands. */
export function getEnglishCatalogInventory(): EnglishCatalogInventory {
    const levelCounts = new Map<number, number>();
    const categoryCounts = new Map<string, number>();
    for (const word of ENGLISH_WORDS) {
        levelCounts.set(word.level, (levelCounts.get(word.level) ?? 0) + 1);
        categoryCounts.set(word.category, (categoryCounts.get(word.category) ?? 0) + 1);
    }

    return {
        itemCount: ENGLISH_ITEM_MAPPINGS.length,
        unitCount: ENGLISH_LEARNING_UNITS.length,
        distinctSpellingCount: new Set(ENGLISH_WORDS.map(word => word.surface ?? word.id)).size,
        legacyCategoryCount: categoryCounts.size,
        legacyLevels: [...levelCounts].sort(([a], [b]) => a - b)
            .map(([level, itemCount]) => ({ level, itemCount })),
        // Preserve catalog encounter order, independent of the runtime locale.
        legacyCategories: [...categoryCounts].map(([category, itemCount]) => ({ category, itemCount })),
    };
}
