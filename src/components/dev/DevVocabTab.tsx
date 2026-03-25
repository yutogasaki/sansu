import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clampStrength, MemoryState } from "../../domain/types";
import { getWordsByLevel } from "../../domain/english/words";
import { MAX_VOCAB_LEVEL } from "../../domain/math/curriculum";

interface DevVocabTabProps {
    memoryStates: MemoryState[];
    onUpdateMemory: (wordId: string, updates: Partial<MemoryState>) => void;
    onRefreshMemory: () => void;
}

// レベルごとの統計を計算
const getLevelStats = () => {
    const stats: { level: number; count: number }[] = [];
    for (let level = 1; level <= MAX_VOCAB_LEVEL; level++) {
        const words = getWordsByLevel(level);
        if (words.length > 0) {
            stats.push({ level, count: words.length });
        }
    }
    return stats;
};

export const DevVocabTab: React.FC<DevVocabTabProps> = ({ memoryStates, onUpdateMemory, onRefreshMemory }) => {
    const navigate = useNavigate();
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);

    const memoryMap = new Map(memoryStates.map(m => [m.id, m]));
    const levelStats = getLevelStats();

    const handleWordClick = (wordId: string) => {
        setSelectedWord(selectedWord === wordId ? null : wordId);
    };

    const handleStudy = (wordId: string) => {
        navigate(`/study?session=dev&focus_subject=vocab&focus_ids=${wordId}&back_to=${encodeURIComponent("/dev?tab=vocab")}`);
    };

    const wordsForLevel = selectedLevel ? getWordsByLevel(selectedLevel) : [];


    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">英語単語</h3>
                <button
                    onClick={onRefreshMemory}
                    className="text-xs text-violet-600 hover:underline"
                >
                    🔄 更新
                </button>
            </div>

            {/* レベル選択 */}
            {!selectedLevel && (
                <div className="grid grid-cols-4 gap-2">
                    {levelStats.map(({ level, count }) => {
                        const learnedCount = getWordsByLevel(level).filter(w => memoryMap.has(w.id)).length;
                        return (
                            <button
                                key={level}
                                onClick={() => setSelectedLevel(level)}
                                className="p-3 bg-white rounded-lg shadow-sm text-center hover:bg-slate-50"
                            >
                                <div className="font-bold text-slate-700">Lv.{level}</div>
                                <div className="text-xs text-slate-500">{learnedCount}/{count}</div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 単語一覧 */}
            {selectedLevel && (
                <>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => { setSelectedLevel(null); setSelectedWord(null); }}
                            className="text-sm text-violet-600 hover:underline"
                        >
                            ← レベル選択に戻る
                        </button>
                        <span className="text-sm text-slate-500">
                            レベル {selectedLevel} ({wordsForLevel.length}語)
                        </span>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {wordsForLevel.map(word => {
                            const memory = memoryMap.get(word.id);
                            const isLearned = !!memory;
                            const isSelected = selectedWord === word.id;

                            return (
                                <div key={word.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => handleWordClick(word.id)}
                                        className={`w-full text-left p-3 flex items-center justify-between ${isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                                            }`}
                                    >
                                        <span className="flex items-center">
                                            <span className={`w-2 h-2 rounded-full mr-2 ${isLearned ? "bg-green-500" : "bg-slate-300"
                                                }`} />
                                            <span className="font-medium">{word.id}</span>
                                            <span className="ml-2 text-slate-500">
                                                {word.japaneseKanji || word.japanese}
                                            </span>
                                        </span>
                                        <span className="text-xs text-slate-400">{word.category}</span>
                                    </button>

                                    {isSelected && (
                                        <div className="border-t border-slate-100 p-3 bg-slate-50 text-sm space-y-2">
                                            <div className="text-xs text-slate-500 space-y-1">
                                                <div>ID: <code>{word.id}</code></div>
                                                <div>日本語: {word.japanese}</div>
                                                {word.japaneseKanji && <div>漢字: {word.japaneseKanji}</div>}
                                                <div>カテゴリ: {word.category}</div>
                                            </div>

                                            {memory ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <div>
                                                            <span className="text-slate-500">強度:</span>
                                                            <select
                                                                value={memory.strength}
                                                                onChange={e => onUpdateMemory(word.id, { strength: clampStrength(Number(e.target.value)) })}
                                                                className="ml-2 border rounded px-1"
                                                            >
                                                                {[1, 2, 3, 4, 5].map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
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
                                                onClick={() => handleStudy(word.id)}
                                                className="w-full mt-2 px-3 py-2 bg-violet-600 text-white rounded text-sm font-medium"
                                            >
                                                この単語で学習
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
