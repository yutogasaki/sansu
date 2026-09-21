import { describe, expect, it } from "vitest";
import { PARENT_REVIEW_COPY } from "./parentReviewCopy";

describe("parent review-candidate copy", () => {
    it("explains the entry and recovery thresholds without labeling ability", () => {
        expect(PARENT_REVIEW_COPY.title).toBe("復習候補");
        expect(PARENT_REVIEW_COPY.description).toContain("5回以上");
        expect(PARENT_REVIEW_COPY.description).toContain("直近10回");
        expect(PARENT_REVIEW_COPY.description).toContain("60%未満");
        expect(PARENT_REVIEW_COPY.description).toContain("80%以上");
        expect(PARENT_REVIEW_COPY.description).not.toContain("苦手");
        expect(PARENT_REVIEW_COPY.empty).not.toContain("苦手");
        expect(PARENT_REVIEW_COPY.summary(3)).toBe("復習候補：3件");
    });
});
