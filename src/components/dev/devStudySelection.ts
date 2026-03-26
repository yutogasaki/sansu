import { getWord } from "../../domain/english/words";
import { getLevelForSkill } from "../../domain/math/curriculum";
import { MATH_SKILL_LABELS } from "../../domain/math/labels";

export type DevStudySubject = "math" | "vocab";

export interface DevStudySelectionSummary {
    subjectLabel: string;
    levelLabel: string;
    itemLabel: string;
}

const getMathSkillLabel = (skillId: string) => MATH_SKILL_LABELS[skillId] || skillId;

export const getDevStudySelectionSummary = (
    subject: DevStudySubject,
    selectedId?: string | null
): DevStudySelectionSummary | null => {
    if (!selectedId) {
        return null;
    }

    if (subject === "math") {
        const level = getLevelForSkill(selectedId);
        return {
            subjectLabel: "算数",
            levelLabel: level == null ? "Lv.?" : `Lv.${level}`,
            itemLabel: getMathSkillLabel(selectedId),
        };
    }

    const word = getWord(selectedId);
    if (!word) {
        return null;
    }

    return {
        subjectLabel: "英語",
        levelLabel: `Lv.${word.level}`,
        itemLabel: `${word.id} / ${word.japaneseKanji || word.japanese}`,
    };
};
