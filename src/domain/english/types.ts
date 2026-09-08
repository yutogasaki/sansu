export interface EnglishWord {
    id: string;       // Stable item ID: "apple" or "orange_lv2"
    surface?: string; // Display spelling when different from id
    level: number;    // 1-20
    japanese: string; // "りんご"
    japaneseKanji?: string;
    category: string; // "食べ物"
    pos?: string;     // "noun"
}

export type VocabProblem = {
    wordId: string;
    question: string;
    choices: { id: string; text: string }[]; // 4 choices
    answerId: string;
};
