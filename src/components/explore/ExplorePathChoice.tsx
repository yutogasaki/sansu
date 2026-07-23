import React, { type CSSProperties } from "react";
import { Backpack, BookOpen, ChevronRight, House, Route, Stamp } from "lucide-react";
import type {
    DiscoveryPageDefinition,
    DiscoveryPageFeatureId,
    ExploreNode,
} from "../../domain/explore";
import { selectExplorePathChoiceMode } from "../../domain/explore";
import { ExploreGlyph, type ExploreGlyphKind } from "./ExploreGlyph";
import { ExploreRouteForkArt } from "./ExploreRouteForkArt";
import { useExploreStageFocus } from "./useExploreStageFocus";

interface ExplorePathChoiceProps {
    nodes: ExploreNode[];
    steps: number;
    researchPage?: {
        definition: DiscoveryPageDefinition;
        discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
    };
    onSelect: (nodeId: string) => void;
    onReturn: () => void;
}

const choiceHeading = (count: number) => {
    if (count === 0) return "いちばん おくまで きた";
    if (count === 1) return "この道を すすもう";
    if (count >= 3) return "どの道へ いく？";
    return "どっちへ いく？";
};

const ROUTE_PREVIEW_ASSETS: Record<2 | 3, string> = {
    2: "/assets/explore/route-choice/scene-fork-two-pokko-v1.jpg",
    3: "/assets/explore/route-choice/scene-fork-three-pokko-v1.jpg",
};

const getRoutePreviewMood = (kind: ExploreNode["kind"]) => {
    if (kind === "soil" || kind === "fossil" || kind === "crystal") return "open";
    if (kind === "mystery") return "hidden";
    if (kind === "bridge") return "water";
    return "winding";
};

const getRoutePreviewPosition = (
    branchCount: 2 | 3,
    branchIndex: number,
) => {
    if (branchCount === 3) return [8, 50, 92][branchIndex] ?? 50;
    return [10, 90][branchIndex] ?? 50;
};

interface ExploreRoutePreviewProps {
    node: ExploreNode;
    branchCount: 2 | 3;
    branchIndex: number;
}

const ExploreRoutePreview = ({
    node,
    branchCount,
    branchIndex,
}: ExploreRoutePreviewProps) => {
    const previewStyle = {
        "--explore-route-preview-image": `url("${ROUTE_PREVIEW_ASSETS[branchCount]}")`,
        "--explore-route-preview-position": `${getRoutePreviewPosition(branchCount, branchIndex)}%`,
        "--explore-route-preview-size": branchCount === 3 ? "300%" : "230%",
    } as CSSProperties;

    return (
        <span
            aria-hidden="true"
            className="explore-route-preview"
            data-branch-count={branchCount}
            data-branch-index={branchIndex}
            data-preview-mood={getRoutePreviewMood(node.kind)}
            data-route-kind={node.kind}
            data-testid="explore-route-preview"
            style={previewStyle}
        >
            <span className="explore-route-preview-landmark">
                <ExploreGlyph
                    kind={node.kind as ExploreGlyphKind}
                    className="h-10 w-10"
                />
            </span>
        </span>
    );
};

export const ExplorePathChoice: React.FC<ExplorePathChoiceProps> = ({
    nodes,
    steps,
    researchPage,
    onSelect,
    onReturn,
}) => {
    const headingRef = useExploreStageFocus<HTMLHeadingElement>();
    const mode = selectExplorePathChoiceMode(steps, nodes.length);
    const isRunEnd = mode === "return-ready";
    const isInvalidDeadEnd = mode === "invalid-dead-end";
    const routeBranchCount = nodes.length >= 3 ? 3 : 2;

    return (
        <section
            className="explore-field-sheet explore-path-choice flex h-full min-h-0 flex-col overflow-y-auto rounded-[24px] px-3.5 pb-3.5 pt-3 sm:px-5 sm:pb-5"
            data-visual-lineage-id="pokko-field-v1"
            data-visual-candidate-id={isRunEnd
                ? "pokko-carry-home-v1"
                : mode === "routes"
                    ? "pokko-route-map-v2"
                    : "pokko-route-map-v1"}
            data-visual-mode={isRunEnd ? "field-book" : "route-map"}
        >

        <div className="flex items-start gap-3">
            <span className="explore-path-choice-mark flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-[13px] text-[var(--explore-ink)]" aria-hidden="true">
                {mode === "routes" ? <Route className="h-5 w-5" /> : <House className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
                <p className="explore-kicker">
                    {isRunEnd ? "もちかえり" : isInvalidDeadEnd ? "いったん きゅうけい" : "つぎの道"}
                </p>
                <h2
                    id="explore-path-choice-title"
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-0.5 text-[1.35rem] font-black tracking-[-0.025em] text-[var(--explore-ink)] focus:outline-none"
                >
                    {isRunEnd
                        ? "見つけたものを もちかえろう"
                        : isInvalidDeadEnd
                            ? "道の つづきが みえない"
                            : choiceHeading(nodes.length)}
                </h2>
                {isRunEnd || isInvalidDeadEnd ? (
                    <p className="mt-0.5 text-xs font-semibold leading-5 text-[var(--explore-muted)]">
                        {isRunEnd
                            ? "きょうの はっけんを、基地で ひろげよう"
                            : "見つけたものは そのまま。基地へ もどろう"}
                    </p>
                ) : null}
            </div>
        </div>

        {mode === "routes" ? <>
            <div className="explore-choice-grid mt-3 grid flex-1 content-start gap-2.5">
                {nodes.map((node, branchIndex) => (
                    <button
                        key={node.id}
                        type="button"
                        data-tone={node.kind}
                        aria-label={`${node.title}へ すすむ`}
                        onClick={() => onSelect(node.id)}
                        className="explore-route-card explore-focus-ring group flex min-h-[86px] items-center gap-3 rounded-[20px] p-3 text-left transition-[transform,filter] duration-150 hover:brightness-[1.015] active:translate-y-0.5 active:scale-[0.99]"
                    >
                        <ExploreRoutePreview
                            node={node}
                            branchCount={routeBranchCount}
                            branchIndex={branchIndex}
                        />
                        <span className="min-w-0 flex-1 pr-1">
                            <span className="block text-[1.05rem] font-black tracking-[-0.015em] text-[var(--explore-ink)]">{node.title}</span>
                            <span className="explore-route-hint mt-1 block text-xs font-bold leading-5">{node.hint}</span>
                        </span>
                        <span className="explore-route-arrow flex h-8 w-8 shrink-0 rotate-2 items-center justify-center rounded-[10px] text-[var(--explore-ink)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
                            <ChevronRight className="h-4 w-4" />
                        </span>
                    </button>
                ))}
            </div>
            {nodes.length >= 2 ? (
                <ExploreRouteForkArt branchCount={nodes.length >= 3 ? 3 : 2} />
            ) : null}
        </> : isRunEnd ? (
            <div className="mt-3 flex min-h-0 flex-1 flex-col justify-center gap-2.5">
                {researchPage ? (
                    <div
                        className="relative mx-auto flex min-h-[190px] w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[22px] border-[3px] border-[var(--explore-outline)] bg-[linear-gradient(155deg,var(--explore-turquoise),var(--explore-moss))] px-5 py-4"
                        data-testid="explore-return-page-preview"
                        role="img"
                        aria-label={`${researchPage.definition.title}のノートを バッグへ いれる`}
                    >
                        <span className="absolute -left-8 -top-8 h-24 w-24 rotate-12 rounded-[34%] bg-[var(--explore-amber)] opacity-70" aria-hidden="true" />
                        <span className="absolute -bottom-10 -right-8 h-28 w-28 -rotate-12 rounded-[38%] bg-[var(--explore-coral)] opacity-75" aria-hidden="true" />
                        <span className="absolute h-[72%] w-[70%] rotate-3 rounded-[18px] border-[3px] border-[var(--explore-outline)] bg-[var(--explore-cream)] opacity-55" aria-hidden="true" />
                        <div className="relative w-[76%] -rotate-2 rounded-[18px] border-[3px] border-[var(--explore-outline)] bg-[var(--explore-parchment)] px-3 pb-4 pt-3 shadow-[7px_8px_0_rgba(23,63,73,0.18)]">
                            <BookOpen className="mx-auto h-7 w-7 text-[var(--explore-deep)]" aria-hidden="true" />
                            <p className="mt-1 text-center text-xs font-black leading-5 text-[var(--explore-ink)]">
                                {researchPage.definition.title}
                            </p>
                            <span className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
                                {researchPage.discoveredFeatureIds.slice(0, 4).map((featureId) => (
                                    <span key={featureId} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--explore-outline)] bg-[var(--explore-amber)] text-[var(--explore-outline)]">
                                        <Stamp className="h-3.5 w-3.5" />
                                    </span>
                                ))}
                            </span>
                        </div>
                        <span className="absolute bottom-2.5 right-2.5 flex -rotate-2 items-center gap-1 rounded-full border-2 border-[var(--explore-outline)] bg-[var(--explore-amber)] px-2.5 py-1 text-[10px] font-black text-[var(--explore-outline)] shadow-sm" aria-hidden="true">
                            <Backpack className="h-4 w-4" />
                            バッグへ
                        </span>
                    </div>
                ) : null}
                <div className="rounded-[18px] border-2 border-dashed border-[var(--explore-sand)] bg-[color-mix(in_srgb,var(--explore-amber)_14%,white)] px-3 py-2.5 text-center">
                    <p className="text-xs font-black tracking-[0.08em] text-[var(--explore-mid)]">
                        {researchPage?.definition.title ?? "きょうの ちょうさノート"}
                    </p>
                    <p className="mt-0.5 text-sm font-black leading-5 text-[var(--explore-ink)]">
                        てがかりが つながった！
                    </p>
                </div>
            </div>
        ) : <div className="flex-1" aria-hidden="true" />}

        {isRunEnd ? (
            <button
                type="button"
                onClick={onReturn}
                data-testid="explore-run-primary-return"
                className="explore-primary-action explore-physical-action explore-focus-ring mt-3 flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-[18px] px-5 text-base font-black transition active:scale-[0.99]"
            >
                <House className="h-5 w-5" aria-hidden="true" />
                基地へ もちかえる
            </button>
        ) : isInvalidDeadEnd ? (
            <button
                type="button"
                onClick={onReturn}
                data-testid="explore-dead-end-return"
                className="explore-primary-action explore-physical-action explore-focus-ring mt-3 flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-[18px] px-5 text-base font-black transition active:scale-[0.99]"
            >
                <House className="h-5 w-5" aria-hidden="true" />
                基地へ もどる
            </button>
        ) : steps > 0 ? (
            <button
                type="button"
                onClick={onReturn}
                className="explore-path-return explore-focus-ring mt-2.5 flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-bold text-[var(--explore-muted)] transition active:scale-[0.99]"
            >
                <House className="h-4 w-4 text-[var(--explore-deep)]" aria-hidden="true" />
                ここまでを ノートに のこす
            </button>
        ) : null}
        </section>
    );
};
