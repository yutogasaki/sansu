import React from "react";
import { Button } from "../ui/Button";

interface ChoiceGroupProps {
    choices: { label: string; value: string }[];
    onSelect: (value: string) => void;
    disabled?: boolean;
}

export const ChoiceGroup: React.FC<ChoiceGroupProps> = ({ choices, onSelect, disabled }) => {
    return (
        <div className="grid grid-cols-2 gap-3 p-2 w-full h-full min-h-[30vh] land:min-h-[32vh]">
            {choices.map((choice) => (
                <Button
                    key={choice.value}
                    onClick={() => onSelect(choice.value)}
                    disabled={disabled}
                    variant="secondary"
                    className="h-full text-2xl font-bold flex flex-col gap-2 shadow-sm border-2 border-slate-100 active:border-yellow-300 active:bg-yellow-50 land:text-xl"
                >
                    <span className="text-[clamp(1.5rem,5vw,2.5rem)] leading-tight break-keep">{choice.label}</span>
                </Button>
            ))}
        </div>
    );
};
