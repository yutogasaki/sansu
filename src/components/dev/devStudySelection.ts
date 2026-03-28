import { getWord, getWordLevel, getWordsByLevel } from "../../domain/english/words";
import { MATH_CURRICULUM, MAX_VOCAB_LEVEL, getLevelForSkill } from "../../domain/math/curriculum";
import { MATH_SKILL_LABELS } from "../../domain/math/labels";

export type DevStudySubject = "math" | "vocab";

export interface DevStudyLevelItem {
    id: string;
    label: string;
    helper: string;
}

export interface DevStudySelectionSummary {
    subjectLabel: string;
    levelLabel: string;
    itemLabel: string;
    positionLabel: string;
}

export interface DevStudySelectionTarget {
    subject: DevStudySubject;
    id: string;
}

type DevStudyDirection = "prev-item" | "next-item";

const getMathSkillLabel = (skillId: string) => MATH_SKILL_LABELS[skillId] || skillId;

export const devStudyMathLevels = Object.keys(MATH_CURRICULUM)
    .map(Number)
    .sort((a, b) => a - b);

export const devStudyVocabLevels = Array.from({ length: MAX_VOCAB_LEVEL }, (_, index) => index + 1)
    .filter(level => getWordsByLevel(level).length > 0);

export const getDevStudyDefaultLevel = (
    subject: DevStudySubject,
    selectedId?: string | null
): number => {
    if (subject === "math") {
        return getLevelForSkill(selectedId || "") ?? devStudyMathLevels[0] ?? 0;
    }

    return getWordLevel(selectedId || "") ?? devStudyVocabLevels[0] ?? 1;
};

export const getDevStudyLevelItems = (
    subject: DevStudySubject,
    level: number
): DevStudyLevelItem[] => {
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

export const getDevStudyDefaultId = (
    subject: DevStudySubject,
    level: number,
    selectedId?: string | null
): string | null => {
    const items = getDevStudyLevelItems(subject, level);
    if (selectedId && items.some(item => item.id === selectedId)) {
        return selectedId;
    }
    return items[0]?.id ?? null;
};

export const getDevStudySelectionSummary = (
    subject: DevStudySubject,
    selectedId?: string | null
): DevStudySelectionSummary | null => {
    if (!selectedId) {
        return null;
    }

    if (subject === "math") {
        const level = getLevelForSkill(selectedId);
        const items = level == null ? [] : getDevStudyLevelItems(subject, level);
        const skillIndex = items.findIndex(item => item.id === selectedId);
        return {
            subjectLabel: "算数",
            levelLabel: level == null ? "Lv.?" : `Lv.${level}`,
            itemLabel: getMathSkillLabel(selectedId),
            positionLabel: skillIndex >= 0 ? `${skillIndex + 1}/${items.length}` : "?/?",
        };
    }

    const word = getWord(selectedId);
    if (!word) {
        return null;
    }

    const items = getDevStudyLevelItems(subject, word.level);
    const skillIndex = items.findIndex(item => item.id === selectedId);

    return {
        subjectLabel: "英語",
        levelLabel: `Lv.${word.level}`,
        itemLabel: `${word.id} / ${word.japaneseKanji || word.japanese}`,
        positionLabel: skillIndex >= 0 ? `${skillIndex + 1}/${items.length}` : "?/?",
    };
};

const getOrderedSelections = (subject: DevStudySubject) => {
    const levels = subject === "math" ? devStudyMathLevels : devStudyVocabLevels;

    return levels.flatMap(level =>
        getDevStudyLevelItems(subject, level).map(item => ({
            level,
            id: item.id,
        }))
    );
};

export const getDevStudyAdjacentSelection = (
    subject: DevStudySubject,
    selectedId: string,
    direction: DevStudyDirection
): DevStudySelectionTarget | null => {
    const orderedSelections = getOrderedSelections(subject);
    const currentIndex = orderedSelections.findIndex(item => item.id === selectedId);

    if (currentIndex < 0) {
        return null;
    }

    const offset = direction === "prev-item" ? -1 : 1;
    const nextSelection = orderedSelections[currentIndex + offset];
    return nextSelection
        ? { subject, id: nextSelection.id }
        : null;
};
