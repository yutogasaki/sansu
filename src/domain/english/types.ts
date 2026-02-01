export interface EnglishWord {
    id: string;       // "apple"
    level: number;    // 1-20
    japanese: string; // "りんご"
    category: string; // "食べ物"
    pos?: string;     // "noun"
}

export type VocabProblem = {
    wordId: string;
    question: string;
    choices: { id: string; text: string }[]; // 4 choices
    answerId: string;
};
