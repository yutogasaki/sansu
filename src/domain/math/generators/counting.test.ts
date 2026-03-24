import { describe, expect, it } from "vitest";
import { generators } from "./counting";

describe("counting generators visuals", () => {
    it("count_10 uses a single-items ten-frame visual", () => {
        const problem = generators.count_10();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(10);
        }
    });

    it("count_dot uses a single-items dot visual", () => {
        const problem = generators.count_dot();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.group.emoji).toBe("●");
        }
    });

    it("count_which_more uses comparison visuals and choice labels without numeric hints", () => {
        const problem = generators.count_which_more();
        expect(problem.questionVisual?.kind).toBe("comparison-items");
        expect(problem.inputConfig?.choices?.every(choice => !/\d/.test(choice.label))).toBe(true);
    });

    it("one_more uses an addition visual", () => {
        const problem = generators.one_more();
        expect(problem.questionVisual?.kind).toBe("addition-items");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[1]?.count).toBe(1);
        }
    });

    it("two_more uses an addition visual with two added items", () => {
        const problem = generators.two_more();
        expect(problem.questionVisual?.kind).toBe("addition-items");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[1]?.count).toBe(2);
        }
    });

    it("count_order uses item-order visuals", () => {
        const problem = generators.count_order();
        expect(problem.questionVisual?.kind).toBe("item-order");
        if (problem.questionVisual?.kind === "item-order") {
            expect(problem.questionVisual.groups).toHaveLength(3);
        }
    });

    it("ordinal_small uses an ordinal-row visual", () => {
        const problem = generators.ordinal_small();
        expect(problem.questionVisual?.kind).toBe("ordinal-row");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "ordinal-row") {
            expect(problem.questionVisual.items.length).toBeGreaterThanOrEqual(3);
        }
    });

    it("pattern_copy uses an ordinal-row visual with a trailing placeholder", () => {
        const problem = generators.pattern_copy();
        expect(problem.questionVisual?.kind).toBe("ordinal-row");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "ordinal-row") {
            expect(problem.questionVisual.showPlaceholder).toBe(true);
        }
    });

    it("length_compare uses a length-compare visual", () => {
        const problem = generators.length_compare();
        expect(problem.questionVisual?.kind).toBe("length-compare");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "length-compare") {
            expect(problem.questionVisual.bars).toHaveLength(2);
            expect(problem.questionVisual.bars[0]?.length).not.toBe(problem.questionVisual.bars[1]?.length);
        }
    });

    it("height_compare uses a vertical length-compare visual", () => {
        const problem = generators.height_compare();
        expect(problem.questionVisual?.kind).toBe("length-compare");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "length-compare") {
            expect(problem.questionVisual.direction).toBe("vertical");
            expect(problem.questionVisual.bars).toHaveLength(2);
        }
    });

    it("weight_compare uses a balance visual", () => {
        const problem = generators.weight_compare();
        expect(problem.questionVisual?.kind).toBe("balance-compare");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "balance-compare") {
            expect(problem.questionVisual.items).toHaveLength(2);
            expect(problem.questionVisual.items[0]?.weight).not.toBe(problem.questionVisual.items[1]?.weight);
        }
    });

    it("big_small_compare uses an item-pair visual", () => {
        const problem = generators.big_small_compare();
        expect(problem.questionVisual?.kind).toBe("item-pair");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "item-pair") {
            expect(problem.questionVisual.items).toHaveLength(2);
            expect(problem.questionVisual.items[0]?.scale).not.toBe(problem.questionVisual.items[1]?.scale);
        }
    });

    it("same_or_different uses an item-pair visual", () => {
        const problem = generators.same_or_different();
        expect(problem.questionVisual?.kind).toBe("item-pair");
        expect(problem.inputType).toBe("choice");
    });

    it("spatial_words starts with an oriented item-pair visual", () => {
        const problem = generators.spatial_words({
            profile: { mathSkills: { spatial_words: { totalAnswers: 0 } } },
        } as any);
        expect(problem.questionVisual?.kind).toBe("item-pair");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "item-pair") {
            expect(["row", "column"]).toContain(problem.questionVisual.orientation);
        }
    });

    it("spatial_words later uses front/back and inside/outside scenes", () => {
        const frontBack = generators.spatial_words({
            profile: { mathSkills: { spatial_words: { totalAnswers: 4 } } },
        } as any);
        const insideOutside = generators.spatial_words({
            profile: { mathSkills: { spatial_words: { totalAnswers: 6 } } },
        } as any);

        expect(frontBack.questionVisual?.kind).toBe("position-scene");
        expect(insideOutside.questionVisual?.kind).toBe("position-scene");

        if (frontBack.questionVisual?.kind === "position-scene") {
            expect(frontBack.questionVisual.scene).toBe("front-back");
        }

        if (insideOutside.questionVisual?.kind === "position-scene") {
            expect(insideOutside.questionVisual.scene).toBe("inside-outside");
        }
    });

    it("one_to_one_match uses a sharing visual with matching counts", () => {
        const problem = generators.one_to_one_match();
        expect(problem.questionVisual?.kind).toBe("sharing-items");
        if (problem.questionVisual?.kind === "sharing-items") {
            expect(problem.questionVisual.source.count).toBe(problem.questionVisual.recipients.count);
            expect(problem.questionVisual.actionLabel).toBe("1こずつ");
        }
    });

    it("sort_by_attribute uses a category-sort visual", () => {
        const problem = generators.sort_by_attribute();
        expect(problem.questionVisual?.kind).toBe("category-sort");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "category-sort") {
            expect(problem.questionVisual.buckets).toHaveLength(2);
        }
    });

    it("same_count_match uses a visual target and emoji-only choice labels", () => {
        const problem = generators.same_count_match();
        expect(problem.questionVisual?.kind).toBe("single-items");
        expect(problem.inputType).toBe("choice");
        expect(problem.inputConfig?.choices?.every(choice => !/\d/.test(choice.label))).toBe(true);
    });

    it("compose_5 uses a 5-frame visual", () => {
        const problem = generators.compose_5();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(5);
        }
    });

    it("compose_10 uses a 10-frame visual", () => {
        const problem = generators.compose_10();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(10);
        }
    });

    it("share_equal uses a sharing visual", () => {
        const problem = generators.share_equal();
        expect(problem.questionVisual?.kind).toBe("sharing-items");
        if (problem.questionVisual?.kind === "sharing-items") {
            expect(problem.questionVisual.source.count % problem.questionVisual.recipients.count).toBe(0);
        }
    });

    it("zero_concept uses a subtraction visual that removes everything", () => {
        const problem = generators.zero_concept();
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.correctAnswer).toBe("0");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.crossedOutCount).toBe(problem.questionVisual.group.count);
        }
    });

    it("which_is_empty uses a single-items frame visual", () => {
        const problem = generators.which_is_empty();
        expect(problem.questionVisual?.kind).toBe("single-items");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(5);
        }
    });

    it("one_less uses a subtraction visual that removes one item", () => {
        const problem = generators.one_less();
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.crossedOutCount).toBe(1);
        }
    });

    it("two_less uses a subtraction visual that removes two items", () => {
        const problem = generators.two_less();
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.crossedOutCount).toBe(2);
        }
    });

    it("count_oddone uses an item-grid visual", () => {
        const problem = generators.count_oddone();
        expect(problem.questionVisual?.kind).toBe("item-grid");
        if (problem.questionVisual?.kind === "item-grid") {
            expect(problem.questionVisual.items).toHaveLength(4);
        }
    });

    it("count_shape and count_color use single-item grid visuals", () => {
        const shape = generators.count_shape();
        const color = generators.count_color();

        expect(shape.questionVisual?.kind).toBe("item-grid");
        expect(color.questionVisual?.kind).toBe("item-grid");

        if (shape.questionVisual?.kind === "item-grid") {
            expect(shape.questionVisual.items).toHaveLength(1);
        }

        if (color.questionVisual?.kind === "item-grid") {
            expect(color.questionVisual.items).toHaveLength(1);
        }
    });

    it("count_pair uses a single-item grid visual", () => {
        const problem = generators.count_pair();
        expect(problem.questionVisual?.kind).toBe("item-grid");
        if (problem.questionVisual?.kind === "item-grid") {
            expect(problem.questionVisual.items).toHaveLength(1);
        }
    });
});
