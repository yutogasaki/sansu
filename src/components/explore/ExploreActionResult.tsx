import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";
import type {
    DiscoveryPageDefinition,
    DiscoveryPageFeatureId,
    ExploreNodeKind,
} from "../../domain/explore";
import { cn } from "../../utils/cn";
import { DiscoveryPageArt } from "./DiscoveryPageArt";
import { ExploreGlyph } from "./ExploreGlyph";

interface ExploreActionResearchPage {
    definition: DiscoveryPageDefinition;
    discoveredFeatureIds: readonly DiscoveryPageFeatureId[];
}

interface ExploreActionResultProps {
    nodeTitle: string;
    nodeKind: ExploreNodeKind;
    combo: number;
    researchPage?: ExploreActionResearchPage;
}

export const ExploreActionResult: React.FC<ExploreActionResultProps> = ({
    nodeTitle,
    nodeKind,
    combo,
    researchPage,
}) => {
    const reduceMotion = useReducedMotion();
    const showsResearchWorld = Boolean(researchPage?.discoveredFeatureIds.length);

    return (
        <section className={cn(
            "explore-field-sheet relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-[28px] p-4 text-center",
            showsResearchWorld && "border-[3px] border-[var(--explore-ink)] p-2",
        )}>
            {showsResearchWorld ? (
                <>
                    <div className="explore-paper-diorama absolute inset-2 overflow-hidden rounded-[22px]" aria-hidden="true">
                        {researchPage ? (
                            <DiscoveryPageArt
                                definition={researchPage.definition}
                                discoveredFeatureIds={researchPage.discoveredFeatureIds}
                                variant="thumbnail"
                            />
                        ) : null}
                    </div>
                    <div className="pointer-events-none absolute inset-x-2 bottom-2 h-[48%] rounded-b-[22px] bg-[linear-gradient(180deg,transparent,rgba(247,232,189,0.9)_58%,#f7e8bd)]" aria-hidden="true" />
                </>
            ) : null}
            <div className="pointer-events-none absolute inset-x-[12%] top-[18%] h-24 rounded-full bg-cyan-200/24 blur-3xl" aria-hidden="true" />
            <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full opacity-30" viewBox="0 0 360 120" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 92C58 55 106 98 164 73C221 49 268 82 360 35" stroke="#3BB8C7" strokeWidth="2" strokeDasharray="4 7" />
                <path d="M0 112C82 80 124 118 196 91C263 66 302 87 360 65" stroke="#69B783" strokeWidth="18" strokeOpacity="0.18" />
            </svg>
            <motion.div
                className={cn("relative w-full max-w-md", showsResearchWorld && "mt-auto pb-3 pt-[42%]")}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: "easeOut" }}
            >
                <div className={cn("mx-auto items-center justify-center gap-2", showsResearchWorld ? "hidden" : "flex")} aria-hidden="true">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-amber-100/76">
                        <ExploreGlyph kind="light" className="h-10 w-10" />
                    </span>
                    <motion.span
                        className="h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--explore-sand),var(--explore-crystal))] shadow-[0_0_18px_rgba(99,217,235,0.48)]"
                        initial={reduceMotion ? false : { scaleX: 0, transformOrigin: "left" }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
                    />
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-[27px] border border-white bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.98),rgba(207,250,254,0.9)_48%,rgba(167,139,250,0.22))] shadow-[0_22px_42px_-28px_rgba(8,145,178,0.72)]">
                        <ExploreGlyph kind={nodeKind} className="h-16 w-16" />
                        <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-amber-400" />
                    </span>
                </div>
                <p className={cn("explore-kicker", showsResearchWorld ? "mt-0" : "mt-3")}>こたえが 光になった</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.025em] text-[var(--explore-ink)]">{nodeTitle}が ひらいた！</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-[var(--explore-muted)]">
                    {combo > 1 ? `${combo}れんさの ひかりが、その先へ つながったよ` : "この先に なにかの けはいが あるよ"}
                </p>
                <ArrowDown className="mx-auto mt-2 h-4 w-4 text-cyan-500" aria-hidden="true" />
            </motion.div>
        </section>
    );
};
