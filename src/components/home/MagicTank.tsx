import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";

interface MagicTankProps {
    currentValue: number;
    maxValue: number;
    onRelease?: () => void;
    ariaLabel?: string;
    isSending?: boolean;
    className?: string;
}

export const MagicTank: React.FC<MagicTankProps> = ({
    currentValue,
    maxValue,
    onRelease,
    ariaLabel = "まほうタンク",
    isSending = false,
    className,
}) => {
    const fillPercentage = Math.min((currentValue / Math.max(1, maxValue)) * 100, 100);
    const isFull = currentValue >= maxValue;
    const isAlmostFull = fillPercentage >= 90 && !isFull && !isSending;
    const isInteractive = isFull && onRelease && !isSending;
    const bottleScale = isSending ? 1.09 : isFull ? 1.05 : isAlmostFull ? 1.03 : 1;
    const bottleShadow = isSending
        ? "0 12px 30px rgba(253, 203, 110, 0.34), inset 0 2px 10px rgba(255, 255, 255, 1)"
        : isFull
            ? "0 10px 28px rgba(253, 203, 110, 0.28), inset 0 2px 10px rgba(255, 255, 255, 1)"
            : isAlmostFull
                ? "0 10px 26px rgba(43, 186, 160, 0.2), inset 0 2px 10px rgba(255, 255, 255, 1)"
                : "0 8px 32px rgba(43, 186, 160, 0.15), inset 0 2px 10px rgba(255, 255, 255, 1)";

    return (
        <div className={cn("flex items-center justify-center", className)}>
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {(isAlmostFull || isFull || isSending) ? (
                    <motion.div
                        aria-hidden="true"
                        animate={isSending
                            ? { opacity: [0.3, 0.7, 0.15], scale: [0.95, 1.15, 1.28] }
                            : isFull
                                ? { opacity: [0.2, 0.45, 0.2], scale: [0.98, 1.08, 0.98] }
                                : { opacity: [0.14, 0.26, 0.14], scale: [0.98, 1.04, 0.98] }}
                        transition={{
                            duration: isSending ? 0.9 : isFull ? 1.8 : 2.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{
                            position: "absolute",
                            inset: -8,
                            borderRadius: 40,
                            background: isSending
                                ? "radial-gradient(circle, rgba(255,234,167,0.36) 0%, rgba(253,203,110,0.08) 70%, rgba(253,203,110,0) 100%)"
                                : isFull
                                    ? "radial-gradient(circle, rgba(255,234,167,0.32) 0%, rgba(253,203,110,0.08) 70%, rgba(253,203,110,0) 100%)"
                                    : "radial-gradient(circle, rgba(43,186,160,0.18) 0%, rgba(43,186,160,0.03) 72%, rgba(43,186,160,0) 100%)",
                            pointerEvents: "none",
                        }}
                    />
                ) : null}

                <div
                    onClick={isInteractive ? onRelease : undefined}
                    onKeyDown={isInteractive
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onRelease();
                            }
                        }
                        : undefined}
                    role={isInteractive ? "button" : "img"}
                    aria-label={isInteractive ? `${ariaLabel}。タップで ふわふわに とどける` : ariaLabel}
                    tabIndex={isInteractive ? 0 : -1}
                    style={{
                        position: "relative",
                        width: 60,
                        height: 70,
                        borderRadius: "30px 30px 16px 16px",
                        background: "rgba(255, 255, 255, 0.4)",
                        border: "3px solid rgba(255, 255, 255, 0.8)",
                        boxShadow: bottleShadow,
                        overflow: "hidden",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        cursor: isInteractive ? "pointer" : "default",
                        transform: `scale(${bottleScale})`,
                        transition: "transform 0.28s ease, box-shadow 0.28s ease",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: -2,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 24,
                            height: 12,
                            background: "rgba(255, 255, 255, 0.7)",
                            borderRadius: "0 0 6px 6px",
                            zIndex: 3,
                        }}
                    />

                    <motion.div
                        initial={{ height: 0 }}
                        animate={{
                            height: `${fillPercentage}%`,
                            filter: isSending ? ["brightness(1)", "brightness(1.16)", "brightness(1)"] : "brightness(1)",
                        }}
                        transition={{
                            height: { type: "spring", damping: 15, stiffness: 100 },
                            filter: { duration: 0.7, repeat: isSending ? Infinity : 0, ease: "easeInOut" },
                        }}
                        style={{
                            width: "100%",
                            background: isFull
                                ? "linear-gradient(180deg, #FFEAA7 0%, #FDCB6E 100%)"
                                : "linear-gradient(180deg, #A8E6CF 0%, #3AEDC6 100%)",
                            boxShadow: isFull ? "0 -4px 12px rgba(253, 203, 110, 0.6)" : "0 -4px 12px rgba(58, 237, 198, 0.4)",
                            position: "relative",
                            zIndex: 1,
                            borderRadius: "0 0 12px 12px",
                        }}
                    >
                        {fillPercentage > 0 && !isFull ? (
                            <motion.div
                                animate={{ x: ["-20%", "0%"] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                style={{
                                    position: "absolute",
                                    top: -4,
                                    left: 0,
                                    width: "200%",
                                    height: 8,
                                    background: "rgba(255, 255, 255, 0.4)",
                                    borderRadius: "50%",
                                }}
                            />
                        ) : null}

                        {isSending ? (
                            <motion.div
                                aria-hidden="true"
                                animate={{ y: ["120%", "-120%"], opacity: [0, 0.9, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                                style={{
                                    position: "absolute",
                                    inset: "-10% 24%",
                                    background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.78) 45%, rgba(255,255,255,0) 100%)",
                                    transform: "rotate(8deg)",
                                }}
                            />
                        ) : null}
                    </motion.div>

                    {isFull ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={isSending
                                ? { opacity: [0.7, 1, 0.7], scale: [0.95, 1.22, 0.95], rotate: [0, 16, -16, 0] }
                                : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9], rotate: [0, 10, -10, 0] }}
                            transition={{ duration: isSending ? 0.95 : 2, repeat: Infinity }}
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                zIndex: 2,
                                color: "#FFF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Sparkles size={24} fill="white" />
                        </motion.div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
