import { IkimonoStage } from './types';

export type ScriptMode = 'kana' | 'kanji';
export type TextPair = { kana: string; kanji: string };

export const MORNING_OPEN: TextPair[] = [
    { kana: 'おはよ', kanji: 'おはよ' },
    { kana: 'あさ だね', kanji: '朝だね' },
    { kana: 'まだ ねむい？', kanji: 'まだ眠い？' },
    { kana: 'ひかりが やわらかいね', kanji: '光がやわらかいね' },
    { kana: 'あさの くうき すき', kanji: '朝の空気すき' },
    { kana: 'きょうの はじまり', kanji: '今日の始まり' },
    { kana: 'おひさま みえる？', kanji: 'お日さま見える？' },
    { kana: 'ゆっくり いこう', kanji: 'ゆっくり行こう' },
    { kana: 'おきた ての におい', kanji: '起きたての匂い' },
    { kana: 'きょうは どんな いろ？', kanji: '今日はどんな色？' },
];

export const AFTERNOON_OPEN: TextPair[] = [
    { kana: 'こんにちは', kanji: 'こんにちは' },
    { kana: 'ひるの ひかりだね', kanji: '昼の光だね' },
    { kana: 'おなか すいた？', kanji: 'おなか空いた？' },
    { kana: 'きょう どう？', kanji: '今日どう？' },
    { kana: 'のんびり してるよ', kanji: 'のんびりしてるよ' },
    { kana: 'いい かぜ だね', kanji: 'いい風だね' },
    { kana: 'ちょっと ひとやすみ', kanji: 'ちょっとひと休み' },
    { kana: 'まぶしい じかん', kanji: 'まぶしい時間' },
    { kana: 'みず のみたい', kanji: '水のみたい' },
    { kana: 'こころ はれるね', kanji: '心はれるね' },
];

export const EVENING_OPEN: TextPair[] = [
    { kana: 'こんばんは', kanji: 'こんばんは' },
    { kana: 'もう よる だね', kanji: 'もう夜だね' },
    { kana: 'おつかれ', kanji: 'おつかれ' },
    { kana: 'しずかに なるね', kanji: '静かになるね' },
    { kana: 'ひかりが ちいさくなる', kanji: '光が小さくなる' },
    { kana: 'よるの くうき すき', kanji: '夜の空気すき' },
    { kana: 'きょうも ありがと', kanji: '今日もありがと' },
    { kana: 'おそくまで えらい', kanji: '遅くまでえらい' },
    { kana: 'おつきさま いるかな', kanji: 'お月さまいるかな' },
    { kana: 'ゆっくり ほどけよう', kanji: 'ゆっくりほどけよう' },
];

export const ANYTIME_OPEN: TextPair[] = [
    { kana: 'また きたね', kanji: 'また来たね' },
    { kana: 'ここに いるよ', kanji: 'ここにいるよ' },
    { kana: 'ぼーっと してた', kanji: 'ぼーっとしてた' },
    { kana: 'なにしよっか', kanji: '何しよっか' },
    { kana: 'すこし だけでも', kanji: '少しだけでも' },
    { kana: 'きょうは ここまででも', kanji: '今日はここまででも' },
    { kana: 'ここ すきなんだ', kanji: 'ここ好きなんだ' },
    { kana: 'あったかい きもち', kanji: 'あったかい気持ち' },
    { kana: 'のんびり しよ', kanji: 'のんびりしよ' },
    { kana: 'ふぅ', kanji: 'ふぅ' },
    { kana: 'すこし きいてて', kanji: '少し聞いてて' },
    { kana: 'まだ ここにいる', kanji: 'まだここにいる' },
];

export const OPEN_PREFIX: TextPair[] = [
    { kana: 'なんだか', kanji: 'なんだか' },
    { kana: 'きょうは', kanji: '今日は' },
    { kana: 'いま', kanji: '今' },
    { kana: 'ちょっと', kanji: 'ちょっと' },
    { kana: 'ふしぎと', kanji: '不思議と' },
    { kana: 'なぜか', kanji: 'なぜか' },
];

export const OPEN_SUFFIX: TextPair[] = [
    { kana: 'あいたかった', kanji: '会いたかった' },
    { kana: 'ほっと する', kanji: 'ほっとする' },
    { kana: 'ゆっくり できる', kanji: 'ゆっくりできる' },
    { kana: 'きもちが ほどける', kanji: '気持ちがほどける' },
    { kana: 'こころが まるくなる', kanji: '心が丸くなる' },
    { kana: 'においが やさしい', kanji: '匂いがやさしい' },
];

export const TAP_REACTION: TextPair[] = [
    { kana: 'ん？', kanji: 'ん？' },
    { kana: 'なに？', kanji: '何？' },
    { kana: 'うん', kanji: 'うん' },
    { kana: 'えへ', kanji: 'えへ' },
    { kana: '…？', kanji: '…？' },
    { kana: 'くすぐったい', kanji: 'くすぐったい' },
    { kana: 'よんだ？', kanji: '呼んだ？' },
    { kana: 'はーい', kanji: 'はーい' },
    { kana: 'むにゃ', kanji: 'むにゃ' },
    { kana: 'ぽ', kanji: 'ぽ' },
    { kana: 'いま みてた？', kanji: '今見てた？' },
    { kana: 'きこえてるよ', kanji: '聞こえてるよ' },
    { kana: 'てんしょん あがる', kanji: 'テンション上がる' },
    { kana: 'もう いっかい', kanji: 'もう一回' },
    { kana: 'ちょんって した？', kanji: 'ちょんってした？' },
    { kana: 'いまの すき', kanji: '今の好き' },
];

export const TAP_PREFIX: TextPair[] = [
    { kana: 'ちょっと', kanji: 'ちょっと' },
    { kana: 'そんなに', kanji: 'そんなに' },
    { kana: 'いまの', kanji: '今の' },
    { kana: 'なんか', kanji: 'なんか' },
    { kana: 'ふふ', kanji: 'ふふ' },
];

export const TAP_SUFFIX: TextPair[] = [
    { kana: 'うれしい', kanji: 'うれしい' },
    { kana: 'びっくり した', kanji: 'びっくりした' },
    { kana: 'たのしい', kanji: '楽しい' },
    { kana: 'わるくない', kanji: '悪くない' },
    { kana: 'くせに なる', kanji: 'くせになる' },
];

export const STAGE_HITOKOTO: Partial<Record<IkimonoStage, TextPair[]>> = {
    hatching: [
        { kana: '…みえる？', kanji: '…見える？' },
        { kana: 'ここ どこ？', kanji: 'ここどこ？' },
        { kana: 'もうすぐ でるよ', kanji: 'もうすぐ出るよ' },
        { kana: 'ひかりが ちかい', kanji: '光が近い' },
    ],
    small: [
        { kana: 'うまれたよ', kanji: '生まれたよ' },
        { kana: 'はじめまして', kanji: 'はじめまして' },
        { kana: 'これから よろしく', kanji: 'これからよろしく' },
        { kana: 'まだ ちいさいよ', kanji: 'まだ小さいよ' },
    ],
};

export const EGG_OPEN_HITOKOTO: TextPair[] = [
    { kana: 'なにか いる…？', kanji: '何かいる…？' },
    { kana: 'たまご がある', kanji: '卵がある' },
    { kana: 'あたたかい…', kanji: 'あたたかい…' },
    { kana: 'もうすぐ かな', kanji: 'もうすぐかな' },
    { kana: 'ちいさな こどう', kanji: '小さな鼓動' },
    { kana: 'そっと ねむってる', kanji: 'そっと眠ってる' },
    { kana: 'しずかな きはい', kanji: '静かな気配' },
    { kana: 'ひびきが ある', kanji: '響きがある' },
];

export const EGG_TAP_HITOKOTO: TextPair[] = [
    { kana: 'コンコン', kanji: 'コンコン' },
    { kana: '…もぞ', kanji: '…もぞ' },
    { kana: 'カサッ', kanji: 'カサッ' },
    { kana: '…', kanji: '…' },
    { kana: 'ぬくぬく', kanji: 'ぬくぬく' },
    { kana: 'こつん', kanji: 'こつん' },
    { kana: 'ふるっ', kanji: 'ふるっ' },
    { kana: 'ことり', kanji: 'ことり' },
];
