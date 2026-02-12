import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MemoryState } from "../../domain/types";
import { MATH_CURRICULUM } from "../../domain/math/curriculum";
import { MATH_SKILL_LABELS } from "../../domain/math/labels";


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

                                        const isSelected = selectedSkill === skillId;

                                        return (
                                            <div key={skillId}>
                                                <button
                                                    onClick={() => handleSkillClick(skillId)}
                                                    className={`w-full text-left p-2 rounded text-sm flex items-center justify-between ${isSelected ? "bg-violet-100" : "hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <span className="flex items-center">
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${memory ? "bg-green-500" : "bg-slate-300"
                                                            }`} />
                                                        {MATH_SKILL_LABELS[skillId] || skillId}
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
