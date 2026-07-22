import React from "react";
import type { Problem } from "../../domain/types";
import { exploreProblemUsesDecimal } from "../../domain/explore";
import { TenKey } from "../domain/TenKey";
import { appendExploreAnswerInput, deleteExploreAnswerInput } from "./exploreAnswerInput";

interface ExploreAnswerPadProps {
    problem: Problem;
    answer: string;
    disabled: boolean;
    className?: string;
    onAnswerChange: (answer: string) => void;
    onSubmit: () => void;
}

export const ExploreAnswerPad: React.FC<ExploreAnswerPadProps> = ({
    problem,
    answer,
    disabled,
    className,
    onAnswerChange,
    onSubmit,
}) => (
    <TenKey
        compact
        disabled={disabled}
        enterDisabled={answer.length === 0}
        minRowHeight={44}
        className={className}
        onInput={(value) => {
            if (disabled) return;
            onAnswerChange(appendExploreAnswerInput(answer, value, problem));
        }}
        onDelete={() => onAnswerChange(deleteExploreAnswerInput(answer))}
        onClear={() => onAnswerChange("")}
        onEnter={onSubmit}
        showDecimal={exploreProblemUsesDecimal(problem)}
    />
);
