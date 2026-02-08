import { IkimonoStage } from './types';

// ────────────────────────────────────────────
// 起動時ひとこと（3〜4回に1回表示）
// 時間帯によって変わる。評価・数値・強制は一切なし。
// ────────────────────────────────────────────

const HITOKOTO_MORNING = [
    'おはよ',
    'あさ だね',
    'まだ ねむい？',
    'きょうも いちにち',
    'おひさま でてるかな',
];

const HITOKOTO_AFTERNOON = [
    'こんにちは',
    'いい てんき かな',
    'おなか すいた？',
    'ひるだね',
    'なにしてた？',
];

const HITOKOTO_EVENING = [
    'こんばんは',
    'もう よる だね',
    'おつかれ',
    'おそいね',
    'しずか だね',
];

const HITOKOTO_ANYTIME = [
    'なんとなく きた？',
    'また きたね',
    'ここに いるよ',
    'ぼーっと してた',
    'おなじ そら みてるね',
    'すこし だけでも',
    'きょうは ここまででも',
    'なにしよっか',
    'きょうも いちにち',
    '…',
    'ふぅ',
];

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    return 'evening';
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 起動時のひとことを取得する
 * 50%で時間帯ひとこと、50%で汎用ひとこと
 */
export function getOpenHitokoto(): string {
    if (Math.random() < 0.5) {
        const time = getTimeOfDay();
        switch (time) {
            case 'morning': return pickRandom(HITOKOTO_MORNING);
            case 'afternoon': return pickRandom(HITOKOTO_AFTERNOON);
            case 'evening': return pickRandom(HITOKOTO_EVENING);
        }
    }
    return pickRandom(HITOKOTO_ANYTIME);
}

/**
 * アプリ起動時にひとことを表示するかどうか（約3〜4回に1回）
 */
export function shouldShowHitokotoOnOpen(): boolean {
    return Math.random() < 0.3;
}

// ────────────────────────────────────────────
// タップ時ひとこと
// 起動時とは異なる、タッチへの小さな応答。
// ────────────────────────────────────────────

const TAP_HITOKOTO = [
    'ん？',
    'なに？',
    'うん',
    'えへ',
    '…？',
    'くすぐったい',
    'よんだ？',
    'はーい',
    'むにゃ',
    'ぽ',
];

/**
 * タップ時のひとこと
 */
export function getTapHitokoto(): string {
    return pickRandom(TAP_HITOKOTO);
}

// ────────────────────────────────────────────
// ステージ別ひとこと（初回遷移時に1回だけ使う想定）
// ────────────────────────────────────────────

const STAGE_HITOKOTO: Partial<Record<IkimonoStage, string[]>> = {
    hatching: [
        '…みえる？',
        'ここ どこ？',
    ],
    small: [
        'うまれたよ',
        'はじめまして',
    ],
};

/**
 * ステージ遷移時のひとこと（ない場合は null）
 */
export function getStageHitokoto(stage: IkimonoStage): string | null {
    const list = STAGE_HITOKOTO[stage];
    if (!list) return null;
    return pickRandom(list);
}
