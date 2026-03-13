import React from "react";

export type DevFieldValue = string | number | boolean | null | undefined;
export type DevFieldChangeValue = string | number | boolean | undefined;

export interface DevFieldOption {
    value: string;
    label: string;
}

interface DevFieldRowProps {
    label: string;
    code: string;
    value: DevFieldValue;
    editable?: boolean;
    type?: "text" | "number" | "boolean" | "select";
    options?: readonly DevFieldOption[];
    onChange?: (value: DevFieldChangeValue) => void;
}

export const DevFieldRow: React.FC<DevFieldRowProps> = ({
    label,
    code,
    value,
    editable = false,
    type = "text",
    options,
    onChange
}) => {
    const displayValue = value === undefined || value === null ? "(未設定)" : String(value);

    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div className="flex-1">
                <span className="text-sm text-slate-700">{label}</span>
                <code className="ml-2 text-xs text-slate-400 bg-slate-100 px-1 rounded">{code}</code>
            </div>
            <div className="flex-shrink-0 ml-4">
                {editable && type === "boolean" ? (
                    <button
                        onClick={() => onChange?.(value !== true)}
                        className={`px-3 py-1 rounded text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}
                    >
                        {value ? "ON" : "OFF"}
                    </button>
                ) : editable && type === "select" && options ? (
                    <select
                        value={value == null ? "" : String(value)}
                        onChange={e => onChange?.(e.target.value)}
                        className="text-sm border border-slate-200 rounded px-2 py-1"
                    >
                        {options.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                ) : editable && type === "number" ? (
                    <input
                        type="number"
                        value={typeof value === "number" ? value : ""}
                        onChange={e => onChange?.(e.target.value === "" ? undefined : Number(e.target.value))}
                        className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                    />
                ) : editable && type === "text" ? (
                    <input
                        type="text"
                        value={typeof value === "string" ? value : ""}
                        onChange={e => onChange?.(e.target.value)}
                        className="w-32 text-sm border border-slate-200 rounded px-2 py-1"
                    />
                ) : (
                    <span className="text-sm text-slate-600">{displayValue}</span>
                )}
            </div>
        </div>
    );
};
