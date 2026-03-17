import React from "react";
import { Button } from "../ui/Button";

interface ChoiceGroupProps {
    choices: { label: string; value: string }[];
    onSelect: (value: string) => void;
    disabled?: boolean;
}

export const ChoiceGroup: React.FC<ChoiceGroupProps> = ({ choices, onSelect, disabled }) => {
    return (
        <div className="grid h-full min-h-[30vh] w-full grid-cols-2 gap-3 rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.16))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] land:min-h-[32vh]">
            {choices.map((choice) => (
                <Button
                    key={choice.value}
                    onClick={() => onSelect(choice.value)}
                    disabled={disabled}
                    variant="ghost"
                    className="flex h-full flex-col gap-2 rounded-[24px] border border-white/80 bg-white/76 text-2xl font-bold text-slate-700 shadow-[0_18px_30px_-22px_rgba(15,23,42,0.28)] transition-all hover:bg-white/88 active:border-cyan-200 active:bg-cyan-50/70 land:text-xl"
                >
                    <span className="text-[clamp(1.5rem,5vw,2.5rem)] leading-tight break-keep">{choice.label}</span>
                </Button>
            ))}
        </div>
    );
};
