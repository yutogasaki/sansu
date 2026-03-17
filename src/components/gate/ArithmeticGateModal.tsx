import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { cn } from "../../utils/cn";
import { ArithmeticGateChallenge, normalizeGateAnswer } from "./arithmeticGate";

interface ArithmeticGateModalProps {
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    challengeFactory: () => ArithmeticGateChallenge;
    onCancel: () => void;
    onSuccess: () => void;
    placeholder?: string;
    errorText?: string;
    refreshOnError?: boolean;
    inputType?: React.InputHTMLAttributes<HTMLInputElement>["type"];
    inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
    inputPattern?: string;
    questionClassName?: string;
}

export const ArithmeticGateModal: React.FC<ArithmeticGateModalProps> = ({
    isOpen,
    title,
    description,
    challengeFactory,
    onCancel,
    onSuccess,
    placeholder = "?",
    errorText,
    refreshOnError = false,
    inputType = "tel",
    inputMode = "numeric",
    inputPattern = "[0-9]*",
    questionClassName,
}) => {
    const [challenge, setChallenge] = useState<ArithmeticGateChallenge | null>(null);
    const [answer, setAnswer] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setChallenge(challengeFactory());
        setAnswer("");
        setError(false);
    }, [challengeFactory, isOpen]);

    if (!isOpen || !challenge) {
        return null;
    }

    const showErrorState = error && Boolean(errorText);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (normalizeGateAnswer(answer) === challenge.answer) {
            onSuccess();
            return;
        }

        setError(Boolean(errorText));
        setAnswer("");
        if (refreshOnError) {
            setChallenge(challengeFactory());
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            footer={(
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={onCancel}
                    >
                        やめる
                    </Button>
                    <Button
                        type="submit"
                        form="arithmetic-gate-form"
                        className="flex-1"
                        disabled={!answer}
                    >
                        OK
                    </Button>
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="text-center text-sm leading-6 text-slate-500">{description}</div>

                <div
                    className={cn(
                        "rounded-[20px] border border-white/80 bg-white/58 px-4 py-4 text-center text-2xl font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
                        questionClassName
                    )}
                >
                    {challenge.prompt}
                </div>

                <form id="arithmetic-gate-form" onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <input
                            type={inputType}
                            inputMode={inputMode}
                            pattern={inputPattern}
                            value={answer}
                            onChange={(event) => {
                                setAnswer(normalizeGateAnswer(event.target.value));
                                setError(false);
                            }}
                            className={cn(
                                "w-full rounded-[18px] border px-4 py-3 text-center text-2xl font-black text-slate-800 outline-none transition-all app-glass",
                                showErrorState
                                    ? "border-red-200 bg-red-50/80 text-red-600"
                                    : "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200/70"
                            )}
                            placeholder={placeholder}
                            autoFocus
                        />
                        {showErrorState && (
                            <p className="mt-2 text-center text-xs font-bold text-red-500">{errorText}</p>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
};
