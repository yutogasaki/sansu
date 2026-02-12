import { MemoryState, UserProfile } from "../types";
import { ENGLISH_WORDS } from "./words";
import { db } from "../../db";

/**
 * DBから対象profileId + wordIdsのvocab MemoryStateをバッチ取得
 */
const getVocabMemoryFromDB = async (
    profileId: string,
    wordIds: Set<string>
): Promise<Map<string, MemoryState>> => {
    const result = new Map<string, MemoryState>();

    const items = await db.memoryVocab
        .filter((item: any) => item.profileId === profileId && wordIds.has(item.id))
        .toArray();

    for (const item of items) {
        result.set(item.id, item);
    }

    return result;
};

// 仕様 5.2: 英語レベル解放判定
// 最大解放レベル内の単語の 70% を「1回でも解いた（totalAnswers > 0）」ら昇格
// memoryOverride: テスト用。指定時はDBではなくこのMapを参照する
export const checkEnglishLevelProgression = async (
    profile: UserProfile,
    memoryOverride?: Record<string, MemoryState>
): Promise<boolean> => {
    const currentMax = profile.vocabMaxUnlocked;

    // 1. Get words for current max level
    const targetWords = ENGLISH_WORDS.filter(w => w.level === currentMax);
    if (targetWords.length === 0) return false;

    const wordIds = targetWords.map(w => w.id);

    // 2. Get memory states (DB or override)
    let getMemory: (id: string) => MemoryState | undefined;

    if (memoryOverride) {
        // テスト用: profile.vocabWords 互換
        getMemory = (id: string) => memoryOverride[id];
    } else {
        // 本番: DBから取得
        const memoryMap = await getVocabMemoryFromDB(profile.id, new Set(wordIds));
        getMemory = (id: string) => memoryMap.get(id);
    }

    // 3. Count unlocked words (totalAnswers > 0)
    let unlockedCount = 0;
    for (const id of wordIds) {
        const memory = getMemory(id);
        if (memory && memory.totalAnswers > 0) {
            unlockedCount++;
        }
    }

    // 4. Check Ratio (Threshold: 70%)
    const ratio = unlockedCount / targetWords.length;
    return ratio >= 0.7;
};

// Start Level Inferece (Simple)
// 簡易推定ロジック
export const estimateVocabStartLevel = (grade: number, experienceLevel: number): number => {
    // experienceLevel: 1=Low, 5=Mid, 10=High (from Onboarding)

    let base = 1;
    if (grade >= 5) base = 3;
    if (grade >= 6) base = 5;

    let additional = 0;
    if (experienceLevel >= 5) additional += 2;
    if (experienceLevel >= 10) additional += 3;

    return Math.min(20, base + additional);
};
