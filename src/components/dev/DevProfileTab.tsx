import React from "react";
import { UserProfile } from "../../domain/types";

interface DevProfileTabProps {
    profile: UserProfile;
    onUpdate: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
}

interface FieldRowProps {
    label: string;
    code: string;
    value: string | number | boolean | undefined;
    editable?: boolean;
    type?: "text" | "number" | "boolean" | "select";
    options?: { value: string; label: string }[];
    onChange?: (value: any) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
    label, code, value, editable = false, type = "text", options, onChange
}) => {
    const displayValue = value === undefined ? "(未設定)" : String(value);

    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div className="flex-1">
                <span className="text-sm text-slate-700">{label}</span>
                <code className="ml-2 text-xs text-slate-400 bg-slate-100 px-1 rounded">{code}</code>
            </div>
            <div className="flex-shrink-0 ml-4">
                {editable && type === "boolean" ? (
                    <button
                        onClick={() => onChange?.(!value)}
                        className={`px-3 py-1 rounded text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}
                    >
                        {value ? "ON" : "OFF"}
                    </button>
                ) : editable && type === "select" && options ? (
                    <select
                        value={String(value)}
                        onChange={e => onChange?.(e.target.value)}
                        className="text-sm border border-slate-200 rounded px-2 py-1"
                    >
                        {options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : editable && type === "number" ? (
                    <input
                        type="number"
                        value={value as number}
                        onChange={e => onChange?.(Number(e.target.value))}
                        className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                    />
                ) : editable && type === "text" ? (
                    <input
                        type="text"
                        value={String(value ?? "")}
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

export const DevProfileTab: React.FC<DevProfileTabProps> = ({ profile, onUpdate }) => {
    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">基本情報</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow label="ID" code="id" value={profile.id} />
                <FieldRow
                    label="名前"
                    code="name"
                    value={profile.name}
                    editable
                    type="text"
                    onChange={v => onUpdate("name", v)}
                />
                <FieldRow
                    label="学年"
                    code="grade"
                    value={profile.grade}
                    editable
                    type="select"
                    options={[
                        { value: "0", label: "年長" },
                        { value: "1", label: "1年生" },
                        { value: "2", label: "2年生" },
                        { value: "3", label: "3年生" },
                        { value: "4", label: "4年生" },
                        { value: "5", label: "5年生" },
                        { value: "6", label: "6年生" },
                    ]}
                    onChange={v => onUpdate("grade", Number(v))}
                />
            </div>

            <h3 className="font-bold text-slate-700">設定</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow
                    label="出題モード"
                    code="subjectMode"
                    value={profile.subjectMode}
                    editable
                    type="select"
                    options={[
                        { value: "mix", label: "ミックス" },
                        { value: "math", label: "算数のみ" },
                        { value: "vocab", label: "英語のみ" },
                    ]}
                    onChange={v => onUpdate("subjectMode", v)}
                />
                <FieldRow
                    label="効果音"
                    code="soundEnabled"
                    value={profile.soundEnabled}
                    editable
                    type="boolean"
                    onChange={v => onUpdate("soundEnabled", v)}
                />
                <FieldRow
                    label="漢字表示"
                    code="kanjiMode"
                    value={profile.kanjiMode}
                    editable
                    type="boolean"
                    onChange={v => onUpdate("kanjiMode", v)}
                />
                <FieldRow
                    label="英語自動読み"
                    code="englishAutoRead"
                    value={profile.englishAutoRead}
                    editable
                    type="boolean"
                    onChange={v => onUpdate("englishAutoRead", v)}
                />
                <FieldRow
                    label="日次目標"
                    code="dailyGoal"
                    value={profile.dailyGoal}
                    editable
                    type="number"
                    onChange={v => onUpdate("dailyGoal", v)}
                />
            </div>
        </div>
    );
};
