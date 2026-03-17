import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { InsetPanel, SurfacePanel } from "../ui/SurfacePanel";
import { cn } from "../../utils/cn";
import { getFuwafuwaDisplayStage } from "./fuwafuwaVisuals";
import { FuwafuwaMilestoneKind, VisibleIkimonoStage } from "./fuwafuwaMilestones";

type MilestoneModal = {
    kind: "milestone";
    milestone: FuwafuwaMilestoneKind;
    species: number;
    stage: VisibleIkimonoStage;
    name?: string;
    daysAlive: number;
};

type FarewellModal = {
    kind: "farewell";
    species: number;
    stage: VisibleIkimonoStage;
    name?: string;
    daysAlive: number;
};

type WelcomeModal = {
    kind: "welcome";
    species: number;
};

export type FuwafuwaTransitionModalState = MilestoneModal | FarewellModal | WelcomeModal | null;

interface FuwafuwaTransitionModalProps {
    modal: FuwafuwaTransitionModalState;
    onClose: () => void;
    onFarewellContinue?: () => void;
}

interface TransitionCopy {
    emoji: string;
    title: string;
    body: string;
    meta?: string;
    button: string;
    accent: string;
    chip?: string;
    chipVariant?: "primary" | "neutral" | "success" | "warning";
}

function getMilestoneCopy(modal: MilestoneModal): TransitionCopy {
    switch (modal.milestone) {
        case "birth":
            return {
                emoji: "🫧",
                title: "ふわふわが うまれたよ",
                body: "ちいさな ふわふわが きたよ。",
                meta: "なまえを つけよう。",
                button: "みにいく",
                accent: "from-teal-200/95 via-white/86 to-cyan-50/95",
                chip: "はじめまして",
                chipVariant: "primary",
            };
        case "growth":
            return {
                emoji: "🌱",
                title: "すこし そだったよ",
                body: "じぶんの リズムが でてきたよ。",
                meta: "また すこし かわったね。",
                button: "みる",
                accent: "from-emerald-100/95 via-white/86 to-cyan-50/95",
                chip: "せいちょう",
                chipVariant: "success",
            };
        case "adult":
            return {
                emoji: "🌟",
                title: "ふわふわが おとなになったよ",
                body: "おちついた ふんいきに なってきたね。",
                meta: "ここまで いっしょに これたね。",
                button: "すてき",
                accent: "from-amber-100/95 via-white/88 to-orange-50/95",
                chip: "おとな",
                chipVariant: "warning",
            };
        case "farewell_soon":
            return {
                emoji: "🍃",
                title: "もうすぐ たびだつみたい",
                body: "しずかに たびじたくを してるみたい。",
                meta: "いまの じかんを たいせつに。",
                button: "みにいく",
                accent: "from-rose-50/95 via-white/88 to-amber-50/95",
                chip: "よいん",
                chipVariant: "warning",
            };
    }
}

function getFarewellCopy(modal: FarewellModal): TransitionCopy {
    const displayName = modal.name || "ふわふわ";
    const isAdultFarewell = modal.stage === "adult" || modal.stage === "fading";

    return {
        emoji: isAdultFarewell ? "🌈" : "💫",
        title: isAdultFarewell ? `${displayName}が たびだつよ` : `${displayName}が そっと かぜにのるよ`,
        body: `${modal.daysAlive}にちかん ありがとう。`,
        meta: "つぎの たまごも すぐに くるよ。",
        button: "みおくる",
        accent: isAdultFarewell
            ? "from-amber-50/95 via-white/88 to-rose-50/95"
            : "from-rose-50/95 via-white/88 to-fuchsia-50/95",
    };
}

function getWelcomeCopy(): TransitionCopy {
    return {
        emoji: "🥚",
        title: "あたらしい たまごが きたよ",
        body: "つぎの ふわふわが しずかに ねむってる。",
        meta: "また ここから いっしょに。",
        button: "よろしくね",
        accent: "from-cyan-100/95 via-white/88 to-sky-50/95",
    };
}

function renderImage(species: number, stage: VisibleIkimonoStage | "egg") {
    const suffix = stage === "egg" ? 1 : getFuwafuwaDisplayStage(stage);
    return (
        <picture className="block h-full w-full overflow-hidden rounded-full bg-white">
            <source srcSet={`/ikimono/${species}-${suffix}.webp`} type="image/webp" />
            <img
                src={`/ikimono/${species}-${suffix}.png`}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
            />
        </picture>
    );
}

export const FuwafuwaTransitionModal: React.FC<FuwafuwaTransitionModalProps> = ({
    modal,
    onClose,
    onFarewellContinue,
}) => {
    if (!modal) return null;

    const content = modal.kind === "milestone"
        ? getMilestoneCopy(modal)
        : modal.kind === "farewell"
            ? getFarewellCopy(modal)
            : getWelcomeCopy();

    const buttonAction = modal.kind === "farewell" && onFarewellContinue ? onFarewellContinue : onClose;
    const imageStage = modal.kind === "welcome" ? "egg" : modal.stage;
    const dayBadge = modal.kind === "milestone"
        ? modal.milestone === "birth"
            ? null
            : `${modal.daysAlive}にちめ`
        : modal.kind === "farewell"
            ? `${modal.daysAlive}にち`
            : null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/18 p-5 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 280, damping: 24 }}
                    className="relative w-full max-w-sm"
                >
                    <SurfacePanel className="space-y-0 overflow-hidden p-0 shadow-[0_30px_70px_-38px_rgba(15,23,42,0.52)]">
                        <div className={cn("relative px-6 pt-5 pb-5 text-center", `bg-gradient-to-b ${content.accent}`)}>
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.48),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.3),transparent_18%)]" />

                            <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
                                {content.chip ? (
                                    <Badge variant={content.chipVariant ?? "neutral"}>
                                        {content.chip}
                                    </Badge>
                                ) : null}
                                {dayBadge ? (
                                    <Badge variant="neutral" className="bg-white/84 text-slate-500">
                                        {dayBadge}
                                    </Badge>
                                ) : null}
                            </div>

                            <motion.div
                                initial={{ scale: 0.88, rotate: -4 }}
                                animate={{ scale: 1, rotate: 0, y: [0, -4, 0] }}
                                transition={{
                                    scale: { type: "spring", stiffness: 220, damping: 16, delay: 0.08 },
                                    rotate: { type: "spring", stiffness: 220, damping: 16, delay: 0.08 },
                                    y: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
                                }}
                                className="relative z-10 mx-auto mt-4 h-24 w-24 rounded-full border-[3px] border-white/90 bg-white/92 p-1 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]"
                            >
                                <div className="h-full w-full rounded-full bg-white">
                                    {renderImage(modal.species, imageStage)}
                                </div>
                            </motion.div>
                        </div>

                        <div className="px-5 pt-4 pb-5">
                            <InsetPanel className="space-y-2 px-4 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-2xl" aria-hidden="true">{content.emoji}</span>
                                    <h2 className="text-[1.2rem] font-black leading-tight tracking-[-0.02em] text-slate-800">
                                        {content.title}
                                    </h2>
                                </div>
                                <p className="text-sm font-bold leading-6 text-slate-700">
                                    {content.body}
                                </p>
                                {content.meta ? (
                                    <p className="text-xs font-medium leading-5 text-slate-400">
                                        {content.meta}
                                    </p>
                                ) : null}
                            </InsetPanel>

                            <Button
                                type="button"
                                onClick={buttonAction}
                                size="xl"
                                className="mt-4 w-full shadow-lg shadow-cyan-200/70"
                            >
                                {content.button}
                            </Button>
                        </div>
                    </SurfacePanel>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
};
