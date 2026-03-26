import React, { useEffect, useMemo, useState } from "react";
import { MATH_CURRICULUM, getLevelForSkill } from "../../domain/math/curriculum";
import { MATH_SKILL_LABELS } from "../../domain/math/labels";
import { MAX_VOCAB_LEVEL } from "../../domain/math/curriculum";
import { getWordLevel, getWordsByLevel } from "../../domain/english/words";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { DevStudySubject, getDevStudySelectionSummary } from "./devStudySelection";

interface DevStudySwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    subject: DevStudySubject;
    selectedId?: string | null;
    onApply: (next: { subject: DevStudySubject; id: string }) => void;
}

const mathLevels = Object.keys(MATH_CURRICULUM)
    .map(Number)
    .sort((a, b) => a - b);

const vocabLevels = Array.from({ length: MAX_VOCAB_LEVEL }, (_, index) => index + 1)
    .filter(level => getWordsByLevel(level).length > 0);

const getMathSkillLabel = (skillId: string) => MATH_SKILL_LABELS[skillId] || skillId;

const getDefaultLevel = (subject: DevStudySubject, selectedId?: string | null): number => {
    if (subject === "math") {
        return getLevelForSkill(selectedId || "") ?? mathLevels[0] ?? 0;
    }

    return getWordLevel(selectedId || "") ?? vocabLevels[0] ?? 1;
};

const getLevelItems = (subject: DevStudySubject, level: number) => {
    if (subject === "math") {
        return (MATH_CURRICULUM[level] || []).map(skillId => ({
            id: skillId,
            label: getMathSkillLabel(skillId),
            helper: skillId,
        }));
    }

    return getWordsByLevel(level).map(word => ({
        id: word.id,
        label: word.id,
        helper: word.japaneseKanji || word.japanese,
    }));
};

const getDefaultId = (subject: DevStudySubject, level: number, selectedId?: string | null) => {
    const items = getLevelItems(subject, level);
    if (selectedId && items.some(item => item.id === selectedId)) {
        return selectedId;
    }
    return items[0]?.id ?? null;
};

export const DevStudySwitcher: React.FC<DevStudySwitcherProps> = ({
    isOpen,
    onClose,
    subject,
    selectedId,
    onApply,
}) => {
    const [draftSubject, setDraftSubject] = useState<DevStudySubject>(subject);
    const [draftLevel, setDraftLevel] = useState<number>(getDefaultLevel(subject, selectedId));
    const [draftId, setDraftId] = useState<string | null>(getDefaultId(subject, getDefaultLevel(subject, selectedId), selectedId));

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const nextLevel = getDefaultLevel(subject, selectedId);
        setDraftSubject(subject);
        setDraftLevel(nextLevel);
        setDraftId(getDefaultId(subject, nextLevel, selectedId));
    }, [isOpen, subject, selectedId]);

    const activeLevels = draftSubject === "math" ? mathLevels : vocabLevels;
    const levelItems = useMemo(
        () => getLevelItems(draftSubject, draftLevel),
        [draftSubject, draftLevel]
    );

    useEffect(() => {
        if (!activeLevels.includes(draftLevel)) {
            setDraftLevel(activeLevels[0] ?? 1);
            return;
        }

        if (!draftId || !levelItems.some(item => item.id === draftId)) {
            setDraftId(levelItems[0]?.id ?? null);
        }
    }, [activeLevels, draftId, draftLevel, levelItems]);

    const handleSubjectChange = (nextSubject: DevStudySubject) => {
        const nextLevel = getDefaultLevel(nextSubject);
        setDraftSubject(nextSubject);
        setDraftLevel(nextLevel);
        setDraftId(getDefaultId(nextSubject, nextLevel));
    };

    const handleApply = () => {
        if (!draftId) {
            return;
        }

        onApply({ subject: draftSubject, id: draftId });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="開発者モードの切替"
            width="md"
            footer={(
                <div className="flex gap-3">
                    <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
                        閉じる
                    </Button>
                    <Button size="lg" className="flex-1" onClick={handleApply} disabled={!draftId}>
                        この設定で続ける
                    </Button>
                </div>
            )}
        >
            <div className="space-y-5">
                <div className="space-y-2">
                    <div className="text-xs font-black tracking-[0.16em] text-slate-400">きょうか</div>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { id: "math" as const, label: "算数" },
                            { id: "vocab" as const, label: "英語" },
                        ]).map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSubjectChange(item.id)}
                                className={`rounded-[18px] border px-4 py-3 text-sm font-black transition-colors ${draftSubject === item.id
                                    ? "border-cyan-100/90 bg-cyan-50/90 text-cyan-700"
                                    : "border-white/80 bg-white/70 text-slate-500 hover:bg-white/82"
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <label className="block space-y-2">
                    <span className="text-xs font-black tracking-[0.16em] text-slate-400">レベル</span>
                    <select
                        value={draftLevel}
                        onChange={(event) => setDraftLevel(Number(event.target.value))}
                        className="w-full rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_26px_-24px_rgba(15,23,42,0.55)] outline-none"
                    >
                        {activeLevels.map(level => (
                            <option key={level} value={level}>
                                {`Lv.${level}`}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block space-y-2">
                    <span className="text-xs font-black tracking-[0.16em] text-slate-400">
                        {draftSubject === "math" ? "スキル" : "単語"}
                    </span>
                    <select
                        value={draftId || ""}
                        onChange={(event) => setDraftId(event.target.value || null)}
                        className="w-full rounded-[18px] border border-white/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_26px_-24px_rgba(15,23,42,0.55)] outline-none"
                    >
                        {levelItems.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.helper ? `${item.label} / ${item.helper}` : item.label}
                            </option>
                        ))}
                    </select>
                </label>

                {draftId && (
                    <div className="rounded-[22px] border border-white/80 bg-white/62 px-4 py-4">
                        <div className="text-[11px] font-black tracking-[0.16em] text-slate-400">現在の候補</div>
                        <div className="mt-2 text-base font-black text-slate-800">
                            {getDevStudySelectionSummary(draftSubject, draftId)?.itemLabel}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            {getDevStudySelectionSummary(draftSubject, draftId)?.subjectLabel} {getDevStudySelectionSummary(draftSubject, draftId)?.levelLabel}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
