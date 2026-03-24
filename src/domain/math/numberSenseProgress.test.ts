import { describe, expect, it } from "vitest";
import { selectBigSmallPattern, selectColorRecognitionPattern, selectComposeFilledCount, selectCount10Target, selectCount5Target, selectCountOrderPattern, selectCountReadPattern, selectDotCountTarget, selectHeightComparePattern, selectLengthComparePattern, selectOneLessCount, selectOneMoreCount, selectOneToOneCount, selectOrdinalPattern, selectPairRecognitionPattern, selectPatternCopyPattern, selectSameOrDifferentPattern, selectSameCountMatchPattern, selectShapeRecognitionPattern, selectShareEqualPattern, selectSortByAttributePattern, selectSpatialWordsPattern, selectTwoLessCount, selectTwoMoreCount, selectWeightComparePattern, selectWhichIsEmptyCount, selectWhichMorePattern, selectZeroConceptCount } from "./numberSenseProgress";

describe("numberSenseProgress", () => {
    it("starts same_count_match with easy fixed patterns", () => {
        expect(selectSameCountMatchPattern(0)).toEqual({ target: 1, options: [1, 3, 5] });
        expect(selectSameCountMatchPattern(1)).toEqual({ target: 2, options: [4, 2, 5] });
    });

    it("starts count_read with small numbers before expanding", () => {
        expect(selectCountReadPattern(0)).toEqual({ target: 1, options: [1, 2, 3] });
        expect(selectCountReadPattern(3)).toEqual({ target: 4, options: [4, 5, 6] });
        expect(selectCountReadPattern(8)).toEqual({ target: 9, options: [8, 9, 10] });
    });

    it("starts count_5, count_dot, count_10, and count_order from easy fixed values", () => {
        expect(selectCount5Target(0)).toBe(1);
        expect(selectDotCountTarget(0)).toBe(1);
        expect(selectCount10Target(0)).toBe(6);
        expect(selectCountOrderPattern(0)).toEqual({ values: [1, 4, 7] });
    });

    it("starts which_more and recognition items with easy fixed patterns", () => {
        expect(selectWhichMorePattern(0)).toEqual({ left: 4, right: 1 });
        expect(selectShapeRecognitionPattern(0)).toEqual({ target: "まる", options: ["まる", "しかく"] });
        expect(selectColorRecognitionPattern(0)).toEqual({ target: "あか", options: ["あか", "あお"] });
        expect(selectPairRecognitionPattern(0)).toEqual({ target: "🍎", options: ["🍎", "🐶"] });
    });

    it("starts compose_5 and compose_10 from nearly-complete frames", () => {
        expect(selectComposeFilledCount("compose_5", 0)).toBe(4);
        expect(selectComposeFilledCount("compose_10", 0)).toBe(9);
    });

    it("starts share_equal with easy exact splits", () => {
        expect(selectShareEqualPattern(0)).toEqual({ total: 2, groups: 2 });
        expect(selectShareEqualPattern(1)).toEqual({ total: 4, groups: 2 });
    });

    it("starts ordinal_small with easy first/last prompts", () => {
        expect(selectOrdinalPattern(0)).toEqual({ length: 3, targetIndex: 0, prompt: "ひだりから 1ばんめは どれ？" });
        expect(selectOrdinalPattern(1)).toEqual({ length: 3, targetIndex: 2, prompt: "ひだりから さいごは どれ？" });
    });

    it("starts pattern_copy with easy alternating patterns", () => {
        expect(selectPatternCopyPattern(0)).toEqual({ visible: [0, 1, 0, 1], answerIndex: 0 });
        expect(selectPatternCopyPattern(1)).toEqual({ visible: [1, 0, 1, 0], answerIndex: 1 });
    });

    it("starts length_compare with large gaps", () => {
        expect(selectLengthComparePattern(0)).toEqual({ left: 7, right: 3 });
        expect(selectLengthComparePattern(1)).toEqual({ left: 3, right: 7 });
    });

    it("starts height_compare and weight_compare with large gaps", () => {
        expect(selectHeightComparePattern(0)).toEqual({ left: 7, right: 3 });
        expect(selectWeightComparePattern(0)).toEqual({ left: 8, right: 3 });
    });

    it("starts one_to_one_match and zero_concept from small counts", () => {
        expect(selectOneToOneCount(0)).toBe(1);
        expect(selectZeroConceptCount(0)).toBe(1);
    });

    it("starts one_more and one_less from simple counts", () => {
        expect(selectOneMoreCount(0)).toBe(1);
        expect(selectOneLessCount(0)).toBe(2);
    });

    it("starts two_more and two_less from simple counts", () => {
        expect(selectTwoMoreCount(0)).toBe(1);
        expect(selectTwoLessCount(0)).toBe(3);
    });

    it("starts sort_by_attribute and which_is_empty with easy patterns", () => {
        expect(selectSortByAttributePattern(0)).toEqual({ setIndex: 0, targetBucket: 0 });
        expect(selectWhichIsEmptyCount(0)).toBe(0);
    });

    it("starts big_small_compare and same_or_different with easy patterns", () => {
        expect(selectBigSmallPattern(0)).toEqual({ leftScale: 1.8, rightScale: 1.0, largerIndex: 0 });
        expect(selectSameOrDifferentPattern(0)).toEqual({ isSame: true });
    });

    it("starts spatial_words with simple up/down prompts", () => {
        expect(selectSpatialWordsPattern(0)).toEqual({
            mode: "pair",
            orientation: "column",
            targetIndex: 0,
            answer: "うえ",
            choices: ["うえ", "した"],
        });
        expect(selectSpatialWordsPattern(1)).toEqual({
            mode: "pair",
            orientation: "column",
            targetIndex: 1,
            answer: "した",
            choices: ["うえ", "した"],
        });
    });

    it("expands spatial_words to front/back and inside/outside", () => {
        expect(selectSpatialWordsPattern(4)).toEqual({
            mode: "front-back",
            answer: "まえ",
            choices: ["まえ", "うしろ"],
        });
        expect(selectSpatialWordsPattern(6)).toEqual({
            mode: "inside-outside",
            answer: "なか",
            choices: ["なか", "そと"],
        });
    });

    it("keeps random compose values inside valid ranges", () => {
        const compose5 = selectComposeFilledCount("compose_5", 99);
        const compose10 = selectComposeFilledCount("compose_10", 99);

        expect(compose5).toBeGreaterThanOrEqual(1);
        expect(compose5).toBeLessThanOrEqual(4);
        expect(compose10).toBeGreaterThanOrEqual(1);
        expect(compose10).toBeLessThanOrEqual(9);
    });

    it("keeps random share_equal patterns divisible", () => {
        const pattern = selectShareEqualPattern(99);
        expect(pattern.total % pattern.groups).toBe(0);
    });

    it("keeps random count_read options inside range and including the target", () => {
        const pattern = selectCountReadPattern(99);
        expect(pattern.target).toBeGreaterThanOrEqual(1);
        expect(pattern.target).toBeLessThanOrEqual(10);
        expect(pattern.options).toHaveLength(3);
        expect(pattern.options).toContain(pattern.target);
    });

    it("keeps random which_more and recognition patterns inside supported ranges", () => {
        const whichMore = selectWhichMorePattern(99);
        const shape = selectShapeRecognitionPattern(99);
        const color = selectColorRecognitionPattern(99);
        const pair = selectPairRecognitionPattern(99);

        expect(whichMore.left).not.toBe(whichMore.right);
        expect(whichMore.left).toBeGreaterThanOrEqual(1);
        expect(whichMore.right).toBeLessThanOrEqual(6);
        expect(shape.options).toContain(shape.target);
        expect(shape.options.length).toBeGreaterThanOrEqual(2);
        expect(color.options).toContain(color.target);
        expect(color.options.length).toBeGreaterThanOrEqual(2);
        expect(pair.options).toContain(pair.target);
        expect(pair.options.length).toBeGreaterThanOrEqual(2);
    });

    it("keeps random count targets and count_order patterns inside supported ranges", () => {
        const count5 = selectCount5Target(99);
        const dots = selectDotCountTarget(99);
        const count10 = selectCount10Target(99);
        const order = selectCountOrderPattern(99);
        const sorted = [...order.values].sort((a, b) => a - b);

        expect(count5).toBeGreaterThanOrEqual(1);
        expect(count5).toBeLessThanOrEqual(5);
        expect(dots).toBeGreaterThanOrEqual(1);
        expect(dots).toBeLessThanOrEqual(10);
        expect(count10).toBeGreaterThanOrEqual(1);
        expect(count10).toBeLessThanOrEqual(10);
        expect(order.values).toHaveLength(3);
        expect(new Set(order.values).size).toBe(3);
        expect(sorted[0]).toBeGreaterThanOrEqual(1);
        expect(sorted[2]).toBeLessThanOrEqual(9);
    });

    it("keeps random ordinal patterns within supported lengths", () => {
        const pattern = selectOrdinalPattern(99);
        expect(pattern.length).toBeGreaterThanOrEqual(3);
        expect(pattern.length).toBeLessThanOrEqual(4);
        expect(pattern.targetIndex).toBeGreaterThanOrEqual(0);
        expect(pattern.targetIndex).toBeLessThan(pattern.length);
    });

    it("keeps random pattern_copy answers within the shown palette", () => {
        const pattern = selectPatternCopyPattern(99);
        const uniqueCount = Math.max(...pattern.visible, pattern.answerIndex) + 1;
        expect(uniqueCount).toBeGreaterThanOrEqual(2);
        expect(uniqueCount).toBeLessThanOrEqual(3);
    });

    it("keeps random length_compare pairs distinct", () => {
        const pattern = selectLengthComparePattern(99);
        expect(pattern.left).not.toBe(pattern.right);
        expect(pattern.left).toBeGreaterThanOrEqual(2);
        expect(pattern.left).toBeLessThanOrEqual(8);
        expect(pattern.right).toBeGreaterThanOrEqual(2);
        expect(pattern.right).toBeLessThanOrEqual(8);
    });

    it("keeps random height_compare and weight_compare pairs distinct", () => {
        const height = selectHeightComparePattern(99);
        const weight = selectWeightComparePattern(99);
        expect(height.left).not.toBe(height.right);
        expect(weight.left).not.toBe(weight.right);
        expect(height.left).toBeGreaterThanOrEqual(2);
        expect(height.right).toBeLessThanOrEqual(8);
        expect(weight.left).toBeGreaterThanOrEqual(2);
        expect(weight.right).toBeLessThanOrEqual(8);
    });

    it("keeps random one_to_one_match and zero_concept counts in range", () => {
        const oneToOne = selectOneToOneCount(99);
        const zero = selectZeroConceptCount(99);
        expect(oneToOne).toBeGreaterThanOrEqual(1);
        expect(oneToOne).toBeLessThanOrEqual(5);
        expect(zero).toBeGreaterThanOrEqual(1);
        expect(zero).toBeLessThanOrEqual(5);
    });

    it("keeps random one_more and one_less counts in range", () => {
        const oneMore = selectOneMoreCount(99);
        const oneLess = selectOneLessCount(99);
        expect(oneMore).toBeGreaterThanOrEqual(1);
        expect(oneMore).toBeLessThanOrEqual(8);
        expect(oneLess).toBeGreaterThanOrEqual(2);
        expect(oneLess).toBeLessThanOrEqual(9);
    });

    it("keeps random two_more and two_less counts in range", () => {
        const twoMore = selectTwoMoreCount(99);
        const twoLess = selectTwoLessCount(99);
        expect(twoMore).toBeGreaterThanOrEqual(1);
        expect(twoMore).toBeLessThanOrEqual(7);
        expect(twoLess).toBeGreaterThanOrEqual(3);
        expect(twoLess).toBeLessThanOrEqual(9);
    });

    it("keeps random sort_by_attribute and which_is_empty values in range", () => {
        const sort = selectSortByAttributePattern(99);
        const empty = selectWhichIsEmptyCount(99);
        expect(sort.setIndex).toBeGreaterThanOrEqual(0);
        expect(sort.setIndex).toBeLessThanOrEqual(3);
        expect(sort.targetBucket).toBeGreaterThanOrEqual(0);
        expect(sort.targetBucket).toBeLessThanOrEqual(1);
        expect(empty).toBeGreaterThanOrEqual(0);
        expect(empty).toBeLessThanOrEqual(5);
    });

    it("keeps random big_small_compare and same_or_different values in range", () => {
        const bigSmall = selectBigSmallPattern(99);
        const sameDiff = selectSameOrDifferentPattern(99);
        expect(bigSmall.leftScale).not.toBe(bigSmall.rightScale);
        expect(bigSmall.largerIndex).toBeGreaterThanOrEqual(0);
        expect(bigSmall.largerIndex).toBeLessThanOrEqual(1);
        expect(typeof sameDiff.isSame).toBe("boolean");
    });

    it("keeps random spatial_words values in range", () => {
        const spatial = selectSpatialWordsPattern(99);
        expect(["pair", "front-back", "inside-outside"]).toContain(spatial.mode);
        if (spatial.mode === "pair") {
            expect(["row", "column"]).toContain(spatial.orientation);
            expect(spatial.targetIndex).toBeGreaterThanOrEqual(0);
            expect(spatial.targetIndex).toBeLessThanOrEqual(1);
        }
        if (spatial.mode !== "pair") {
            expect(spatial.orientation).toBeUndefined();
            expect(spatial.targetIndex).toBeUndefined();
        }
        expect(["うえ", "した", "ひだり", "みぎ", "まえ", "うしろ", "なか", "そと"]).toContain(spatial.answer);
    });
});
