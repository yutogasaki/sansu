import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    type ExploreNode,
} from "../../domain/explore";
import { ExplorePathChoice } from "./ExplorePathChoice";

const NEXT_NODE: ExploreNode = {
    id: "node-4-0",
    depth: 4,
    lane: 0,
    x: 28,
    y: 50,
    kind: "crystal",
    title: "きらきら岩",
    hint: "水晶が ありそう",
};

const THREE_WAY_NODES: ExploreNode[] = [
    NEXT_NODE,
    {
        ...NEXT_NODE,
        id: "node-4-1",
        lane: 1,
        x: 50,
        kind: "fossil",
        title: "みずの道",
    },
    {
        ...NEXT_NODE,
        id: "node-4-2",
        lane: 2,
        x: 72,
        kind: "soil",
        title: "つちの道",
    },
];

describe("ExplorePathChoice", () => {
    it("turns the Q8 endpoint into one clear physical return action", () => {
        const markup = renderToStaticMarkup(
            <ExplorePathChoice
                nodes={[]}
                steps={8}
                researchPage={{
                    definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                    discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
                }}
                onSelect={() => undefined}
                onReturn={() => undefined}
            />,
        );

        expect(markup).toContain("見つけたものを もちかえろう");
        expect(markup).toContain("もちかえり");
        expect(markup).toContain("基地へ もちかえる");
        expect(markup).toContain('data-visual-candidate-id="pokko-carry-home-v1"');
        expect(markup).toContain('data-visual-mode="field-book"');
        expect(markup).toContain('data-testid="explore-run-primary-return"');
        expect(markup).toContain('data-testid="explore-return-page-preview"');
        expect(markup).toContain("ほたる花の ひみつ");
        expect(markup).toContain("バッグへ いれる");
        expect(markup).toContain("てがかりが つながった！");
        expect(markup).toContain("min-h-14");
        expect(markup).not.toContain("explore-route-card");
        expect(markup).not.toContain('data-testid="explore-route-fork-art"');
        expect(markup).not.toContain("ここまでを ノートに のこす");
        expect(markup).not.toContain("つぎの道");
    });

    it("keeps voluntary return quiet while real route choices remain", () => {
        const markup = renderToStaticMarkup(
            <ExplorePathChoice
                nodes={[NEXT_NODE]}
                steps={3}
                onSelect={() => undefined}
                onReturn={() => undefined}
            />,
        );

        expect(markup).toContain("explore-route-card");
        expect(markup).toContain("この道を すすもう");
        expect(markup).toContain('data-visual-candidate-id="pokko-route-map-v2"');
        expect(markup).not.toContain('data-testid="explore-route-fork-art"');
        expect(markup).toContain("ここまでを ノートに のこす");
        expect(markup).not.toContain('data-testid="explore-run-primary-return"');
    });

    it("selects the authored three-way fork plate for three real routes", () => {
        const markup = renderToStaticMarkup(
            <ExplorePathChoice
                nodes={THREE_WAY_NODES}
                steps={3}
                onSelect={() => undefined}
                onReturn={() => undefined}
            />,
        );

        expect(markup).toContain('data-branch-count="3"');
        expect(markup).toContain("scene-fork-three-pokko-v1.jpg");
        expect(markup).not.toContain("scene-fork-two-pokko-v1.jpg");
    });

    it("shows an honest recovery instead of a false success at an early dead-end", () => {
        const markup = renderToStaticMarkup(
            <ExplorePathChoice
                nodes={[]}
                steps={6}
                onSelect={() => undefined}
                onReturn={() => undefined}
            />,
        );

        expect(markup).toContain("道の つづきが みえない");
        expect(markup).toContain("基地へ もどる");
        expect(markup).toContain('data-testid="explore-dead-end-return"');
        expect(markup).not.toContain("てがかりが つながった");
        expect(markup).not.toContain('data-testid="explore-run-primary-return"');
        expect(markup).not.toContain('data-testid="explore-route-fork-art"');
    });
});
