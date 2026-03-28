import { describe, expect, it } from "vitest";
import { generators } from "./counting";

describe("counting generators visuals", () => {
    it("count_5 starts from one item and uses a 5-frame visual", () => {
        const problem = generators.count_5({
            profile: { mathSkills: { count_5: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("single-items");
        expect(problem.correctAnswer).toBe("1");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.frameSize).toBe(5);
            expect(problem.questionVisual.group.count).toBe(1);
        }
    });

    it("count_dot starts from small dot counts", () => {
        const problem = generators.count_dot({
            profile: { mathSkills: { count_dot: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("single-items");
        expect(problem.correctAnswer).toBe("1");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.group.count).toBe(1);
            expect(problem.questionVisual.group.emoji).toBe("●");
        }
    });

    it("count_read uses a number-card visual and starts from small numerals", () => {
        const problem = generators.count_read({
            profile: { mathSkills: { count_read: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("number-card");
        expect(problem.inputType).toBe("choice");
        expect(problem.correctAnswer).toBe("いち");

        if (problem.questionVisual?.kind === "number-card") {
            expect(problem.questionVisual.card.value).toBe(1);
            expect(problem.questionVisual.card.frameSize).toBe(5);
            expect(problem.questionVisual.card.supportGroup.count).toBe(1);
        }
    });

    it("count_read later expands to 10-frame support", () => {
        const problem = generators.count_read({
            profile: { mathSkills: { count_read: { totalAnswers: 8 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("number-card");

        if (problem.questionVisual?.kind === "number-card") {
            expect(problem.questionVisual.card.value).toBe(9);
            expect(problem.questionVisual.card.frameSize).toBe(10);
            expect(problem.questionVisual.card.supportGroup.count).toBe(9);
        }
    });

    it("count_10 starts from 6 and uses a single-items ten-frame visual", () => {
        const problem = generators.count_10({
            profile: { mathSkills: { count_10: { totalAnswers: 0 } } },
        } as any);
        expect(problem.questionVisual?.kind).toBe("single-items");
        expect(problem.correctAnswer).toBe("6");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(10);
            expect(problem.questionVisual.group.count).toBe(6);
        }
    });

    it("count_which_more starts with large visual gaps and no numeric hints", () => {
        const problem = generators.count_which_more({
            profile: { mathSkills: { count_which_more: { totalAnswers: 0 } } },
        } as any);
        expect(problem.questionVisual?.kind).toBe("comparison-items");
        expect(problem.inputConfig?.choices?.every(choice => !/\d/.test(choice.label))).toBe(true);
        if (problem.questionVisual?.kind === "comparison-items") {
            const [left, right] = problem.questionVisual.groups;
            expect(Math.abs((left?.count || 0) - (right?.count || 0))).toBeGreaterThanOrEqual(3);
        }
    });

    it("one_more uses an addition visual", () => {
        const problem = generators.one_more();
        expect(problem.questionVisual?.kind).toBe("number-line");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBe(1);
        }
    });

    it("two_more uses a number-line visual with a two-step jump", () => {
        const problem = generators.two_more();
        expect(problem.questionVisual?.kind).toBe("number-line");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBe(2);
        }
    });

    it("count_order starts with wide gaps on a number-line visual", () => {
        const problem = generators.count_order({
            profile: { mathSkills: { count_order: { totalAnswers: 0 } } },
        } as any);
        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.highlightValues).toHaveLength(3);
            const values = [...(problem.questionVisual.line.highlightValues || [])].sort((a, b) => a - b);
            expect(values[1] - values[0]).toBeGreaterThanOrEqual(2);
            expect(values[2] - values[1]).toBeGreaterThanOrEqual(2);
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
        expect(problem.questionText).toContain("どこ？");
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
        expect(frontBack.questionText).toContain("の");
        expect(insideOutside.questionText).toContain("の");

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

    it("add_tiny starts from 1+1 with an addition visual", () => {
        const problem = generators.add_tiny({
            profile: { mathSkills: { add_tiny: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("addition-items");
        expect(problem.correctAnswer).toBe("2");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[0]?.count).toBe(1);
            expect(problem.questionVisual.groups[1]?.count).toBe(1);
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

    it("add_finger starts with make-5 combinations", () => {
        const problem = generators.add_finger({
            profile: { mathSkills: { add_finger: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("addition-items");
        expect(problem.correctAnswer).toBe("5");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[0]?.count).toBe(1);
            expect(problem.questionVisual.groups[1]?.count).toBe(4);
        }
    });

    it("share_equal uses a sharing visual", () => {
        const problem = generators.share_equal();
        expect(problem.questionVisual?.kind).toBe("sharing-items");
        if (problem.questionVisual?.kind === "sharing-items") {
            expect(problem.questionVisual.source.count % problem.questionVisual.recipients.count).toBe(0);
        }
    });

    it("add_5 starts from easier 5-pairs before larger totals", () => {
        const problem = generators.add_5({
            profile: { mathSkills: { add_5: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("addition-items");
        expect(problem.correctAnswer).toBe("6");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[0]?.count).toBe(1);
            expect(problem.questionVisual.groups[1]?.count).toBe(5);
        }
    });

    it("sub_tiny starts from taking away 1 with a subtraction visual", () => {
        const problem = generators.sub_tiny({
            profile: { mathSkills: { sub_tiny: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.correctAnswer).toBe("1");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.count).toBe(2);
            expect(problem.questionVisual.group.crossedOutCount).toBe(1);
            expect(problem.questionVisual.takenAwayCount).toBe(1);
        }
    });

    it("zero_concept uses a subtraction visual that removes everything", () => {
        const problem = generators.zero_concept();
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.correctAnswer).toBe("0");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.crossedOutCount).toBe(problem.questionVisual.group.count);
            expect(problem.questionVisual.takenAwayCount).toBe(problem.questionVisual.group.count);
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

    it("count_next_10 and count_back start from easy fixed targets on number lines", () => {
        const next = generators.count_next_10({
            profile: { mathSkills: { count_next_10: { totalAnswers: 0 } } },
        } as any);
        const back = generators.count_back({
            profile: { mathSkills: { count_back: { totalAnswers: 0 } } },
        } as any);

        expect(next.questionVisual?.kind).toBe("number-line");
        expect(back.questionVisual?.kind).toBe("number-line");
        expect(next.correctAnswer).toBe("2");
        expect(back.correctAnswer).toBe("1");

        if (next.questionVisual?.kind === "number-line") {
            expect(next.questionVisual.line.step).toBe(1);
            expect(next.questionVisual.line.start).toBe(1);
        }

        if (back.questionVisual?.kind === "number-line") {
            expect(back.questionVisual.line.step).toBe(-1);
            expect(back.questionVisual.line.start).toBe(2);
        }
    });

    it("count_50, count_next_20, and count_100 start from bridged ranges on number-line visuals", () => {
        const count50 = generators.count_50({
            profile: { mathSkills: { count_50: { totalAnswers: 0 } } },
        } as any);
        const next20 = generators.count_next_20({
            profile: { mathSkills: { count_next_20: { totalAnswers: 0 } } },
        } as any);
        const count100 = generators.count_100({
            profile: { mathSkills: { count_100: { totalAnswers: 0 } } },
        } as any);

        expect(count50.questionVisual?.kind).toBe("number-line");
        expect(next20.questionVisual?.kind).toBe("number-line");
        expect(count100.questionVisual?.kind).toBe("number-line");
        expect(count50.correctAnswer).toBe("21");
        expect(next20.correctAnswer).toBe("11");
        expect(count100.correctAnswer).toBe("51");
    });

    it("compare_1d uses a number-line visual with two highlighted values", () => {
        const problem = generators.compare_1d();
        expect(problem.questionVisual?.kind).toBe("number-line");
        expect(problem.inputType).toBe("choice");
        expect(problem.questionText).toContain("□");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.highlightValues).toHaveLength(2);
            expect(problem.questionVisual.prompt).toBe("□ に はいる きごうは？");
        }
    });

    it("compare_2d starts with a base-10 visual for distant tens", () => {
        const problem = generators.compare_2d({
            profile: { mathSkills: { compare_2d: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("comparison-base10");
        expect(problem.inputType).toBe("choice");
        if (problem.questionVisual?.kind === "comparison-base10") {
            expect(problem.questionVisual.prompt).toBe("□ に はいる きごうは？");
        }
    });

    it("compare_2d later uses a number-line visual for same-tens comparisons", () => {
        const problem = generators.compare_2d({
            profile: { mathSkills: { compare_2d: { totalAnswers: 20 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.highlightValues).toHaveLength(2);
            expect(problem.questionVisual.prompt).toBe("□ に はいる きごうは？");
        }
    });

    it("one_less uses a number-line visual that moves back by one", () => {
        const problem = generators.one_less();
        expect(problem.questionVisual?.kind).toBe("number-line");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBe(-1);
        }
    });

    it("two_less uses a number-line visual that moves back by two", () => {
        const problem = generators.two_less();
        expect(problem.questionVisual?.kind).toBe("number-line");
        expect(problem.inputType).toBe("number");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBe(-2);
        }
    });

    it("count_fill uses a number-line visual with one hidden value", () => {
        const problem = generators.count_fill();
        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.hiddenValues).toHaveLength(1);
            expect(problem.questionVisual.line.step).toBe(1);
        }
    });

    it("count_oddone uses an item-grid visual", () => {
        const problem = generators.count_oddone();
        expect(problem.questionVisual?.kind).toBe("item-grid");
        if (problem.questionVisual?.kind === "item-grid") {
            expect(problem.questionVisual.items).toHaveLength(4);
        }
    });

    it("count_shape and count_color use reference choice grids", () => {
        const shape = generators.count_shape({
            profile: { mathSkills: { count_shape: { totalAnswers: 0 } } },
        } as any);
        const color = generators.count_color({
            profile: { mathSkills: { count_color: { totalAnswers: 0 } } },
        } as any);

        expect(shape.questionVisual?.kind).toBe("reference-choice-grid");
        expect(color.questionVisual?.kind).toBe("reference-choice-grid");

        if (shape.questionVisual?.kind === "reference-choice-grid") {
            expect(shape.questionVisual.grid.choices).toHaveLength(2);
        }

        if (color.questionVisual?.kind === "reference-choice-grid") {
            expect(color.questionVisual.grid.choices).toHaveLength(2);
        }
    });

    it("count_pair uses a reference choice grid and expands to three choices later", () => {
        const early = generators.count_pair({
            profile: { mathSkills: { count_pair: { totalAnswers: 0 } } },
        } as any);
        const later = generators.count_pair({
            profile: { mathSkills: { count_pair: { totalAnswers: 4 } } },
        } as any);

        expect(early.questionVisual?.kind).toBe("reference-choice-grid");
        expect(later.questionVisual?.kind).toBe("reference-choice-grid");

        if (early.questionVisual?.kind === "reference-choice-grid") {
            expect(early.questionVisual.grid.choices).toHaveLength(2);
        }

        if (later.questionVisual?.kind === "reference-choice-grid") {
            expect(later.questionVisual.grid.choices).toHaveLength(3);
        }
    });
});
