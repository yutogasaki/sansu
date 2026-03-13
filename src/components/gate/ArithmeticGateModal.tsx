import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-center text-lg font-bold text-slate-700">{title}</h3>
                <div className="text-center text-sm text-slate-500">{description}</div>

                <div className={cn("text-center text-2xl font-bold text-slate-800", questionClassName)}>
                    {challenge.prompt}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                                "w-full rounded-xl border-2 p-3 text-center text-2xl font-bold transition-colors focus:outline-none",
                                showErrorState
                                    ? "border-red-300 bg-red-50 text-red-600"
                                    : "border-slate-200 text-slate-800 focus:border-primary"
                            )}
                            placeholder={placeholder}
                            autoFocus
                        />
                        {showErrorState && (
                            <p className="mt-2 text-center text-xs font-bold text-red-500">{errorText}</p>
                        )}
                    </div>

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
                            className="flex-1"
                            disabled={!answer}
                        >
                            OK
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
