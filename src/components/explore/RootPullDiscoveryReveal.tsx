import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { RootPullOpeningArt } from "./RootPullOpeningArt";

interface RootPullDiscoveryRevealProps {
    onContinue: () => void;
}

/**
 * Display-only discovery payoff for the Root Pull opening. Persisted discovery
 * IDs remain unchanged; this component owns only the child-facing scene/copy.
 */
export const RootPullDiscoveryReveal = ({
    onContinue,
}: RootPullDiscoveryRevealProps) => {
    const reduceMotion = useReducedMotion();
    const continueButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        continueButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                if (!event.repeat) onContinue();
                return;
            }
            if (event.key === "Tab") {
                event.preventDefault();
                continueButtonRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [onContinue]);

    return (
        <div
            className="explore-research-overlay absolute inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="root-pull-discovery-title"
            aria-describedby="root-pull-discovery-description"
            data-opening-discovery="root-pull"
        >
            <div className="relative flex min-h-full items-center justify-center px-3 pb-[calc(var(--safe-area-bottom)+16px)] pt-[calc(var(--safe-area-top)+14px)] sm:px-6">
                <motion.section
                    className="w-full max-w-2xl text-center"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
                >
                    <p className="relative mx-auto w-fit rounded-full border-2 border-[#f7e8bd]/70 bg-[#173f49] px-4 py-1.5 text-xs font-black tracking-[0.12em] text-[#fff4ce] shadow-lg">
                        <span className="inline-flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#f4c64f]" aria-hidden="true" />
                            スポン！ 大発見
                        </span>
                    </p>

                    <div className="explore-paper-diorama relative mx-auto mt-3 w-[min(76vw,340px)] overflow-hidden rounded-[30px]" aria-hidden="true">
                        <RootPullOpeningArt
                            stage="comic-release"
                            reducedMotion={Boolean(reduceMotion)}
                            decorative
                        />
                    </div>

                    <div className="explore-research-book relative mx-auto -mt-4 max-w-xl rounded-[28px] px-4 pb-4 pt-6 sm:px-7 sm:pb-6">
                        <p className="text-xs font-black tracking-[0.12em] text-[var(--explore-mid)]">
                            さいごの ひと引き
                        </p>
                        <h2
                            id="root-pull-discovery-title"
                            aria-label="土から スポンと ぬけた 根っこの子"
                            className="mt-1 text-balance text-[clamp(24px,6vw,36px)] font-black leading-tight tracking-[-0.035em] text-[var(--explore-ink)]"
                        >
                            <span className="inline-block">土から スポンと</span>{" "}
                            <span className="inline-block">ぬけた 根っこの子</span>
                        </h2>
                        <p
                            id="root-pull-discovery-description"
                            className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-[var(--explore-muted)]"
                        >
                            根っこの子は ぽんっと着地。あいぼうは いきおいで しりもち！
                        </p>

                        <button
                            ref={continueButtonRef}
                            type="button"
                            onClick={onContinue}
                            aria-keyshortcuts="Enter Escape"
                            className="explore-primary-action explore-focus-ring mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[16px] text-sm font-black transition active:scale-[0.98]"
                        >
                            つぎの しかけへ
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};
