import React from "react";

interface FieldConfig {
    label: string;
    length: number; // max digits (deprecated for width, used for logic if needed)
}

interface MultiNumberInputProps {
    fields: FieldConfig[];
    values: string[]; // ['12', '3'] corresponding to fields
    activeIndex: number;
    onFocus: (index: number) => void;
    readOnly?: boolean;
}

export const MultiNumberInput: React.FC<MultiNumberInputProps> = ({
    fields,
    values,
    activeIndex,
    onFocus,
    readOnly = false
}) => {
    return (
        <div className="flex items-center justify-center gap-4 py-2 land:py-4">
            {fields.map((field, idx) => {
                const val = values[idx] || "";
                // Base width of 4rem (approx 64px) + 1rem per character (approx 16px)
                // This simulates "auto-expand" while keeping a minimum size
                const widthStyle = { minWidth: "4rem", width: `${Math.max(2, val.length) * 1.5 + 2}rem` };

                return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                        {/* Label */}
                        <span className="text-sm font-bold text-slate-500">{field.label}</span>

                        {/* Input Box - Auto expanding width */}
                        <div
                            onClick={() => !readOnly && onFocus(idx)}
                            style={widthStyle}
                            className={`
                                relative h-[var(--tenkey-key,44px)] min-h-[44px] px-2 rounded-xl flex items-center justify-center
                                text-4xl font-mono border-b-4 transition-all cursor-pointer box-content ipadland:h-16
                                ${activeIndex === idx
                                    ? "bg-white border-blue-500 shadow-md transform -translate-y-1"
                                    : "bg-slate-100 border-slate-300 text-slate-400"
                                }
                            `}
                        >
                            {val}
                            {/* Cursor Blinker */}
                            {activeIndex === idx && !readOnly && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-0.5 h-[60%] bg-blue-500 animate-pulse" />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
