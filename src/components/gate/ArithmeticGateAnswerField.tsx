import React, { useId } from "react";
import { cn } from "../../utils/cn";

interface ArithmeticGateAnswerFieldProps {
    prompt: string;
    answer: string;
    onAnswerChange: (answer: string) => void;
    inputRef?: React.Ref<HTMLInputElement>;
    placeholder: string;
    inputType: React.InputHTMLAttributes<HTMLInputElement>["type"];
    inputMode: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
    inputPattern: string;
    errorText?: string;
    questionClassName?: string;
}

export const ArithmeticGateAnswerField: React.FC<ArithmeticGateAnswerFieldProps> = ({
    prompt,
    answer,
    onAnswerChange,
    inputRef,
    placeholder,
    inputType,
    inputMode,
    inputPattern,
    errorText,
    questionClassName,
}) => {
    const id = useId();
    const promptId = `${id}-prompt`;
    const inputId = `${id}-answer`;
    const errorId = `${id}-error`;
    const describedBy = errorText ? `${promptId} ${errorId}` : promptId;

    return (
        <div className="space-y-4">
            <div
                id={promptId}
                className={cn(
                    "rounded-[20px] border border-white/80 bg-white/58 px-4 py-4 text-center text-2xl font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]",
                    questionClassName
                )}
            >
                {prompt}
            </div>

            <div>
                <label htmlFor={inputId} className="sr-only">答え</label>
                <input
                    ref={inputRef}
                    id={inputId}
                    type={inputType}
                    inputMode={inputMode}
                    pattern={inputPattern}
                    value={answer}
                    onChange={(event) => onAnswerChange(event.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={errorText ? true : undefined}
                    className={cn(
                        "w-full rounded-[18px] border px-4 py-3 text-center text-2xl font-black text-slate-800 outline-none transition-all app-glass focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
                        errorText
                            ? "border-red-200 bg-red-50/80 text-red-600"
                            : "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200/70"
                    )}
                    placeholder={placeholder}
                />
                {errorText && (
                    <p id={errorId} role="status" aria-live="polite" className="mt-2 text-center text-xs font-bold text-red-500">
                        {errorText}
                    </p>
                )}
            </div>
        </div>
    );
};
