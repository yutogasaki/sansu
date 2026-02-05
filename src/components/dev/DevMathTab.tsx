import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MemoryState } from "../../domain/types";
import { MATH_CURRICULUM } from "../../domain/math/curriculum";

// スキル名の日本語ラベル
const SKILL_LABELS: Record<string, string> = {
    count_10: "10まで数える",
    count_50: "50まで数える",
    count_100: "100まで数える",
    count_fill: "□を埋める",
    compare_1d: "1桁の比較",
    compare_2d: "2桁の比較",
    add_1d_1: "1桁+1桁(簡単)",
    add_1d_2: "1桁+1桁",
    add_2d1d_nc: "2桁+1桁(繰り上がりなし)",
    add_2d1d_c: "2桁+1桁(繰り上がり)",
    add_2d2d_nc: "2桁+2桁(繰り上がりなし)",
    add_2d2d_c: "2桁+2桁(繰り上がり)",
    add_3d3d: "3桁+3桁",
    add_4d: "4桁の足し算",
    sub_1d1d_nc: "1桁-1桁(繰り下がりなし)",
    sub_1d1d_c: "1桁-1桁(繰り下がり)",
    sub_2d1d_nc: "2桁-1桁(繰り下がりなし)",
    sub_2d1d_c: "2桁-1桁(繰り下がり)",
    sub_2d2d: "2桁-2桁",
    sub_3d3d: "3桁-3桁",
    sub_4d: "4桁の引き算",
    mul_99_1: "九九(1の段)",
    mul_99_2: "九九(2の段)",
    mul_99_3: "九九(3の段)",
    mul_99_4: "九九(4の段)",
    mul_99_5: "九九(5の段)",
    mul_99_6: "九九(6の段)",
    mul_99_7: "九九(7の段)",
    mul_99_8: "九九(8の段)",
    mul_99_9: "九九(9の段)",
    mul_99_rand: "九九(ランダム)",
    mul_2d1d: "2桁×1桁",
    mul_3d1d: "3桁×1桁",
    mul_2d2d: "2桁×2桁",
    mul_3d2d: "3桁×2桁",
    div_99_rev: "九九の逆(割り算)",
    div_2d1d_exact: "2桁÷1桁(割り切れる)",
    div_rem_q1: "余りあり(商1桁)",
    div_rem_q2: "余りあり(商2桁)",
    div_2d2d_exact: "2桁÷2桁",
    div_3d1d_exact: "3桁÷1桁",
    div_3d2d_exact: "3桁÷2桁",
    dec_add: "小数の足し算",
    dec_sub: "小数の引き算",
    dec_mul_int: "小数×整数",
    dec_div_int: "小数÷整数",
    dec_mul_dec: "小数×小数",
    dec_div_dec: "小数÷小数",
    frac_add_same: "同分母の足し算",
    frac_sub_same: "同分母の引き算",
    frac_add_diff: "異分母の足し算",
    frac_sub_diff: "異分母の引き算",
    frac_mixed: "帯分数(足)",
    frac_mixed_sub: "帯分数(引)",
    frac_mul_int: "分数×整数",
    frac_mul_frac: "分数×分数",
    frac_div_int: "分数÷整数",
    frac_div_frac: "分数÷分数",
    scale_10x: "10倍・100倍",
};

interface DevMathTabProps {
    memoryStates: MemoryState[];
    onUpdateMemory: (skillId: string, updates: Partial<MemoryState>) => void;
    onRefreshMemory: () => void;
}

export const DevMathTab: React.FC<DevMathTabProps> = ({ memoryStates, onUpdateMemory, onRefreshMemory }) => {
    const navigate = useNavigate();
    const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

    const memoryMap = new Map(memoryStates.map(m => [m.id, m]));

    const handleSkillClick = (skillId: string) => {
        setSelectedSkill(selectedSkill === skillId ? null : skillId);
    };

    const handleStudy = (skillId: string) => {
        navigate(`/study?dev_skill=${skillId}`);
    };

    const selectedMemory = selectedSkill ? memoryMap.get(selectedSkill) : null;

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">算数カリキュラム</h3>
                <button
                    onClick={onRefreshMemory}
                    className="text-xs text-violet-600 hover:underline"
                >
                    🔄 更新
                </button>
            </div>

            {/* レベル一覧 */}
            <div className="space-y-2">
                {Object.entries(MATH_CURRICULUM).map(([level, skills]) => {
                    const levelNum = Number(level);
                    const learnedCount = skills.filter(s => memoryMap.has(s)).length;

                    return (
                        <div key={level} className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <button
                                onClick={() => setExpandedLevel(expandedLevel === levelNum ? null : levelNum)}
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-50"
                            >
                                <span className="font-medium text-slate-700">
                                    レベル {level}
                                </span>
                                <span className="text-sm text-slate-500">
                                    {learnedCount}/{skills.length} 学習済
                                    <span className="ml-2">{expandedLevel === levelNum ? "▲" : "▼"}</span>
                                </span>
                            </button>

                            {expandedLevel === levelNum && (
                                <div className="border-t border-slate-100 p-3 space-y-2">
                                    {skills.map(skillId => {
                                        const memory = memoryMap.get(skillId);
                                        const isLearned = !!memory;
                                        const isSelected = selectedSkill === skillId;

                                        return (
                                            <div key={skillId}>
                                                <button
                                                    onClick={() => handleSkillClick(skillId)}
                                                    className={`w-full text-left p-2 rounded text-sm flex items-center justify-between ${isSelected ? "bg-violet-100" : "hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <span className="flex items-center">
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${isLearned ? "bg-green-500" : "bg-slate-300"
                                                            }`} />
                                                        {SKILL_LABELS[skillId] || skillId}
                                                    </span>
                                                    <code className="text-xs text-slate-400">{skillId}</code>
                                                </button>

                                                {isSelected && (
                                                    <div className="ml-4 mt-2 p-3 bg-slate-50 rounded text-sm space-y-2">
                                                        {memory ? (
                                                            <>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <span className="text-slate-500">強度:</span>
                                                                        <select
                                                                            value={memory.strength}
                                                                            onChange={e => onUpdateMemory(skillId, { strength: Number(e.target.value) as any })}
                                                                            className="ml-2 border rounded px-1"
                                                                        >
                                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                                <option key={s} value={s}>{s}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500">状態:</span>
                                                                        <select
                                                                            value={memory.status || 'active'}
                                                                            onChange={e => onUpdateMemory(skillId, { status: e.target.value as any })}
                                                                            className="ml-2 border rounded px-1"
                                                                        >
                                                                            <option value="active">active</option>
                                                                            <option value="maintenance">maintenance</option>
                                                                            <option value="retired">retired</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-slate-500 space-y-1">
                                                                    <div>次回復習: {memory.nextReview?.split('T')[0] || '未設定'}</div>
                                                                    <div>総回答: {memory.totalAnswers} (正解: {memory.correctAnswers})</div>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="text-slate-500">未学習</div>
                                                        )}
                                                        <button
                                                            onClick={() => handleStudy(skillId)}
                                                            className="w-full mt-2 px-3 py-2 bg-violet-600 text-white rounded text-sm font-medium"
                                                        >
                                                            このスキルで学習
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
