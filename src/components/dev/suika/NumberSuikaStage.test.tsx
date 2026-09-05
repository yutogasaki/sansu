import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    aimG0SuikaRun,
    createG0SuikaRun,
    dropG0SuikaBall,
    stepG0SuikaRun,
    type G0SuikaProfileId,
    type G0SuikaRunState,
} from "../../../domain/explore/g0NumberSuika";
import {
    createQuantity,
    type SuikaQuantity,
} from "../../../domain/explore/suikaQuantity";
import { NumberSuikaStage } from "./NumberSuikaStage";

const q = createQuantity;

const renderStage = ({
    run,
    reducedMotion = false,
    interactive = true,
}: {
    run: G0SuikaRunState;
    reducedMotion?: boolean;
    interactive?: boolean;
}): string => renderToStaticMarkup(
    <NumberSuikaStage
        run={run}
        reducedMotion={reducedMotion}
        interactive={interactive}
        onAim={() => undefined}
        onDrop={() => undefined}
    />,
);

const advance = (run: G0SuikaRunState, totalMs: number): G0SuikaRunState => {
    let current = run;
    for (let elapsed = 0; elapsed < totalMs; elapsed += 16) {
        current = stepG0SuikaRun(current, 16);
    }
    return current;
};

const dropAt = (
    run: G0SuikaRunState,
    quantity: SuikaQuantity,
    x: number,
): G0SuikaRunState => dropG0SuikaBall(
    aimG0SuikaRun({ ...run, queue: [quantity, ...run.queue.slice(1)] }, x),
);

const playMerge = (
    profileId: G0SuikaProfileId,
    seed: string,
    left: SuikaQuantity,
    right: SuikaQuantity,
): G0SuikaRunState => {
    const settled = advance(
        dropAt(createG0SuikaRun(seed, 0, [], profileId), left, 50),
        1600,
    );
    return advance(dropAt(settled, right, 50), 1200);
};

describe("NumberSuikaStage", () => {
    it("容器と持ち玉を描く", () => {
        const markup = renderStage({ run: createG0SuikaRun("stage-seed") });

        expect(markup).toContain("suika-stage__vessel");
        expect(markup).toContain("suika-stage__deadline");
        expect(markup).toContain("suika-held");
    });

    it("非操作時は狙いと持ち玉を出さない", () => {
        const markup = renderStage({
            run: createG0SuikaRun("stage-seed"),
            interactive: false,
        });

        expect(markup).not.toContain("suika-held");
        expect(markup).not.toContain("suika-stage__aim");
    });

    it("整数は数字ひとつで描く", () => {
        const run = advance(
            dropAt(createG0SuikaRun("stage-int"), q(3), 50),
            1600,
        );

        expect(renderStage({ run })).toContain(">3</text>");
    });

    it("小数は小数点つきで描く", () => {
        const run = advance(
            dropAt(createG0SuikaRun("stage-dec", 0, [], "decimal"), q(3, 10), 50),
            1600,
        );

        expect(renderStage({ run })).toContain(">0.3</text>");
    });

    it("分数は分子と分母を縦に積んで描く", () => {
        const run = advance(
            dropAt(createG0SuikaRun("stage-frac", 0, [], "fraction"), q(1, 3), 50),
            1600,
        );
        const markup = renderStage({ run });

        expect(markup).toContain("suika-ball__bar");
        expect(markup).toContain(">1</text>");
        expect(markup).toContain(">3</text>");
    });

    it("合体したときに式を見せる", () => {
        expect(renderStage({ run: playMerge("tens", "cue-int", q(3), q(4)) }))
            .toContain("3+4=7");
        expect(renderStage({
            run: playMerge("decimal", "cue-dec", q(3, 10), q(4, 10)),
        })).toContain("0.3+0.4=0.7");
        expect(renderStage({
            run: playMerge("fraction", "cue-frac", q(1, 3), q(1, 6)),
        })).toContain("1/3+1/6=1/2");
    });

    it("合体できなかった接触も式で見せる", () => {
        let run = advance(dropAt(createG0SuikaRun("stage-reject"), q(9), 50), 1600);
        run = advance(dropAt(run, q(9), 50), 1300);
        const markup = renderStage({ run });

        expect(markup).toContain("suika-cue--reject");
        expect(markup).toContain("9+9=18");
    });

    it("reducedMotionでは点滅状態を立てない", () => {
        const run = playMerge("tens", "stage-motion", q(3), q(4));

        expect(renderStage({ run })).toContain('data-flashing="true"');
        expect(renderStage({ run, reducedMotion: true }))
            .not.toContain('data-flashing="true"');
    });

    it("あふれ間近をステージ側で示す", () => {
        const run = createG0SuikaRun("stage-danger");
        const danger: G0SuikaRunState = { ...run, overflowSinceMs: 10 };

        expect(renderStage({ run })).toContain('data-danger="false"');
        expect(renderStage({ run: danger })).toContain('data-danger="true"');
    });

    it("profileをステージ属性に出す", () => {
        const run = createG0SuikaRun("stage-profile", 0, [], "fraction");

        expect(renderStage({ run })).toContain('data-profile-id="fraction"');
    });
});
