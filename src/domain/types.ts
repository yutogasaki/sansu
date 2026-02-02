// ============================================================
// Core Type Definitions
// ============================================================

export type SubjectKey = 'math' | 'vocab';
export type SkillStatus = 'active' | 'maintenance' | 'retired';
export type InputType = 'number' | 'multi-number' | 'choice';

/**
 * Strength level for SRS algorithm (1-5)
 * 1: Just learned / Forgot (1 day interval)
 * 2: Learning (3 days interval)
 * 3: Reviewing (7 days interval)
 * 4: Familiar (14 days interval)
 * 5: Mastered (30 days interval)
 */
export type StrengthLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Helper to validate strength level
 */
export const isValidStrength = (n: number): n is StrengthLevel => {
    return n >= 1 && n <= 5 && Number.isInteger(n);
};

/**
 * Clamp a number to valid strength range
 */
export const clampStrength = (n: number): StrengthLevel => {
    const clamped = Math.max(1, Math.min(5, Math.round(n)));
    return clamped as StrengthLevel;
};

// ============================================================
// Level State
// ============================================================

export interface LevelState {
    level: number;
    unlocked: boolean;
    enabled: boolean;
    recentAnswersNonReview: boolean[];
    updatedAt?: string;
}

// ============================================================
// Review / Memory State
// ============================================================

/**
 * Base memory state for both Math and Vocab
 */
interface BaseMemoryState {
    id: string; // skillId or wordId
    strength: StrengthLevel;
    nextReview: string; // ISO Date "YYYY-MM-DD"

    // Stats
    totalAnswers: number;
    correctAnswers: number;
    incorrectAnswers: number;
    skippedAnswers: number;

    lastCorrectAt?: string; // ISO Timestamp
    updatedAt: string;
}

/**
 * Math-specific memory state with status tracking
 */
export interface MathMemoryState extends BaseMemoryState {
    status: SkillStatus;
}

/**
 * Vocab memory state (no status tracking)
 */
export interface VocabMemoryState extends BaseMemoryState {
    status?: never;
}

/**
 * Union type for backward compatibility
 */
export interface MemoryState {
    id: string;
    strength: StrengthLevel | number; // Allow number for migration
    nextReview: string;

    totalAnswers: number;
    correctAnswers: number;
    incorrectAnswers: number;
    skippedAnswers: number;

    lastCorrectAt?: string;
    updatedAt: string;

    // Math specific (optional for backward compat)
    status?: SkillStatus;
}

// ============================================================
// Problem Model (Ephemeral)
// ============================================================

/**
 * Configuration for multi-number input fields
 */
export interface MultiNumberField {
    label?: string;
    length: number;
}

/**
 * Configuration for choice inputs
 */
export interface ChoiceOption {
    label: string;
    value: string;
}

/**
 * Input configuration union type
 */
export interface InputConfig {
    // For multi-number/fraction pads
    fields?: MultiNumberField[];
    // For choice
    choices?: ChoiceOption[];
}

/**
 * Problem type for study sessions
 */
export interface Problem {
    id: string; // unique for this session instance
    subject: SubjectKey;
    categoryId: string; // skillId or wordId

    // Display content
    questionText?: string; // "1 + 1", "apple"
    questionImage?: string;

    // Input configuration
    inputType: InputType;
    inputConfig?: InputConfig;

    // Validation
    correctAnswer: string | string[]; // "2", ["1", "3"] (numerator, denominator)

    // Metadata
    isReview: boolean;
    isMaintenanceCheck?: boolean; // 仕様 5.4: 維持確認として出題されたか
}

// ============================================================
// Attempt / Result Types
// ============================================================

export type AttemptResult = 'correct' | 'incorrect' | 'skipped';

export interface RecentAttempt {
    id: string;
    timestamp: string;
    subject: SubjectKey;
    skillId: string;
    result: AttemptResult;
    timeMs?: number;
}

// ============================================================
// User Profile
// ============================================================

export type SubjectMode = 'mix' | 'math' | 'vocab';

/**
 * Grade levels
 * 0: Year 0 (Kindergarten)
 * 1-6: Elementary grades
 */
export type GradeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface SyncMeta {
    lastPushedAt?: string;
    lastPulledAt?: string;
    dirty: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
    grade: GradeLevel | number; // Allow number for flexibility

    // Settings
    mathStartLevel: number;
    vocabStartLevel: number;
    subjectMode: SubjectMode;
    soundEnabled: boolean;
    dailyGoal?: number;

    // Progress
    mathMainLevel: number;
    mathMaxUnlocked: number;

    vocabMainLevel: number;
    vocabMaxUnlocked: number;

    mathLevels?: LevelState[];
    vocabLevels?: LevelState[];

    // Memory Items
    mathSkills: Record<string, MemoryState>;
    vocabWords: Record<string, MemoryState>;

    // Streak / Daily
    streak: number;
    lastStudyDate?: string; // YYYY-MM-DD
    todayCount: number;

    // Recent Attempts (ring buffer)
    recentAttempts?: RecentAttempt[];

    schemaVersion?: number;
    syncMeta?: SyncMeta;
}

// ============================================================
// Utility Types
// ============================================================

/**
 * Type guard for checking if a memory state is for math
 */
export const isMathMemoryState = (state: MemoryState): state is MathMemoryState => {
    return state.status !== undefined;
};

/**
 * Create a new memory state with default values
 */
export const createDefaultMemoryState = (
    id: string,
    subject: SubjectKey,
    isCorrect: boolean
): MemoryState => {
    const now = new Date().toISOString();
    return {
        id,
        strength: isCorrect ? 2 : 1,
        nextReview: "",
        totalAnswers: 1,
        correctAnswers: isCorrect ? 1 : 0,
        incorrectAnswers: isCorrect ? 0 : 1,
        skippedAnswers: 0,
        lastCorrectAt: isCorrect ? now : undefined,
        updatedAt: now,
        status: subject === 'math' ? 'active' : undefined
    };
};

// ============================================================
// Date Helpers (Type-safe)
// ============================================================

/**
 * ISO Date string format for nextReview
 */
export type ISODateString = string; // YYYY-MM-DD

/**
 * ISO Timestamp string format
 */
export type ISOTimestamp = string; // Full ISO string

/**
 * Format a date to ISO date string
 */
export const toISODateString = (date: Date): ISODateString => {
    return date.toISOString().split('T')[0];
};
