import React from "react";
import { storage } from "../../utils/storage";

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
    // Get localStorage values
    const debugMode = storage.debug.isEnabled();
    const soundEnabled = storage.sound.isEnabled();

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
                <ConstantRow label="デバッグモード" code="sansu_debug_mode" value={debugMode ? 'true' : 'false'} />
                <ConstantRow label="効果音" code="sansu_sound_enabled" value={soundEnabled ? 'true' : 'false'} />
            </div>
        </div>
    );
};
