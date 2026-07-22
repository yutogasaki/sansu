import { describe, expect, it } from "vitest";
import {
    getRootPullAccessibleDescription,
    getRootPullKickerCopy,
    getRootPullOpeningStage,
    getRootPullProgressMarks,
    getRootPullStateLabel,
    getRootPullStagePresentation,
    getRootPullStatusCopy,
    ROOT_PULL_CAMERA_KEY,
    ROOT_PULL_STAGE_PRESENTATIONS,
    ROOT_PULL_VIEW_BOX,
    selectOpeningProblemPresentation,
    selectRootPullPayoffVariant,
    type RootPullOpeningStage,
} from "./rootPullPresentation";

describe("Root Pull opening presentation", () => {
    it("keeps classic intact and selects Root Pull only for its presentation key", () => {
        expect(selectOpeningProblemPresentation("classic")).toBe("makimodon");
        expect(selectOpeningProblemPresentation("root-pull")).toBe("root-pull");
    });

    it("turns three committed correct answers into one escalating physical rule", () => {
        expect(getRootPullOpeningStage(0, "idle")).toBe("ready");
        expect(getRootPullOpeningStage(0, "correct")).toBe("small-pull");
        expect(getRootPullOpeningStage(1, "correct")).toBe("bigger-pull");
        expect(getRootPullOpeningStage(2, "correct")).toBe("comic-release");
    });

    it("holds the current stage after an incorrect answer", () => {
        expect(getRootPullOpeningStage(0, "incorrect")).toBe("ready");
        expect(getRootPullOpeningStage(1, "incorrect")).toBe("small-pull");
        expect(getRootPullOpeningStage(2, "incorrect")).toBe("bigger-pull");
        expect(getRootPullOpeningStage(3, "incorrect")).toBe("comic-release");
        expect(getRootPullStatusCopy("small-pull", "incorrect")).toContain("もういちど");
    });

    it("clamps invalid completed-step counts without creating another stage", () => {
        expect(getRootPullOpeningStage(-4, "idle")).toBe("ready");
        expect(getRootPullOpeningStage(Number.NaN, "idle")).toBe("ready");
        expect(getRootPullOpeningStage(99, "idle")).toBe("comic-release");
        expect(getRootPullOpeningStage(99, "correct")).toBe("comic-release");
    });

    it("maps every state to the agreed local authored asset", () => {
        expect(ROOT_PULL_STAGE_PRESENTATIONS.ready.imageSrc).toBe(
            "/assets/explore/opening-root-pull-v1/ready.jpg",
        );
        expect(ROOT_PULL_STAGE_PRESENTATIONS["small-pull"].imageSrc).toBe(
            "/assets/explore/opening-root-pull-v1/pull-one.jpg",
        );
        expect(ROOT_PULL_STAGE_PRESENTATIONS["bigger-pull"].imageSrc).toBe(
            "/assets/explore/opening-root-pull-v1/pull-two.jpg",
        );
        expect(ROOT_PULL_STAGE_PRESENTATIONS["comic-release"].imageSrc).toBe(
            "/assets/explore/opening-root-pull-v1/payoff.jpg",
        );
    });

    it("gives v2 a first-beat gag and two deterministic payoff plates", () => {
        const visorBeat = getRootPullStagePresentation("small-pull", "v2", "dirt-hat");
        const straightLegBeat = getRootPullStagePresentation("bigger-pull", "v2", "dirt-hat");
        const dirtHat = getRootPullStagePresentation("comic-release", "v2", "dirt-hat");
        const leafHat = getRootPullStagePresentation("comic-release", "v2", "leaf-hat");

        expect(visorBeat.imageSrc).toBe(
            "/assets/explore/opening-root-pull-v2/pull-one.jpg",
        );
        expect(visorBeat.title).toContain("ぺろん");
        expect(straightLegBeat.title).toContain("あしが ぴーん");
        expect(dirtHat.imageSrc).toContain("payoff-dirt-hat.jpg");
        expect(dirtHat.title).toContain("つちぼうし");
        expect(leafHat.imageSrc).toContain("payoff-leaf-hat.jpg");
        expect(leafHat.title).toContain("はっぱぼうし");
        expect(dirtHat.imageSrc).not.toBe(leafHat.imageSrc);
        expect(getRootPullStatusCopy("bigger-pull", "correct", "v2", "dirt-hat"))
            .toContain("あしまで ぴーん");
    });

    it("selects a replay payoff from run identity rather than problem values", () => {
        expect(selectRootPullPayoffVariant("run-a")).toBe("leaf-hat");
        expect(selectRootPullPayoffVariant("run-a")).toBe("leaf-hat");
        expect(selectRootPullPayoffVariant("run-b")).toBe("dirt-hat");
        expect(selectRootPullPayoffVariant("run-a", "leaf-hat")).toBe("dirt-hat");
        expect(selectRootPullPayoffVariant("run-b", "dirt-hat")).toBe("leaf-hat");
    });

    it("keeps actor, subject, and action semantics in every state", () => {
        const stages: RootPullOpeningStage[] = [
            "ready",
            "small-pull",
            "bigger-pull",
            "comic-release",
        ];

        for (const stage of stages) {
            const presentation = getRootPullStagePresentation(stage);
            const description = getRootPullAccessibleDescription(stage);

            expect(presentation.actorDescription).toContain("相棒");
            expect(presentation.subjectDescription).toContain("生き物");
            expect(presentation.actionDescription.length).toBeGreaterThan(10);
            expect(description).toContain(presentation.actorDescription);
            expect(description).toContain(presentation.subjectDescription);
            expect(description).toContain(presentation.actionDescription);
        }
    });

    it("shares one camera contract across all state assets", () => {
        expect(ROOT_PULL_CAMERA_KEY).toBe("opening-root-pull-side-v1");
        expect(ROOT_PULL_VIEW_BOX).toBe("0 0 390 500");
    });

    it("exposes progress and physical state without relying on image motion or color", () => {
        expect(getRootPullProgressMarks("ready")).toBe("○○○");
        expect(getRootPullProgressMarks("small-pull")).toBe("●○○");
        expect(getRootPullProgressMarks("bigger-pull")).toBe("●●○");
        expect(getRootPullProgressMarks("comic-release")).toBe("●●●");
        expect(getRootPullKickerCopy("bigger-pull")).toBe("●●○ はっぱを ひっぱる");
        expect(getRootPullStateLabel("comic-release")).toBe("ぽんっ");
        expect(getRootPullStatusCopy("comic-release", "correct")).toContain("しりもち");
    });
});
