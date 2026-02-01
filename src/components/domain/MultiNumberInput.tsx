import React from "react";

interface FieldConfig {
    label: string;
    length: number; // max digits (for width hint)
}

interface MultiNumberInputProps {
    fields: FieldConfig[];
    values: string[]; // ['12', '3'] corresponding to fields
    activeIndex: number;
    onFocus: (index: number) => void;
    readOnly?: boolean;
}

// lengthに応じた幅を計算
const getWidthClass = (length: number): string => {
    switch (length) {
        case 1: return "w-16";      // 64px - 1桁
        case 2: return "w-20";      // 80px - 2桁
        case 3: return "w-24";      // 96px - 3桁
        default: return "w-28";     // 112px - 4桁以上
    }
};

export const MultiNumberInput: React.FC<MultiNumberInputProps> = ({
    fields,
    values,
    activeIndex,
    onFocus,
    readOnly = false
}) => {
    return (
        <div className="flex items-center justify-center gap-4 py-8 land:py-4">
            {fields.map((field, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2">
                    {/* Label */}
                    <span className="text-sm font-bold text-slate-500">{field.label}</span>

                    {/* Input Box - サイズはlengthに応じて変更 */}
                    <div
                        onClick={() => !readOnly && onFocus(idx)}
                        className={`
                            relative ${getWidthClass(field.length)} h-16 px-2 rounded-xl flex items-center justify-center
                            text-4xl font-mono border-b-4 transition-all cursor-pointer
                            ${activeIndex === idx
                                ? "bg-white border-blue-500 shadow-md transform -translate-y-1"
                                : "bg-slate-100 border-slate-300 text-slate-400"
                            }
                        `}
                    >
                        {values[idx]}
                        {/* Cursor Blinker */}
                        {activeIndex === idx && !readOnly && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-blue-500 animate-pulse" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
