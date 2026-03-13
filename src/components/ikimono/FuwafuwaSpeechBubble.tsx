import { motion } from "framer-motion";
import { FuwafuwaReactionStyle, FuwafuwaSpeechAccent } from "./fuwafuwaSpeech";

interface FuwafuwaSpeechBubbleProps {
    lines: string[];
    accent: FuwafuwaSpeechAccent;
    reactionStyle: FuwafuwaReactionStyle;
    actionLabel?: string;
    onAction?: () => void;
    onTap?: () => void;
}

const ACCENT_PALETTE: Record<FuwafuwaSpeechAccent, { color: string; background: string; border: string }> = {
    everyday: {
        color: "#0f766e",
        background: "rgba(240, 253, 250, 0.88)",
        border: "rgba(45, 212, 191, 0.28)",
    },
    magic: {
        color: "#b45309",
        background: "rgba(255, 251, 235, 0.92)",
        border: "rgba(251, 191, 36, 0.3)",
    },
    event: {
        color: "#0369a1",
        background: "rgba(240, 249, 255, 0.92)",
        border: "rgba(56, 189, 248, 0.28)",
    },
    ambient: {
        color: "#9f1239",
        background: "rgba(255, 241, 242, 0.9)",
        border: "rgba(251, 113, 133, 0.24)",
    },
};

function getMotionLoop(reactionStyle: FuwafuwaReactionStyle) {
    switch (reactionStyle) {
        case "celebrating":
            return {
                animate: { y: [0, -4, 0], scale: [1, 1.016, 1] },
                transition: { duration: 2.1, repeat: Infinity, ease: "easeInOut" as const },
            };
        case "sharing":
            return {
                animate: { x: [0, -2, 2, 0], y: [0, -1, 0] },
                transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const },
            };
        case "growing":
            return {
                animate: { scale: [1, 1.01, 1], y: [0, -2, 0] },
                transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const },
            };
        case "guiding":
            return {
                animate: { rotate: [0, -0.6, 0.6, 0], y: [0, -1, 0] },
                transition: { duration: 3.1, repeat: Infinity, ease: "easeInOut" as const },
            };
        case "cozy":
        default:
            return {
                animate: { y: [0, -2, 0], scale: [1, 1.006, 1] },
                transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const },
            };
    }
}

export const FuwafuwaSpeechBubble: React.FC<FuwafuwaSpeechBubbleProps> = ({
    lines,
    accent,
    reactionStyle,
    actionLabel,
    onAction,
    onTap,
}) => {
    const palette = ACCENT_PALETTE[accent];
    const visibleLines = lines.filter((line) => line.trim().length > 0);
    const motionLoop = getMotionLoop(reactionStyle);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
        >
            <motion.div
                onClick={onTap}
                {...motionLoop}
                className="relative max-w-[18rem] rounded-[1.65rem] px-4 py-3 text-center shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md"
                style={{
                    background: palette.background,
                    border: `1px solid ${palette.border}`,
                    color: palette.color,
                    cursor: onTap ? "pointer" : "default",
                }}
            >
                <div className="flex flex-col items-center gap-0.5 text-sm font-black leading-relaxed">
                    {visibleLines.map((line, index) => (
                        <span key={`${line}-${index}`}>{line}</span>
                    ))}
                </div>

                {actionLabel && onAction ? (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onAction();
                        }}
                        className="mt-3 rounded-full bg-white/80 px-3 py-1 text-xs font-black shadow-sm transition hover:bg-white"
                        style={{ color: palette.color }}
                    >
                        {actionLabel}
                    </button>
                ) : null}

                <div
                    className="absolute left-1/2 bottom-[-8px] h-4 w-4 -translate-x-1/2 rotate-45"
                    style={{
                        background: palette.background,
                        borderRight: `1px solid ${palette.border}`,
                        borderBottom: `1px solid ${palette.border}`,
                    }}
                />
            </motion.div>
        </motion.div>
    );
};
