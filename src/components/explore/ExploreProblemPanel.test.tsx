import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Problem } from "../../domain/types";
import { ExploreProblemPanel } from "./ExploreProblemPanel";

const arbitraryProblem: Problem = {
    id: "rapid-trail-arbitrary-problem",
    subject: "math",
    categoryId: "mul_arbitrary_family",
    questionText: "7 × 8",
    inputType: "number",
    correctAnswer: "56",
    isReview: false,
};

const renderPanel = (completedSteps: number, feedback: "idle" | "correct" | "incorrect") => (
    renderToStaticMarkup(
        <ExploreProblemPanel
            problem={arbitraryProblem}
            answer={feedback === "idle" ? "" : "56"}
            prompt="こたえを しずくへ とどけよう"
            feedback={feedback}
            attemptCount={feedback === "incorrect" ? 1 : 0}
            combo={2}
            targetKind="flower"
            incorrectEnergyCost={1}
            completedSteps={completedSteps}
            inputDisabled={feedback !== "idle"}
            onAnswerChange={() => undefined}
            onSubmit={() => undefined}
        />,
    )
);

const renderMakimodonPanel = (
    completedSteps: number,
    feedback: "idle" | "correct" | "incorrect",
) => renderToStaticMarkup(
    <ExploreProblemPanel
        problem={arbitraryProblem}
        answer={feedback === "idle" ? "" : "56"}
        prompt="まきものの はしっこを みよう"
        feedback={feedback}
        attemptCount={feedback === "incorrect" ? 1 : 0}
        combo={2}
        targetKind="flower"
        incorrectEnergyCost={1}
        presentation="makimodon"
        completedSteps={completedSteps}
        inputDisabled={feedback !== "idle"}
        onAnswerChange={() => undefined}
        onSubmit={() => undefined}
    />,
);

const renderRootPullPanel = (
    completedSteps: number,
    feedback: "idle" | "correct" | "incorrect",
    version: "v1" | "v2" = "v1",
    payoffVariant: "dirt-hat" | "leaf-hat" = "dirt-hat",
) => renderToStaticMarkup(
    <ExploreProblemPanel
        problem={arbitraryProblem}
        answer={feedback === "idle" ? "" : "56"}
        prompt="はっぱを いっしょに ひっぱろう"
        feedback={feedback}
        attemptCount={feedback === "incorrect" ? 1 : 0}
        combo={2}
        targetKind="flower"
        incorrectEnergyCost={1}
        presentation="root-pull"
        completedSteps={completedSteps}
        rootPullAssetSet={version}
        rootPullPayoffVariant={payoffVariant}
        inputDisabled={feedback !== "idle"}
        onAnswerChange={() => undefined}
        onSubmit={() => undefined}
    />,
);

const renderSnapRootPanel = (
    completedSteps: number,
    feedback: "idle" | "correct" | "incorrect",
) => renderToStaticMarkup(
    <ExploreProblemPanel
        problem={arbitraryProblem}
        answer={feedback === "idle" ? "" : "56"}
        prompt="いっぽん葉を ひっぱろう"
        feedback={feedback}
        attemptCount={feedback === "incorrect" ? 1 : 0}
        combo={2}
        targetKind="flower"
        incorrectEnergyCost={1}
        presentation="snap-root"
        completedSteps={completedSteps}
        inputDisabled={feedback !== "idle"}
        onAnswerChange={() => undefined}
        onSubmit={() => undefined}
    />,
);

describe("ExploreProblemPanel rapid-trail art", () => {
    it("uses authored same-camera painted flower art", () => {
        const markup = renderPanel(3, "idle");

        expect(markup).toContain('data-camera-key="firefly-flower-side-v3"');
        expect(markup).toContain('data-visual-candidate-id="firefly-dew-path-painted-v3"');
        expect(markup).toContain('data-visual-mode="world-painted"');
        expect(markup).toContain('data-stage="waiting"');
        expect(markup).not.toContain("scene-run-pop-v1.webp");
    });

    it("keeps arbitrary problem identity while showing the next physical clue", () => {
        const markup = renderPanel(4, "correct");

        expect(markup).toContain('data-question-text="7 × 8"');
        expect(markup).toContain('data-skill-id="mul_arbitrary_family"');
        expect(markup).toContain('data-stage="warm-bud"');
        expect(markup).toContain("つぼみが ぽっと あたたかい");
    });

    it("does not advance the flower art after a wrong answer", () => {
        const markup = renderPanel(4, "incorrect");

        expect(markup).toContain('data-stage="dew-trail"');
        expect(markup).toContain("しずくは そのまま。もういちど");
        expect(markup).toContain('role="alert"');
    });
});

describe("ExploreProblemPanel Makimodon cold open", () => {
    it("starts unnamed with the rolled-body cause while preserving the math problem", () => {
        const markup = renderMakimodonPanel(0, "idle");

        expect(markup).toContain('data-camera-key="makimodon-side-v1"');
        expect(markup).toContain('data-stage="rolled"');
        expect(markup).toContain('data-question-text="7 × 8"');
        expect(markup).toContain('data-skill-id="mul_arbitrary_family"');
        expect(markup).toContain("この まきまき、いきもの？");
        expect(markup).not.toContain("マキモドン");
    });

    it("does not advance its physical stage after a wrong answer", () => {
        const markup = renderMakimodonPanel(1, "incorrect");

        expect(markup).toContain('data-stage="trip"');
        expect(markup).toContain("まきまきは そのまま。もういちど");
        expect(markup).toContain('role="alert"');
    });

    it("shows the rewind-and-seat payoff on the third correct answer", () => {
        const markup = renderMakimodonPanel(2, "correct");

        expect(markup).toContain('data-stage="payoff"');
        expect(markup).toContain('data-band-reach="rewound-seat"');
        expect(markup).toContain("ぜんぶ まきもどった！");
        expect(markup).toContain("あいぼうが せなかへ どん。");
    });
});

describe("ExploreProblemPanel Root Pull opening", () => {
    it("starts on the authored ready plate without changing the math problem", () => {
        const markup = renderRootPullPanel(0, "idle");

        expect(markup).toContain('data-camera-key="opening-root-pull-side-v1"');
        expect(markup).toContain('data-stage="ready"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v1/ready.jpg");
        expect(markup).toContain('data-question-text="7 × 8"');
        expect(markup).toContain('data-skill-id="mul_arbitrary_family"');
        expect(markup).toContain("こたえて、ぐいっ！");
        expect(markup).not.toContain("この まきまき、いきもの？");
    });

    it("keeps the first committed pull visible after a wrong answer", () => {
        const markup = renderRootPullPanel(1, "incorrect");

        expect(markup).toContain('data-stage="small-pull"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v1/pull-one.jpg");
        expect(markup).toContain("まだ ぬけない。もういちど！");
        expect(markup).toContain('role="alert"');
    });

    it("shows the comic release on the third correct answer", () => {
        const markup = renderRootPullPanel(2, "correct");

        expect(markup).toContain('data-stage="comic-release"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v1/payoff.jpg");
        expect(markup).toContain('data-actor-state="safe-seated"');
        expect(markup).toContain('data-subject-state="free"');
        expect(markup).toContain("スポン！ しりもちも だいせいこう");
    });

    it("shows the v2 leaf-visor beat without removing the numeric keypad", () => {
        const markup = renderRootPullPanel(0, "correct", "v2", "leaf-hat");

        expect(markup).toContain('data-asset-set="v2"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v2/pull-one.jpg");
        expect(markup).toContain("ぺろん！ はっぱで まえが みえない");
        expect(markup).toContain(">1</button>");
        expect(markup).toContain(">2</button>");
        expect(markup).toContain(">3</button>");
    });

    it("shows the selected v2 payoff variant on the third correct answer", () => {
        const markup = renderRootPullPanel(2, "correct", "v2", "leaf-hat");

        expect(markup).toContain('data-payoff-variant="leaf-hat"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v2/payoff-leaf-hat.jpg");
        expect(markup).toContain("スポン！ はっぱぼうし だいせいこう");
    });
});

describe("ExploreProblemPanel Snap Root opening", () => {
    it("uses the painted dig-pop sequence and keeps the numeric keypad", () => {
        const markup = renderSnapRootPanel(0, "idle");

        expect(markup).toContain('data-opening-art="snap-root"');
        expect(markup).toContain('data-delivery-id="snap-root-v1"');
        expect(markup).toContain('data-visual-candidate-id="dig-pop-painted-v2"');
        expect(markup).toContain('data-camera-key="opening-snap-root-side-v1"');
        expect(markup).toContain('data-stage="ready"');
        expect(markup).toContain('data-actor-state="ready"');
        expect(markup).toContain('data-subject-state="planted"');
        expect(markup).toContain('data-action-state="ready"');
        expect(markup).toContain('data-contact-state="none"');
        expect(markup).toContain('data-subject-contact="none"');
        expect(markup).toContain('data-lift-contact="none"');
        expect(markup).toContain("/assets/explore/opening-snap-root-painted/scene-ready.jpg");
        expect(markup).toContain("/assets/explore/opening-snap-root-painted/scene-ready-tablet.jpg");
        expect(markup).toContain(">1</button>");
        expect(markup).toContain(">2</button>");
        expect(markup).toContain(">3</button>");
    });

    it("holds its body stage on an incorrect answer", () => {
        const markup = renderSnapRootPanel(1, "incorrect");

        expect(markup).toContain('data-stage="dig-one"');
        expect(markup).toContain('data-actor-state="digging"');
        expect(markup).toContain('data-subject-state="rising"');
        expect(markup).toContain('data-action-state="dig-one"');
        expect(markup).toContain("/assets/explore/opening-snap-root-painted/scene-dig-one.jpg");
        expect(markup).toContain("だいじょうぶ。もういちど！");
        expect(markup).toContain('role="alert"');
    });

    it("shows one canonical safe full-body pop payoff", () => {
        const markup = renderSnapRootPanel(2, "correct");

        expect(markup).toContain('data-stage="popped"');
        expect(markup).toContain('data-actor-state="safe-seated"');
        expect(markup).toContain('data-subject-state="free-standing"');
        expect(markup).toContain('data-action-state="pop"');
        expect(markup).toContain('data-contact-state="none"');
        expect(markup).toContain("/assets/explore/opening-snap-root-painted/scene-popped.jpg");
        expect(markup).toContain("できた！ つちぼうし！");
        expect(markup).not.toContain("data-payoff-variant");
        expect(markup).not.toContain("data-watering-state");
        expect(markup).not.toContain("watering-ready.svg");
        expect(markup).not.toContain("actor-water-sheet.svg");
        expect(markup).not.toContain("編み根");
        expect(markup).not.toContain("着地");
    });
});
