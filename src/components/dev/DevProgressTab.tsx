import React from "react";
import { UserProfile } from "../../domain/types";
import { DevFieldRow, DevFieldChangeValue } from "./DevFieldRow";
import { useTransientState } from "../../hooks/useTransientState";
import { MAX_MATH_LEVEL, MAX_VOCAB_LEVEL } from "../../domain/math/curriculum";

interface DevProgressTabProps {
    profile: UserProfile;
    onUpdate: <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => void;
    onUpdatePeriodicTest: (subject: 'math' | 'vocab', field: 'isPending', value: boolean) => void;
}

const clampMathLevel = (value: DevFieldChangeValue, fallback: number) => {
    if (typeof value !== "number") {
        return fallback;
    }

    return Math.max(0, Math.min(MAX_MATH_LEVEL, value));
};

const clampVocabLevel = (value: DevFieldChangeValue, fallback: number) => {
    if (typeof value !== "number") {
        return fallback;
    }

    return Math.max(1, Math.min(MAX_VOCAB_LEVEL, value));
};

const clampNonNegative = (value: DevFieldChangeValue, fallback: number) => {
    if (typeof value !== "number") {
        return fallback;
    }

    return Math.max(0, value);
};

export const DevProgressTab: React.FC<DevProgressTabProps> = ({ profile, onUpdate, onUpdatePeriodicTest }) => {
    const mathTestState = profile.periodicTestState?.math;
    const vocabTestState = profile.periodicTestState?.vocab;
    const pendingPaperTests = profile.pendingPaperTests || [];
    const [statusMessage, showStatusMessage] = useTransientState<string>(2000);

    const toLocalInputValue = (iso?: string) => {
        if (!iso) return "";
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "";
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const fromLocalInputValue = (value: string) => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toISOString();
    };

    const setStatus = (text: string) => showStatusMessage(text);

    const updatePendingPaperTests = (next: typeof pendingPaperTests) => {
        onUpdate("pendingPaperTests", next.length > 0 ? next : undefined);
    };

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">算数進捗</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow
                    label="現在レベル"
                    code="mathMainLevel"
                    value={profile.mathMainLevel}
                    editable
                    type="number"
                    onChange={value => onUpdate("mathMainLevel", clampMathLevel(value, profile.mathMainLevel))}
                />
                <DevFieldRow
                    label="最大解放"
                    code="mathMaxUnlocked"
                    value={profile.mathMaxUnlocked}
                    editable
                    type="number"
                    onChange={value => onUpdate("mathMaxUnlocked", clampMathLevel(value, profile.mathMaxUnlocked))}
                />
            </div>

            <h3 className="font-bold text-slate-700">英語進捗</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow
                    label="現在レベル"
                    code="vocabMainLevel"
                    value={profile.vocabMainLevel}
                    editable
                    type="number"
                    onChange={value => onUpdate("vocabMainLevel", clampVocabLevel(value, profile.vocabMainLevel))}
                />
                <DevFieldRow
                    label="最大解放"
                    code="vocabMaxUnlocked"
                    value={profile.vocabMaxUnlocked}
                    editable
                    type="number"
                    onChange={value => onUpdate("vocabMaxUnlocked", clampVocabLevel(value, profile.vocabMaxUnlocked))}
                />
            </div>

            <h3 className="font-bold text-slate-700">学習状況</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow
                    label="連続日数"
                    code="streak"
                    value={profile.streak}
                    editable
                    type="number"
                    onChange={value => onUpdate("streak", clampNonNegative(value, profile.streak))}
                />
                <DevFieldRow
                    label="最終学習日"
                    code="lastStudyDate"
                    value={profile.lastStudyDate}
                    editable
                    type="text"
                    onChange={value => {
                        if (typeof value === "string") {
                            onUpdate("lastStudyDate", value);
                        }
                    }}
                />
                <DevFieldRow
                    label="本日回答数"
                    code="todayCount"
                    value={profile.todayCount}
                    editable
                    type="number"
                    onChange={value => onUpdate("todayCount", clampNonNegative(value, profile.todayCount))}
                />
            </div>

            <h3 className="font-bold text-slate-700">定期テスト状態</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <DevFieldRow
                    label="算数テスト保留"
                    code="periodicTestState.math.isPending"
                    value={mathTestState?.isPending}
                    editable
                    type="boolean"
                    onChange={value => onUpdatePeriodicTest('math', 'isPending', value === true)}
                />
                <DevFieldRow
                    label="算数最終トリガー"
                    code="periodicTestState.math.lastTriggeredAt"
                    value={mathTestState?.lastTriggeredAt ? new Date(mathTestState.lastTriggeredAt).toLocaleString() : null}
                />
                <DevFieldRow
                    label="算数トリガー理由"
                    code="periodicTestState.math.reason"
                    value={mathTestState?.reason}
                />
                <DevFieldRow
                    label="英語テスト保留"
                    code="periodicTestState.vocab.isPending"
                    value={vocabTestState?.isPending}
                    editable
                    type="boolean"
                    onChange={value => onUpdatePeriodicTest('vocab', 'isPending', value === true)}
                />
                <DevFieldRow
                    label="英語最終トリガー"
                    code="periodicTestState.vocab.lastTriggeredAt"
                    value={vocabTestState?.lastTriggeredAt ? new Date(vocabTestState.lastTriggeredAt).toLocaleString() : null}
                />
                <DevFieldRow
                    label="英語トリガー理由"
                    code="periodicTestState.vocab.reason"
                    value={vocabTestState?.reason}
                />
            </div>

            <h3 className="font-bold text-slate-700">紙テスト保留</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm space-y-3">
                {statusMessage && (
                    <div className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-1">
                        {statusMessage}
                    </div>
                )}
                {pendingPaperTests.length === 0 && (
                    <div className="text-sm text-slate-400">保留はありません</div>
                )}
                {pendingPaperTests.map((item, index) => (
                    <div key={item.id} className="border border-slate-100 rounded-lg p-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-mono">{item.id}</span>
                            <button
                                onClick={() => {
                                    updatePendingPaperTests(pendingPaperTests.filter((_, i) => i !== index));
                                    setStatus("紙テストを削除しました");
                                }}
                                className="text-xs text-red-500 hover:text-red-600"
                            >
                                削除
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-slate-700">科目</label>
                            <select
                                value={item.subject}
                                onChange={e => {
                                    const next = [...pendingPaperTests];
                                    next[index] = { ...item, subject: e.target.value as "math" | "vocab" };
                                    updatePendingPaperTests(next);
                                }}
                                className="text-sm border border-slate-200 rounded px-2 py-1"
                            >
                                <option value="math">math</option>
                                <option value="vocab">vocab</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-slate-700">レベル</label>
                            <input
                                type="number"
                                value={item.level}
                                onChange={e => {
                                    const next = [...pendingPaperTests];
                                    next[index] = { ...item, level: Math.max(0, Math.min(MAX_MATH_LEVEL, Number(e.target.value))) };
                                    updatePendingPaperTests(next);
                                }}
                                className="w-20 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-slate-700">作成日時</label>
                            <input
                                type="datetime-local"
                                value={toLocalInputValue(item.createdAt)}
                                onChange={e => {
                                    const iso = fromLocalInputValue(e.target.value);
                                    if (!iso) {
                                        setStatus("日時が不正です");
                                        return;
                                    }
                                    const next = [...pendingPaperTests];
                                    next[index] = { ...item, createdAt: iso };
                                    updatePendingPaperTests(next);
                                }}
                                className="text-sm border border-slate-200 rounded px-2 py-1"
                            />
                        </div>
                    </div>
                ))}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            const next = [
                                ...pendingPaperTests,
                                {
                                    id: crypto.randomUUID(),
                                    subject: "math" as const,
                                    level: Math.max(0, Math.min(MAX_MATH_LEVEL, profile.mathMainLevel ?? 1)),
                                    createdAt: new Date().toISOString(),
                                },
                            ];
                            updatePendingPaperTests(next);
                            setStatus("紙テストを追加しました");
                        }}
                        className="px-3 py-1 rounded text-xs font-medium bg-violet-600 text-white hover:bg-violet-700"
                    >
                        追加
                    </button>
                    <button
                        onClick={() => {
                            updatePendingPaperTests([]);
                            setStatus("紙テストをすべてクリアしました");
                        }}
                        className="px-3 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200"
                    >
                        すべてクリア
                    </button>
                </div>
            </div>
        </div>
    );
};
