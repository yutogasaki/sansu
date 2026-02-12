import React, { useMemo, useState } from "react";
import { EventType } from "../../domain/sessionManager";
import { storage } from "../../utils/storage";
import { toLocaleDateKey } from "../../utils/learningDay";

// SRS Constants
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30];

// Trigger Constants (from domain/test/trigger.ts)
const TRIGGER_CONSTANTS = {
    COOL_DOWN_DAYS: 7,
    MATH_PRE_LEVELUP_RATE: 0.90,
    MATH_SLOW_DAYS: 14,
    MATH_SLOW_COUNT: 200,
    MATH_STRUGGLE_RECENT_COUNT: 120,
    MATH_STRUGGLE_ACCURACY: 0.70,
    VOCAB_PRE_LEVELUP_RATE: 0.85,
    VOCAB_SLOW_DAYS: 14,
    VOCAB_SLOW_COUNT: 150,
    VOCAB_STRUGGLE_RECENT_COUNT: 100,
    VOCAB_STRUGGLE_ACCURACY: 0.65,
};

// Session Constants (from hooks/blockGenerators.ts)
const SESSION_CONSTANTS = {
    BLOCK_SIZE: 10,
    COOLDOWN_WINDOW: 5,
    SAME_ID_LIMIT: 2,
    REVIEW_RATIO_MAX: 0.3,
    REVIEW_BLOCK_CHECK_WINDOW: 30,
    REVIEW_BLOCK_THRESHOLD: 0.15,
    WEAK_INJECTION_CAP: 0.3,
    MAINTENANCE_RATE: 0.01,
};

// Learning Day
const LEARNING_DAY_START_HOUR = 4;

interface ConstantRowProps {
    label: string;
    code: string;
    value: string | number;
}

const ConstantRow: React.FC<ConstantRowProps> = ({ label, code, value }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
        <div>
            <span className="text-sm text-slate-700">{label}</span>
            <code className="ml-2 text-xs text-slate-400 bg-slate-100 px-1 rounded">{code}</code>
        </div>
        <span className="text-sm font-mono text-slate-600">{String(value)}</span>
    </div>
);

export const DevConstantsTab: React.FC = () => {
    const eventTypes = useMemo<EventType[]>(
        () => [
            "streak_3",
            "streak_7",
            "total_100",
            "level_up_near",
            "weak_decrease",
            "periodic_test",
            "level_up",
            "paper_test_remind",
        ],
        []
    );

    const loadLocalValues = () => ({
        debugMode: storage.debug.isEnabled(),
        soundEnabled: storage.sound.isEnabled(),
        eventLastShown: storage.event.getLastShownEvent() ?? "",
        eventLastShownDate: storage.event.getLastShownDate() ?? "",
        eventPending: storage.event.isPending(),
        weakPrevCount: storage.weakPoints.getPrevCount(),
    });

    const [debugMode, setDebugMode] = useState(loadLocalValues().debugMode);
    const [soundEnabled, setSoundEnabled] = useState(loadLocalValues().soundEnabled);
    const [eventLastShown, setEventLastShown] = useState(loadLocalValues().eventLastShown);
    const [eventLastShownDate, setEventLastShownDate] = useState(loadLocalValues().eventLastShownDate);
    const [eventPending, setEventPending] = useState(loadLocalValues().eventPending);
    const [weakPrevCount, setWeakPrevCount] = useState<number | undefined>(loadLocalValues().weakPrevCount);

    const reloadLocalValues = () => {
        const values = loadLocalValues();
        setDebugMode(values.debugMode);
        setSoundEnabled(values.soundEnabled);
        setEventLastShown(values.eventLastShown);
        setEventLastShownDate(values.eventLastShownDate);
        setEventPending(values.eventPending);
        setWeakPrevCount(values.weakPrevCount);
    };

    const [statusMessage, setStatusMessage] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);

    const setStatus = (text: string, tone: "ok" | "warn" | "error" = "ok") => {
        setStatusMessage({ text, tone });
        window.setTimeout(() => setStatusMessage(null), 2000);
    };

    const normalizeDateString = (value: string): string | null => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return toLocaleDateKey(parsed);
    };

    const applyEventState = () => {
        const normalizedDate = normalizeDateString(eventLastShownDate);
        if (normalizedDate === null) {
            setStatus("lastShownDate が不正です", "error");
            return;
        }
        if (eventLastShown.trim() && !normalizedDate) {
            setStatus("lastShownEvent の保存には日付が必要です", "warn");
            return;
        }
        if (eventLastShown.trim() && normalizedDate) {
            storage.event.setShown(eventLastShown.trim(), normalizedDate);
        }
        if (!eventLastShown.trim() && normalizedDate) {
            storage.event.setShown("", normalizedDate);
        }
        storage.event.setPending(eventPending);
        reloadLocalValues();
        setEventLastShownDate(normalizedDate || "");
        setStatus("イベント値を保存しました");
    };

    const clearEventState = () => {
        storage.remove(storage.keys.EVENT_LAST_SHOWN);
        storage.remove(storage.keys.EVENT_SHOWN_DATE);
        storage.event.clearPending();
        reloadLocalValues();
        setStatus("イベント値をクリアしました");
    };

    const applyWeakPoints = () => {
        if (weakPrevCount === undefined || Number.isNaN(weakPrevCount)) {
            setStatus("prevWeakCount が不正です", "error");
            return;
        }
        storage.weakPoints.setPrevCount(Math.max(0, Math.min(9999, Math.floor(weakPrevCount))));
        reloadLocalValues();
        setStatus("weakPoints を保存しました");
    };

    return (
        <div className="p-4 space-y-4">
            <h3 className="font-bold text-slate-700">SRSアルゴリズム</h3>
            <p className="text-xs text-slate-500">
                <code>domain/algorithms/srs.ts</code>
            </p>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <ConstantRow
                    label="復習間隔(日)"
                    code="INTERVALS"
                    value={`[${SRS_INTERVALS.join(', ')}]`}
                />
                <div className="text-xs text-slate-500 mt-2">
                    strength 1→1日, 2→3日, 3→7日, 4→14日, 5→30日
                </div>
            </div>

            <h3 className="font-bold text-slate-700">定期テストトリガー</h3>
            <p className="text-xs text-slate-500">
                <code>domain/test/trigger.ts</code>
            </p>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <ConstantRow label="クールダウン" code="COOL_DOWN_DAYS" value={TRIGGER_CONSTANTS.COOL_DOWN_DAYS} />
                <div className="mt-2 text-xs font-medium text-slate-600">算数</div>
                <ConstantRow label="レベルアップ前発動率" code="MATH_PRE_LEVELUP_RATE" value={TRIGGER_CONSTANTS.MATH_PRE_LEVELUP_RATE} />
                <ConstantRow label="滞在日数閾値" code="MATH_SLOW_DAYS" value={TRIGGER_CONSTANTS.MATH_SLOW_DAYS} />
                <ConstantRow label="累計問題数閾値" code="MATH_SLOW_COUNT" value={TRIGGER_CONSTANTS.MATH_SLOW_COUNT} />
                <ConstantRow label="苦戦判定問題数" code="MATH_STRUGGLE_RECENT_COUNT" value={TRIGGER_CONSTANTS.MATH_STRUGGLE_RECENT_COUNT} />
                <ConstantRow label="苦戦判定正答率" code="MATH_STRUGGLE_ACCURACY" value={TRIGGER_CONSTANTS.MATH_STRUGGLE_ACCURACY} />
                <div className="mt-2 text-xs font-medium text-slate-600">英語</div>
                <ConstantRow label="レベルアップ前発動率" code="VOCAB_PRE_LEVELUP_RATE" value={TRIGGER_CONSTANTS.VOCAB_PRE_LEVELUP_RATE} />
                <ConstantRow label="滞在日数閾値" code="VOCAB_SLOW_DAYS" value={TRIGGER_CONSTANTS.VOCAB_SLOW_DAYS} />
                <ConstantRow label="累計問題数閾値" code="VOCAB_SLOW_COUNT" value={TRIGGER_CONSTANTS.VOCAB_SLOW_COUNT} />
                <ConstantRow label="苦戦判定問題数" code="VOCAB_STRUGGLE_RECENT_COUNT" value={TRIGGER_CONSTANTS.VOCAB_STRUGGLE_RECENT_COUNT} />
                <ConstantRow label="苦戦判定正答率" code="VOCAB_STRUGGLE_ACCURACY" value={TRIGGER_CONSTANTS.VOCAB_STRUGGLE_ACCURACY} />
            </div>

            <h3 className="font-bold text-slate-700">セッション定数</h3>
            <p className="text-xs text-slate-500">
                <code>hooks/blockGenerators.ts</code>
            </p>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <ConstantRow label="ブロックサイズ" code="BLOCK_SIZE" value={SESSION_CONSTANTS.BLOCK_SIZE} />
                <ConstantRow label="クールダウン窓" code="COOLDOWN_WINDOW" value={SESSION_CONSTANTS.COOLDOWN_WINDOW} />
                <ConstantRow label="同一ID上限" code="SAME_ID_LIMIT" value={SESSION_CONSTANTS.SAME_ID_LIMIT} />
                <ConstantRow label="復習比率上限" code="REVIEW_RATIO_MAX" value={SESSION_CONSTANTS.REVIEW_RATIO_MAX} />
                <ConstantRow label="復習チェック窓" code="REVIEW_BLOCK_CHECK_WINDOW" value={SESSION_CONSTANTS.REVIEW_BLOCK_CHECK_WINDOW} />
                <ConstantRow label="復習強制閾値" code="REVIEW_BLOCK_THRESHOLD" value={SESSION_CONSTANTS.REVIEW_BLOCK_THRESHOLD} />
                <ConstantRow label="苦手注入上限" code="WEAK_INJECTION_CAP" value={SESSION_CONSTANTS.WEAK_INJECTION_CAP} />
                <ConstantRow label="維持確認確率" code="MAINTENANCE_RATE" value={SESSION_CONSTANTS.MAINTENANCE_RATE} />
            </div>

            <h3 className="font-bold text-slate-700">学習日境界</h3>
            <p className="text-xs text-slate-500">
                <code>utils/learningDay.ts</code>
            </p>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <ConstantRow label="1日の開始時刻" code="LEARNING_DAY_START_HOUR" value={`${LEARNING_DAY_START_HOUR}時`} />
            </div>

            <h3 className="font-bold text-slate-700">localStorage</h3>
            <p className="text-xs text-slate-500">
                <code>utils/storage.ts</code>
            </p>
            <div className="bg-white rounded-lg p-3 shadow-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <div>
                        <span className="text-sm text-slate-700">デバッグモード</span>
                        <code className="ml-2 text-xs text-slate-400 bg-slate-100 px-1 rounded">sansu_debug_mode</code>
                    </div>
                    <button
                        onClick={() => {
                            const next = !debugMode;
                            storage.debug.setEnabled(next);
                            setDebugMode(next);
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium ${debugMode ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}
                    >
                        {debugMode ? "ON" : "OFF"}
                    </button>
                </div>
                <ConstantRow label="効果音" code="sansu_sound_enabled" value={soundEnabled ? 'true' : 'false'} />

                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    <div className="text-xs font-medium text-slate-600">イベント表示</div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-700">lastShownEvent</label>
                        <select
                            value={eventLastShown}
                            onChange={e => setEventLastShown(e.target.value)}
                            className="text-sm border border-slate-200 rounded px-2 py-1"
                        >
                            <option value="">(未設定)</option>
                            {eventTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-700">lastShownDate</label>
                        <input
                            type="text"
                            value={eventLastShownDate}
                            onChange={e => setEventLastShownDate(e.target.value)}
                            onBlur={e => {
                                const normalized = normalizeDateString(e.target.value);
                                if (normalized === null) {
                                    setStatus("日付フォーマットが不正です", "warn");
                                } else {
                                    setEventLastShownDate(normalized);
                                }
                            }}
                            placeholder="YYYY-MM-DD"
                            className="w-32 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-700">pending</label>
                        <button
                            onClick={() => setEventPending(prev => !prev)}
                            className={`px-3 py-1 rounded text-xs font-medium ${eventPending ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                }`}
                        >
                            {eventPending ? "ON" : "OFF"}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={applyEventState}
                            className="px-3 py-1 rounded text-xs font-medium bg-violet-600 text-white hover:bg-violet-700"
                        >
                            保存
                        </button>
                        <button
                            onClick={clearEventState}
                            className="px-3 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                            クリア
                        </button>
                    </div>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    <div className="text-xs font-medium text-slate-600">苦手ポイント</div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-700">prevWeakCount</label>
                        <input
                            type="number"
                            value={weakPrevCount ?? ""}
                            onChange={e => setWeakPrevCount(e.target.value === "" ? undefined : Number(e.target.value))}
                            className="w-24 text-sm border border-slate-200 rounded px-2 py-1 text-right"
                        />
                    </div>
                    <button
                        onClick={applyWeakPoints}
                        className="px-3 py-1 rounded text-xs font-medium bg-violet-600 text-white hover:bg-violet-700"
                    >
                        保存
                    </button>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                    <button
                        onClick={reloadLocalValues}
                        className="px-3 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200"
                    >
                        再読み込み
                    </button>
                </div>
                {statusMessage && (
                    <div
                        className={`mt-3 text-xs rounded px-2 py-1 ${statusMessage.tone === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : statusMessage.tone === "warn"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                            }`}
                    >
                        {statusMessage.text}
                    </div>
                )}
            </div>
        </div>
    );
};
