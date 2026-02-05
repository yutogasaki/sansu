import React from "react";
import { UserProfile } from "../../domain/types";

interface DevProgressTabProps {
    profile: UserProfile;
    onUpdate: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
    onUpdatePeriodicTest: (subject: 'math' | 'vocab', field: 'isPending', value: boolean) => void;
}

interface FieldRowProps {
    label: string;
    code: string;
    value: string | number | boolean | undefined | null;
    editable?: boolean;
    type?: "text" | "number" | "boolean";
    onChange?: (value: any) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
    label, code, value, editable = false, type = "text", onChange
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
                        onClick={() => onChange?.(!value)}
                        className={`px-3 py-1 rounded text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}
                    >
                        {value ? "ON" : "OFF"}
                    </button>
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

export const DevProgressTab: React.FC<DevProgressTabProps> = ({ profile, onUpdate, onUpdatePeriodicTest }) => {
    const mathTestState = profile.periodicTestState?.math;
    const vocabTestState = profile.periodicTestState?.vocab;

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">算数進捗</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow
                    label="現在レベル"
                    code="mathMainLevel"
                    value={profile.mathMainLevel}
                    editable
                    type="number"
                    onChange={v => onUpdate("mathMainLevel", Math.max(1, Math.min(20, v)))}
                />
                <FieldRow
                    label="最大解放"
                    code="mathMaxUnlocked"
                    value={profile.mathMaxUnlocked}
                    editable
                    type="number"
                    onChange={v => onUpdate("mathMaxUnlocked", Math.max(1, Math.min(20, v)))}
                />
            </div>

            <h3 className="font-bold text-slate-700">英語進捗</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow
                    label="現在レベル"
                    code="vocabMainLevel"
                    value={profile.vocabMainLevel}
                    editable
                    type="number"
                    onChange={v => onUpdate("vocabMainLevel", Math.max(1, Math.min(20, v)))}
                />
                <FieldRow
                    label="最大解放"
                    code="vocabMaxUnlocked"
                    value={profile.vocabMaxUnlocked}
                    editable
                    type="number"
                    onChange={v => onUpdate("vocabMaxUnlocked", Math.max(1, Math.min(20, v)))}
                />
            </div>

            <h3 className="font-bold text-slate-700">学習状況</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow
                    label="連続日数"
                    code="streak"
                    value={profile.streak}
                    editable
                    type="number"
                    onChange={v => onUpdate("streak", Math.max(0, v))}
                />
                <FieldRow
                    label="最終学習日"
                    code="lastStudyDate"
                    value={profile.lastStudyDate}
                    editable
                    type="text"
                    onChange={v => onUpdate("lastStudyDate", v)}
                />
                <FieldRow
                    label="本日回答数"
                    code="todayCount"
                    value={profile.todayCount}
                    editable
                    type="number"
                    onChange={v => onUpdate("todayCount", Math.max(0, v))}
                />
            </div>

            <h3 className="font-bold text-slate-700">定期テスト状態</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <FieldRow
                    label="算数テスト保留"
                    code="periodicTestState.math.isPending"
                    value={mathTestState?.isPending}
                    editable
                    type="boolean"
                    onChange={v => onUpdatePeriodicTest('math', 'isPending', v)}
                />
                <FieldRow
                    label="算数最終トリガー"
                    code="periodicTestState.math.lastTriggeredAt"
                    value={mathTestState?.lastTriggeredAt ? new Date(mathTestState.lastTriggeredAt).toLocaleString() : null}
                />
                <FieldRow
                    label="算数トリガー理由"
                    code="periodicTestState.math.reason"
                    value={mathTestState?.reason}
                />
                <FieldRow
                    label="英語テスト保留"
                    code="periodicTestState.vocab.isPending"
                    value={vocabTestState?.isPending}
                    editable
                    type="boolean"
                    onChange={v => onUpdatePeriodicTest('vocab', 'isPending', v)}
                />
                <FieldRow
                    label="英語最終トリガー"
                    code="periodicTestState.vocab.lastTriggeredAt"
                    value={vocabTestState?.lastTriggeredAt ? new Date(vocabTestState.lastTriggeredAt).toLocaleString() : null}
                />
                <FieldRow
                    label="英語トリガー理由"
                    code="periodicTestState.vocab.reason"
                    value={vocabTestState?.reason}
                />
            </div>
        </div>
    );
};
