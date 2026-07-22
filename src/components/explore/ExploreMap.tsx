import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Lightbulb, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";
import { ExploreGlyph, type ExploreGlyphKind } from "./ExploreGlyph";

export type ExploreMapNodeState = "locked" | "available" | "opened" | "current";
export type ExploreMapReaction = "ready" | "opening" | "hint";

export interface ExploreMapNodeView {
    id: string;
    x: number;
    y: number;
    kind: string;
    title: string;
    state: ExploreMapNodeState;
}

export interface ExploreMapEdgeView {
    id: string;
    from: string;
    to: string;
    state: "locked" | "available" | "opened";
}

interface ExploreMapProps {
    nodes: ExploreMapNodeView[];
    edges: ExploreMapEdgeView[];
    mode?: "full" | "compact";
    focusNodeId?: string;
    fromNodeId?: string;
    reaction?: ExploreMapReaction;
}

const nodeStateClass = (state: ExploreMapNodeState) => `is-${state}`;

const WorldBackdrop: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
        >
            <rect width="100" height="100" fill="#fff0b5" />

            {/* 大きな不透明色面だけで奥行きを作る、絵具と切り紙のフィールド。 */}
            <path d="M0 0 H100 V18 C84 13 75 23 61 18 C42 12 29 25 0 17 Z" fill="#f3bd45" />
            <path d="M0 0 C13 4 10 16 18 22 C26 30 14 41 21 51 C27 62 12 70 18 82 C21 90 18 96 25 100 H0 Z" fill="#32a6a1" />
            <path d="M100 0 C87 8 93 21 84 29 C75 37 91 49 83 59 C76 69 91 80 82 89 C77 94 80 98 74 100 H100 Z" fill="#ed735c" />
            <path d="M0 100 V84 C14 79 24 90 38 84 C53 77 65 92 78 84 C87 79 94 82 100 76 V100 Z" fill="#74bd69" />

            {/* 色面の縁は、均一なベクター線ではなく二重のラフなインク線にする。 */}
            <g fill="none" stroke="#173f49" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round">
                <path d="M0 17 C27 25 41 12 61 18 C76 23 84 13 100 18" strokeWidth="2.6" />
                <path d="M0 19 C26 27 42 14 61 20 C76 25 85 15 100 20" strokeWidth="0.8" opacity="0.44" />
                <path d="M17 0 C12 14 19 21 21 29 C24 39 17 44 21 52 C26 63 14 72 19 83 C21 90 19 96 25 100" strokeWidth="2.2" />
                <path d="M84 0 C90 19 83 23 83 31 C82 40 88 50 83 59 C78 70 89 80 82 89 C78 95 80 98 74 100" strokeWidth="2.2" />
                <path d="M0 84 C14 79 24 90 38 84 C53 77 65 92 78 84 C87 79 94 82 100 76" strokeWidth="2.4" />
            </g>

            {/* 判子のような地形記号。光粒ではなく場所の個性を残す。 */}
            {!compact ? (
                <g fill="none" stroke="#173f49" strokeWidth="1.15" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity="0.58">
                    <path d="M7 23 l4 -5 l4 5 l-4 4 Z M6 28 l4 3 l4 -3" />
                    <path d="M89 25 c5 -3 8 2 4 5 c-3 2 -7 -1 -4 -5 Z M88 34 l6 2" />
                    <path d="M9 76 q5 -7 10 0 M12 80 q4 -5 8 0" />
                    <path d="M86 72 l3 -6 l3 6 l-3 5 Z" />
                </g>
            ) : null}
        </svg>
    </div>
);

const reactionCopy = (reaction: ExploreMapReaction, title: string) => {
    if (reaction === "opening") return `${title}が ひらく！`;
    if (reaction === "hint") return `${title}に ヒントのもよう`;
    return `${title}を ひらこう`;
};

export const ExploreMap: React.FC<ExploreMapProps> = ({
    nodes,
    edges,
    mode = "full",
    focusNodeId,
    fromNodeId,
    reaction = "ready",
}) => {
    const reduceMotion = useReducedMotion();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const focusNode = focusNodeId ? nodeById.get(focusNodeId) : undefined;
    const fromNode = fromNodeId ? nodeById.get(fromNodeId) : undefined;

    if (mode === "compact" && focusNode) {
        return (
            <section
                aria-label={`いま ${fromNode?.title ?? "へんてこ生態の入口"}。${reactionCopy(reaction, focusNode.title)}`}
                className="explore-map-frame relative h-full min-h-[82px] w-full rounded-[26px]"
            >
                <WorldBackdrop compact />
                <div className="relative flex h-full items-center justify-center gap-2 px-3 pb-6 pt-1 sm:gap-3 sm:px-4">
                    <div className="explore-map-node is-current flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] sm:h-12 sm:w-12 sm:rounded-[16px]" aria-hidden="true">
                        <ExploreGlyph kind={(fromNode?.kind ?? "start") as ExploreGlyphKind} className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>

                    <svg className="h-8 min-w-12 flex-1 overflow-visible sm:max-w-28" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M2 14 C22 4 39 21 58 11 C72 4 84 16 98 8" fill="none" stroke="#fff0b5" strokeWidth="11" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        <motion.path
                            d="M2 14 C22 4 39 21 58 11 C72 4 84 16 98 8"
                            fill="none"
                            stroke="#173f49"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="5 5"
                            vectorEffect="non-scaling-stroke"
                            initial={false}
                            animate={{ pathLength: reaction === "opening" ? 1 : 0.48 }}
                            transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
                        />
                    </svg>

                    <motion.div
                        className={cn(
                            "explore-map-node relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] sm:h-14 sm:w-14 sm:rounded-[18px]",
                            focusNode.state === "locked" ? "is-locked" : "is-available",
                        )}
                        animate={reduceMotion
                            ? undefined
                            : reaction === "opening"
                                ? { rotate: [0, -5, 5, 0], scale: [1, 1.14, 0.97, 1] }
                                : reaction === "hint"
                                    ? { x: [0, -3, 3, 0] }
                                    : undefined}
                        transition={{ duration: reaction === "opening" ? 0.38 : 0.24, ease: "easeOut" }}
                        aria-hidden="true"
                    >
                        <ExploreGlyph
                            kind={focusNode.state === "locked" ? "unknown" : focusNode.kind as ExploreGlyphKind}
                            className="h-10 w-10 sm:h-12 sm:w-12"
                        />
                        {reaction === "hint" ? (
                            <span className="absolute -right-2 -top-2 flex h-6 w-6 rotate-6 items-center justify-center rounded-[8px] border-2 border-[var(--explore-ink)] bg-[var(--explore-sand)] text-[var(--explore-ink)]">
                                <Lightbulb className="h-3.5 w-3.5" />
                            </span>
                        ) : null}
                        {reaction === "opening" ? (
                            <Sparkles className="absolute -right-3 -top-3 h-6 w-6 text-[var(--explore-coral)]" />
                        ) : null}
                    </motion.div>
                </div>
                <div className="pointer-events-none absolute inset-x-3 bottom-7 flex justify-center text-center text-[10px] font-black tracking-[0.05em] text-[var(--explore-ink)] sm:text-[11px]">
                    <span className="-rotate-1 rounded-[7px] border-2 border-[var(--explore-ink)] bg-[#fff8dd] px-3 py-1">
                        {reactionCopy(reaction, focusNode.title)}
                    </span>
                </div>
            </section>
        );
    }

    const currentNode = nodes.find((node) => node.state === "current");
    const availableTitles = nodes.filter((node) => node.state === "available").map((node) => node.title);
    const availableCopy = availableTitles.length > 0
        ? `つぎは ${availableTitles.join(" または ")}`
        : "つぎの道は まだない";

    return (
        <section
            aria-label={`たんけんマップ。いま ${currentNode?.title ?? "入口"}。${availableCopy}`}
            className="explore-map-frame relative h-full min-h-[250px] w-full rounded-[28px]"
        >
            <WorldBackdrop />

            <svg
                className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                {edges.map((edge) => {
                    const from = nodeById.get(edge.from);
                    const to = nodeById.get(edge.to);
                    if (!from || !to) return null;
                    const isOpeningRoute = reaction === "opening" && edge.to === focusNodeId;
                    return (
                        <g key={edge.id}>
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                vectorEffect="non-scaling-stroke"
                                strokeLinecap="round"
                                className={cn(
                                    "stroke-[9]",
                                    edge.state === "opened" && "stroke-[#6bc5b4]",
                                    edge.state === "available" && "stroke-[#fff0b5]",
                                    edge.state === "locked" && "stroke-[#f8d38a]/55",
                                )}
                            />
                            <motion.line
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                vectorEffect="non-scaling-stroke"
                                strokeLinecap="round"
                                strokeDasharray={edge.state === "locked" ? "2 5" : undefined}
                                className={cn(
                                    "stroke-[2.6]",
                                    edge.state === "opened" && "stroke-[#173f49]/75",
                                    edge.state === "available" && "stroke-[#173f49]",
                                    edge.state === "locked" && "stroke-[#7a6548]/38",
                                )}
                                initial={!reduceMotion && isOpeningRoute
                                    ? { pathLength: 0, opacity: 0.3 }
                                    : false}
                                animate={{
                                    pathLength: 1,
                                    opacity: edge.state === "locked" ? 0.34 : 1,
                                }}
                                transition={{ duration: reduceMotion ? 0 : isOpeningRoute ? 0.34 : 0.2, ease: "easeOut" }}
                            />
                        </g>
                    );
                })}
            </svg>

            {nodes.map((node) => {
                const isFocused = node.id === focusNodeId;
                const nodeAnimation = isFocused && reaction === "opening"
                    ? { rotate: [0, -5, 5, 0], scale: [1, 1.14, 0.97, 1] }
                    : isFocused && reaction === "hint"
                        ? { x: [0, -3, 3, 0] }
                        : undefined;
                return (
                    <motion.div
                        key={node.id}
                        className={cn(
                            "explore-map-node pointer-events-none absolute z-20 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[17px] sm:h-14 sm:w-14 sm:rounded-[19px]",
                            nodeStateClass(node.state),
                        )}
                        style={{
                            left: `${node.x}%`,
                            top: `${node.y}%`,
                        }}
                        initial={false}
                        animate={!reduceMotion ? nodeAnimation : undefined}
                        transition={!reduceMotion && nodeAnimation ? { duration: isFocused ? 0.36 : 0.48, ease: "easeOut" } : undefined}
                        aria-hidden="true"
                    >
                        <ExploreGlyph
                            kind={node.state === "locked" ? "unknown" : node.kind as ExploreGlyphKind}
                            className="h-10 w-10 sm:h-12 sm:w-12"
                        />
                        {isFocused && reaction === "hint" ? (
                            <span className="absolute -right-2 -top-2 flex h-6 w-6 rotate-6 items-center justify-center rounded-[8px] border-2 border-[var(--explore-ink)] bg-[var(--explore-sand)] text-[var(--explore-ink)]">
                                <Lightbulb className="h-3.5 w-3.5" />
                            </span>
                        ) : null}
                        {isFocused && reaction === "opening" ? (
                            <Sparkles className="absolute -right-3 -top-3 h-6 w-6 text-[var(--explore-coral)]" />
                        ) : null}
                        {node.state === "current" ? (
                            <span className="absolute -bottom-2 -rotate-2 rounded-[5px] border-2 border-[var(--explore-ink)] bg-white px-1.5 py-0.5 text-[8px] font-black leading-none text-[var(--explore-ink)]">
                                いま
                            </span>
                        ) : null}
                        {node.state === "available" ? (
                            <span className="absolute -bottom-2 rotate-1 rounded-[5px] border-2 border-[var(--explore-ink)] bg-[var(--explore-sand)] px-1.5 py-0.5 text-[8px] font-black leading-none text-[var(--explore-ink)]">
                                つぎ
                            </span>
                        ) : null}
                        {node.state === "opened" ? (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 rotate-6 items-center justify-center rounded-[5px] border-2 border-[var(--explore-ink)] bg-[var(--explore-turquoise)] text-[9px] font-black text-white" aria-hidden="true">
                                ✓
                            </span>
                        ) : null}
                    </motion.div>
                );
            })}

            <div className="pointer-events-none absolute bottom-7 left-3 z-30 -rotate-1 rounded-[7px] border-2 border-[var(--explore-ink)] bg-[#fff8dd] px-3 py-1.5 text-[10px] font-black tracking-[0.1em] text-[var(--explore-ink)]">
                へんてこ生態の道
            </div>
        </section>
    );
};
