export type SubjectKey = 'math' | 'vocab';
export type SkillStatus = 'active' | 'maintenance' | 'retired';
export type InputType = 'number' | 'multi-number' | 'choice';

export interface LevelState {
    level: number;
    unlocked: boolean;
    enabled: boolean;
    recentAnswersNonReview: boolean[];
    updatedAt?: string;
}

// ------------------------------------------------------------------
// Review / Memory State
// ------------------------------------------------------------------
export interface MemoryState {
    id: string; // skillId or wordId
    strength: number; // 1-5
    nextReview: string; // ISO Date "YYYY-MM-DD"

    // Stats
    totalAnswers: number;
    correctAnswers: number;
    incorrectAnswers: number;
    skippedAnswers: number;

    lastCorrectAt?: string; // ISO Timestamp
    updatedAt: string;

    // Math specific
    status?: SkillStatus;
}

// ------------------------------------------------------------------
// Problem Model (Ephemeral)
// ------------------------------------------------------------------
export interface Problem {
    id: string; // unique for this session instance
    subject: SubjectKey;
    categoryId: string; // skillId or wordId

    // Display content
    questionText?: string; // "1 + 1", "apple"
    questionImage?: string;

    // Input configuration
    inputType: InputType;
    inputConfig?: {
        // For multi-number/fraction pads
        fields?: { label?: string; length: number }[];
        // For choice
        choices?: { label: string; value: string }[];
    };

    // Validation
    correctAnswer: string | string[]; // "2", ["1", "3"] (numerator, denominator)

    // Metadata
    isReview: boolean;
    isMaintenanceCheck?: boolean; // 仕様 5.4: 維持確認として出題されたか
}

// ------------------------------------------------------------------
// User Data
// ------------------------------------------------------------------
export interface UserProfile {
    id: string;
    name: string;
    grade: number; // 0=Year0, 1=Grade1...

    // Settings
    mathStartLevel: number;
    vocabStartLevel: number;
    subjectMode: "mix" | "math" | "vocab";
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
    recentAttempts?: {
        id: string;
        timestamp: string;
        subject: SubjectKey;
        skillId: string;
        result: "correct" | "incorrect" | "skipped";
        timeMs?: number;
    }[];

    schemaVersion?: number;
    syncMeta?: {
        lastPushedAt?: string;
        lastPulledAt?: string;
        dirty: boolean;
    };
}
