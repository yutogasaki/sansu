import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ArithmeticGateAnswerField } from "./ArithmeticGateAnswerField";
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
    const answerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setChallenge(challengeFactory());
        setAnswer("");
        setError(false);
    }, [challengeFactory, isOpen]);

    useEffect(() => {
        if (error) {
            answerInputRef.current?.focus();
        }
    }, [challenge, error]);

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

                <form id="arithmetic-gate-form" onSubmit={handleSubmit} className="space-y-4">
                    <ArithmeticGateAnswerField
                        prompt={challenge.prompt}
                        answer={answer}
                        inputRef={answerInputRef}
                        onAnswerChange={(value) => {
                            setAnswer(normalizeGateAnswer(value));
                            setError(false);
                        }}
                        placeholder={placeholder}
                        inputType={inputType}
                        inputMode={inputMode}
                        inputPattern={inputPattern}
                        errorText={showErrorState ? errorText : undefined}
                        questionClassName={questionClassName}
                    />
                </form>
            </div>
        </Modal>
    );
};
