import { describe, expect, it } from 'vitest';
import { ENGLISH_WORDS, getWord } from '../english/words';
import { ENGLISH_ITEM_MAPPINGS, ENGLISH_LEARNING_UNITS, getEnglishCatalogInventory } from './englishCatalog';

describe('English learning unit inventory', () => {
    it('maps all 1,184 saved item IDs exactly once without moving their legacy level', () => {
        expect(ENGLISH_ITEM_MAPPINGS).toHaveLength(1184);
        expect(ENGLISH_LEARNING_UNITS).toHaveLength(1184);
        const mappings = new Map(ENGLISH_ITEM_MAPPINGS.map(mapping => [mapping.itemId, mapping]));
        const units = new Map(ENGLISH_LEARNING_UNITS.map(unit => [unit.id, unit]));
        expect(mappings.size).toBe(1184);
        expect(units.size).toBe(1184);
        expect([...mappings.keys()]).toEqual(ENGLISH_WORDS.map(word => word.id));

        for (const word of ENGLISH_WORDS) {
            const mapping = mappings.get(word.id)!;
            expect(mapping.legacyLevel, word.id).toBe(word.level);
            expect(mapping.unitId, word.id).toBe(`vocab.recognition.${word.id}`);
            const unit = units.get(mapping.unitId)!;
            expect(unit.itemIds, word.id).toEqual([word.id]);
            expect(unit.label, word.id).toBe(`${word.surface ?? word.id}：${word.japanese}`);
            expect(unit.availability, word.id).toBe('existing');
        }
    });

    it('keeps every same-spelling item independent, including the repeated properly sense', () => {
        const grouped = new Map<string, string[]>();
        for (const word of ENGLISH_WORDS) {
            const surface = word.surface ?? word.id;
            grouped.set(surface, [...(grouped.get(surface) ?? []), word.id]);
        }
        const repeatedSpellings = [...grouped.values()].filter(ids => ids.length > 1);
        expect(repeatedSpellings).toHaveLength(11);
        for (const ids of repeatedSpellings) {
            const units = ENGLISH_ITEM_MAPPINGS.filter(mapping => ids.includes(mapping.itemId));
            expect(new Set(units.map(mapping => mapping.unitId)).size).toBe(ids.length);
        }
        expect(ENGLISH_LEARNING_UNITS.find(unit => unit.id === 'vocab.recognition.orange_lv2')?.label)
            .toBe('orange：オレンジいろ');
        expect(ENGLISH_LEARNING_UNITS.find(unit => unit.id === 'vocab.recognition.properly')?.itemIds)
            .toEqual(['properly']);
        expect(ENGLISH_LEARNING_UNITS.find(unit => unit.id === 'vocab.recognition.properly_lv18')?.itemIds)
            .toEqual(['properly_lv18']);
    });

    it('describes only recognition evidence and infers no other modality or prerequisites', () => {
        expect(new Set(ENGLISH_ITEM_MAPPINGS.map(mapping => mapping.subject))).toEqual(new Set(['vocab']));
        expect(new Set(ENGLISH_ITEM_MAPPINGS.map(mapping => mapping.representation)))
            .toEqual(new Set(['recognition']));
        expect(new Set(ENGLISH_LEARNING_UNITS.map(unit => unit.strand)))
            .toEqual(new Set(['vocabulary-recognition']));
        for (const mapping of ENGLISH_ITEM_MAPPINGS) {
            expect(mapping.variants).toEqual(['default']);
        }
        for (const unit of ENGLISH_LEARNING_UNITS) {
            expect(unit.subject).toBe('vocab');
            expect(unit.prerequisites).toEqual([]);
            expect(unit.suggestedPrerequisites).toEqual([]);
        }
    });

    it('reports legacy inventory separately from proposed learning units', () => {
        const inventory = getEnglishCatalogInventory();
        expect(inventory.itemCount).toBe(1184);
        expect(inventory.unitCount).toBe(1184);
        expect(inventory.distinctSpellingCount).toBe(1173);
        expect(inventory.legacyCategoryCount).toBe(49);
        expect(inventory.legacyLevels.map(entry => entry.level))
            .toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
        expect(inventory.legacyLevels.map(entry => entry.itemCount))
            .toEqual([60, 59, 60, 60, 60, 60, 60, 59, 60, 60, 60, 60, 60, 60, 60, 59, 60, 60, 60, 47]);
        expect(inventory.legacyCategories).toHaveLength(49);
        expect(inventory.legacyCategories.reduce((sum, category) => sum + category.itemCount, 0)).toBe(1184);
        expect(inventory.legacyCategories.some(entry => entry.category === '食べ物')).toBe(true);
        expect(inventory.legacyCategories.some(entry => entry.category === '形容詞')).toBe(true);
    });

    it('aligns the corrected kana with the existing kanji meaning without replacing item IDs', () => {
        expect(getWord('positive')).toMatchObject({ id: 'positive', level: 12, japanese: 'まえむきな', japaneseKanji: '前向きな' });
        expect(getWord('local')).toMatchObject({ id: 'local', level: 14, japanese: 'じもとの', japaneseKanji: '地元の' });
    });
});
