export type KokugoTrack = 'K' | 'H' | 'V' | 'S' | 'R' | 'E';
export type KokugoMode = 'decoding' | 'reading' | 'listening' | 'expression-structured' | 'expression-open';
export type KokugoForm = 'choice' | 'order' | 'span' | 'short' | 'activity';
export interface KokugoUnit { id: string; track: KokugoTrack; title: string; band: number; introduction: string }
export interface KokugoItem {
    id: string; unitId: string; version: 'kokugo-starter-1' | 'kokugo-starter-2' | 'kokugo-kanji-1' | 'kokugo-kanji-2' | 'kokugo-kanji-3'; target: string;
    family: string; exposureGroup: string; condition: string; mode: KokugoMode; form: KokugoForm;
    kanji?: string; teachingTarget?: string; acceptedAnswers?: string[];
    prompt: string; passage?: string; choices: string[]; answer: string;
    hint: string; model: string; audio?: string; audioSha256?: string;
}
export interface KokugoCourse { profileId: string; preferred: boolean; unitId: string; band: number; focusTarget?: string }
export interface KokugoPresentation { at: number; contactRevision: number; delayedEligible: boolean; reviewEligible?: boolean; novel: boolean }
export interface KokugoSlot {
    item: KokugoItem; support: 'none' | 'hint' | 'model'; draft: string; heard: boolean;
    presentation?: KokugoPresentation;
    firstAnswer?: { answer: string; correct: boolean | null; at: number };
    retrieved?: 'new-context' | 'familiar'; completedAt?: number; completionKind?: 'independent' | 'assisted'; skipped?: boolean;
}
export interface KokugoPlan {
    id: string; profileId: string; unitId: string; version: 'kokugo-v1';
    focusTarget?: string; status: 'pending' | 'completed'; createdAt: number; revision: number; cursor: number;
    introDone: boolean; repeatedPractice: boolean; slots: KokugoSlot[];
}
export interface KokugoProgress {
    profileId: string; id: string; unitId: string; target: string; form: KokugoForm; mode: KokugoMode;
    contactRevision: number; lastContactAt?: number; introduced: boolean;
    seenExposures: string[]; independentItems: string[]; independentFamilies: string[]; independentConditions: string[];
    independentAfter?: number; evidencePolicy?: 'editorial-2'; familiarReviewCount?: number;
    delayedCount: number; strength: number; nextReview?: number;
}
export interface KokugoEvent {
    id: string; profileId: string; planId: string; revision: number; at: number;
    action: KokugoAction['action'] | 'present' | 'introduction'; answer?: string;
    itemId?: string; correct?: boolean; independent?: boolean; delayed?: boolean; retrieved?: 'new-context' | 'familiar'; unscorable?: boolean;
}
export interface KokugoCompletion {
    sourceVersion: 'kokugo-v1'; profileId: string; completionId: string; planId: string;
    slotIndex: number; completionKind: 'independent' | 'assisted'; completedAt: number;
}
export interface KokugoOutbox extends KokugoCompletion { acknowledgedAt?: number }
export interface KokugoWork { id: string; profileId: string; unitId: string; text: string; updatedAt: number; saved: boolean; revisions?: { text: string; at: number }[] }
export interface KokugoAction {
    profileId: string; planId: string; revision: number;
    action: 'answer' | 'hint' | 'model' | 'complete-supported' | 'skip' | 'next' | 'heard' | 'draft' | 'intro'; answer?: string;
}
