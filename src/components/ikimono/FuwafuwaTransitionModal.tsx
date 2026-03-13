import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
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
    note: string;
    button: string;
    accent: string;
    chip?: string;
}

function getMilestoneCopy(modal: MilestoneModal): TransitionCopy {
    switch (modal.milestone) {
        case "birth":
            return {
                emoji: "🫧",
                title: "ふわふわが うまれたよ",
                body: "ちいさな ふわふわが\nここに やってきたよ。",
                note: "なまえを つけてあげよう。",
                button: "あいにいく",
                accent: "from-teal-300 via-cyan-200 to-sky-100",
                chip: "はじめまして",
            };
        case "growth":
            return {
                emoji: "🌱",
                title: "すこし そだったよ",
                body: "ふわふわが すこしずつ\nじぶんの リズムを みつけてる。",
                note: `${modal.daysAlive}にちめの へんか だよ。`,
                button: "みてみる",
                accent: "from-emerald-200 via-lime-100 to-cyan-50",
                chip: "せいちょう",
            };
        case "adult":
            return {
                emoji: "🌟",
                title: "ふわふわが おとなになったよ",
                body: "しずかに たよりになる\nふんいきが でてきたね。",
                note: "ここまで いっしょに これたね。",
                button: "すてき",
                accent: "from-amber-200 via-yellow-100 to-orange-50",
                chip: "おとな",
            };
        case "farewell_soon":
            return {
                emoji: "🍃",
                title: "もうすぐ たびだつみたい",
                body: "ふわふわが すこしずつ\nつぎの たびじたくを してる。",
                note: "いまの じかんも たいせつに しよう。",
                button: "いっしょにいる",
                accent: "from-rose-100 via-orange-50 to-amber-50",
                chip: "よいん",
            };
    }
}

function getFarewellCopy(modal: FarewellModal): TransitionCopy {
    const displayName = modal.name || "ふわふわ";
    const isAdultFarewell = modal.stage === "adult" || modal.stage === "fading";

    return {
        emoji: isAdultFarewell ? "🌈" : "💫",
        title: isAdultFarewell ? `${displayName}が たびだつよ` : `${displayName}が そっと かぜにのるよ`,
        body: isAdultFarewell
            ? `${modal.daysAlive}にちかん、\nいっしょに すごしてくれて ありがとう。`
            : `${modal.daysAlive}にちかん、\nやさしく そだってくれたね。`,
        note: "つぎの たまごも すぐに やってくるよ。",
        button: "みおくる",
        accent: isAdultFarewell ? "from-amber-100 via-orange-50 to-rose-50" : "from-rose-100 via-pink-50 to-purple-50",
    };
}

function getWelcomeCopy(): TransitionCopy {
    return {
        emoji: "🥚",
        title: "あたらしい たまごが きたよ",
        body: "つぎの ふわふわが\nしずかに ねむってる。",
        note: "また ここから いっしょに そだてよう。",
        button: "よろしくね",
        accent: "from-cyan-200 via-teal-100 to-sky-50",
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

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center bg-white/50 p-5 backdrop-blur-md"
            >
                <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 280, damping: 24 }}
                    className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/85 bg-white/95 shadow-[0_34px_80px_-42px_rgba(15,23,42,0.55)]"
                >
                    <div className={`bg-gradient-to-b ${content.accent} px-6 pt-7 pb-6 text-center`}>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.48),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.34),transparent_20%)]" />
                        <motion.div
                            animate={{ y: [0, -5, 0], scale: [1, 1.04, 1] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                            className="relative z-10 mb-4 text-5xl"
                        >
                            {content.emoji}
                        </motion.div>

                        <motion.div
                            initial={{ scale: 0.86, rotate: -4 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.08 }}
                            className="relative z-10 mx-auto mb-5 h-28 w-28 rounded-full border-[4px] border-white/90 bg-white p-1 shadow-[0_20px_48px_-28px_rgba(15,23,42,0.5)]"
                        >
                            <div className="h-full w-full rounded-full bg-white">
                                {renderImage(modal.species, imageStage)}
                            </div>
                        </motion.div>

                        {"chip" in content && content.chip ? (
                            <div className="relative z-10 mb-3 inline-flex rounded-full border border-white/75 bg-white/70 px-3 py-1 text-[11px] font-black tracking-wide text-slate-600">
                                {content.chip}
                            </div>
                        ) : null}

                        <h2 className="relative z-10 text-[1.35rem] font-black leading-tight text-slate-800">
                            {content.title}
                        </h2>
                    </div>

                    <div className="px-6 pt-5 pb-6 text-center">
                        <p className="whitespace-pre-line text-sm font-bold leading-7 text-slate-700">
                            {content.body}
                        </p>
                        <p className="mt-3 text-xs font-bold leading-6 text-slate-500">
                            {content.note}
                        </p>

                        <button
                            type="button"
                            onClick={buttonAction}
                            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(140deg,#0ea5a4_0%,#14b8a6_52%,#38bdf8_100%)] px-5 py-4 text-base font-black text-white shadow-[0_18px_34px_-18px_rgba(8,145,178,0.8)] transition active:scale-[0.985]"
                        >
                            {content.button}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
};
