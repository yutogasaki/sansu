import { EventType } from '../../domain/sessionManager';
import { ikimonoStorage } from '../../utils/storage';
import { calculateStage } from './lifecycle';
import { IkimonoStage } from './types';

type StageToneEntry = {
    easy: string[];
    standard: string[];
};

const STAGE_TONE: Record<Exclude<IkimonoStage, 'gone'>, { now: StageToneEntry; mood: StageToneEntry; aura: string[] }> = {
    egg: {
        now: {
            easy: [
                'からのなかで、ちいさく あたためてる。',
                'しずかに、まだ かたちを えらんでる。',
                'ねむってるようで、ちゃんと きいてる。',
            ],
            standard: [
                '殻のなかで、小さく温まっている。',
                '静かに、まだ形を選んでいる。',
                '眠っているようで、ちゃんと聞いている。',
            ],
        },
        mood: {
            easy: [
                'おだやか。ふわっと きぶん。',
                'すこし くすぐったそう。',
                'やわらかい ひかりに なじんでる。',
            ],
            standard: [
                'おだやかで、ふわっとした気分。',
                '少しくすぐったそう。',
                'やわらかい光になじんでいる。',
            ],
        },
        aura: ['しずけさ', 'ぬくもり', 'ちいさな予感'],
    },
    hatching: {
        now: {
            easy: [
                'からが かすかに ひびいてる。',
                'なかから、ちいさな こどうが する。',
                'もう すこしで、こえが きこえそう。',
            ],
            standard: [
                '殻がかすかに響いている。',
                'なかから、小さな鼓動がする。',
                'もう少しで、声が聞こえそう。',
            ],
        },
        mood: {
            easy: [
                'そわそわ しながら たのしそう。',
                'わくわくが ふくらんでる。',
                'いまにも ぴょこっと しそう。',
            ],
            standard: [
                'そわそわしながら楽しそう。',
                'わくわくがふくらんでいる。',
                'いまにも、ぴょこっとしそう。',
            ],
        },
        aura: ['ざわめき', 'はじまり', 'ゆれる気配'],
    },
    small: {
        now: {
            easy: [
                'ちいさく うごいて、まわりを みてる。',
                'はじめての ものに きょうみ しんしん。',
                'まだ こどもっぽく、ぴょんと はずむ。',
            ],
            standard: [
                '小さく動いて、まわりを見ている。',
                'はじめてのものに興味しんしん。',
                'まだ子どもっぽく、ぴょんとはずむ。',
            ],
        },
        mood: {
            easy: [
                'ごきげんで、ちょっと いたずら。',
                'きらきら した まなざし。',
                'ちいさく いきおいが ある。',
            ],
            standard: [
                'ごきげんで、ちょっといたずら。',
                'きらきらしたまなざし。',
                '小さく勢いがある。',
            ],
        },
        aura: ['好奇心', '軽さ', 'あたらしさ'],
    },
    medium: {
        now: {
            easy: [
                'じぶんの リズムで、ゆったり あるいてる。',
                'おちついて、すこし たのもしそう。',
                'まわりを みながら、じぶんの ばしょを つくってる。',
            ],
            standard: [
                '自分のリズムで、ゆったり歩いている。',
                '落ち着いて、少したのもしそう。',
                'まわりを見ながら、自分の場所を作っている。',
            ],
        },
        mood: {
            easy: [
                'おだやか だけど しっかり。',
                'すこし 大人びた きぶん。',
                'ひかえめに うれしそう。',
            ],
            standard: [
                'おだやかだけど、しっかり。',
                '少し大人びた気分。',
                'ひかえめにうれしそう。',
            ],
        },
        aura: ['安定', '呼吸', 'まるみ'],
    },
    adult: {
        now: {
            easy: [
                'ゆっくり たたずんで、ぜんぶを みわたしてる。',
                'しずかに つよく、そこに いる。',
                'ことばは すくなく、ふんいきで つたえる。',
            ],
            standard: [
                'ゆっくりたたずんで、ぜんぶを見わたしている。',
                '静かに強く、そこにいる。',
                '言葉は少なく、雰囲気で伝える。',
            ],
        },
        mood: {
            easy: [
                'おちついた ぬくもり。',
                'やさしい いばしょ みたい。',
                'すこし ものおもい。',
            ],
            standard: [
                '落ち着いたぬくもり。',
                'やさしい居場所みたい。',
                '少しもの思い。',
            ],
        },
        aura: ['深さ', '余白', '包みこみ'],
    },
    fading: {
        now: {
            easy: [
                'すこしずつ うすれて、かぜに まざっていく。',
                'しずかに ひかりを のこしてる。',
                'さよならに ちかい、でも やわらかい。',
            ],
            standard: [
                '少しずつ薄れて、風にまざっていく。',
                '静かに光をのこしている。',
                'さよならに近い、でもやわらかい。',
            ],
        },
        mood: {
            easy: [
                'なつかしい きぶん。',
                'やさしく てを ふってる みたい。',
                'しんとして きれい。',
            ],
            standard: [
                'なつかしい気分。',
                'やさしく手をふっているみたい。',
                'しんとして、きれい。',
            ],
        },
        aura: ['余韻', 'ささやき', '次のいのち'],
    },
};

const STAGE_NEXT_LABEL: Record<Exclude<IkimonoStage, 'gone'>, string> = {
    egg: 'からが うごきだす',
    hatching: 'ちいさな すがたが みえそう',
    small: 'すこし おとなっぽく なる',
    medium: 'どっしり してくる',
    adult: 'ひかりが やわらかく かわる',
    fading: 'つぎの いのちへ つながる',
};

const STAGE_END_DAY: Record<Exclude<IkimonoStage, 'gone'>, number> = {
    egg: 3,
    hatching: 7,
    small: 14,
    medium: 22,
    adult: 28,
    fading: 30,
};

const SCENE_ADLIB = {
    kana: [
        'いまは かぜが やさしい。',
        'ひかりが まるく なってる。',
        'きょうの くうきに なじんでる。',
        'おとが すこし ちかい。',
        'いつもより しずか。',
        'ふわっと した きぶん。',
        'すこし きもちが ほどける。',
        'ゆっくり まばたき してる。',
        'なんだか ここちいい。',
        'そっと いきしてる。',
    ],
    kanji: [
        '今は風がやさしい。',
        '光が丸くなってる。',
        '今日の空気になじんでる。',
        '音が少し近い。',
        'いつもより静か。',
        'ふわっとした気分。',
        '少し気持ちがほどける。',
        'ゆっくりまばたきしてる。',
        'なんだか心地いい。',
        'そっと息してる。',
    ],
};

const MOOD_ADLIB = {
    kana: [
        'でも、ちゃんと まえを みてる。',
        'すこし だけ えがお みたい。',
        'きぶんの ねいろが やわらかい。',
        'むりは してない かんじ。',
        'すこし てれてる かも。',
        'こころの すみが あたたかい。',
        'ちいさな じしんが ある。',
        'なんとなく たのもしげ。',
    ],
    kanji: [
        'でも、ちゃんと前を見てる。',
        '少しだけ笑顔みたい。',
        '気分の音色がやわらかい。',
        '無理はしてない感じ。',
        '少し照れてるかも。',
        '心のすみがあたたかい。',
        '小さな自信がある。',
        'なんとなく頼もしげ。',
    ],
};

const hashSeed = (text: string): number => {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) % 1000003;
    }
    return h;
};

const pickBySeed = (items: string[], seed: number, shift = 0): string => {
    return items[(seed + shift) % items.length];
};

const getStageSnapshot = (profileId: string | null): { stage: Exclude<IkimonoStage, 'gone'>; birthDate: string | null } => {
    if (!profileId) return { stage: 'egg', birthDate: null };
    const stored = ikimonoStorage.getState();
    if (!stored || stored.profileId !== profileId) return { stage: 'egg', birthDate: null };
    const info = calculateStage(stored.birthDate);
    if (info.stage === 'gone') return { stage: 'egg', birthDate: null };
    return { stage: info.stage, birthDate: stored.birthDate };
};

const getTransitionNuance = (stage: Exclude<IkimonoStage, 'gone'>, birthDate: string | null): string => {
    if (!birthDate) return `もうすこしで、${STAGE_NEXT_LABEL[stage]}。`;
    const elapsedDays = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24);
    const remain = STAGE_END_DAY[stage] - elapsedDays;
    const prefix = remain < 0.6 ? 'いまにも、' : remain < 1.6 ? 'そろそろ、' : 'ゆっくり、';
    return `${prefix}${STAGE_NEXT_LABEL[stage]}。`;
};

export const stageText: Record<Exclude<IkimonoStage, 'gone'>, { kana: string; kanji: string }> = {
    egg: { kana: 'たまご', kanji: '卵' },
    hatching: { kana: 'ふか', kanji: 'ふ化' },
    small: { kana: 'こども', kanji: 'こども' },
    medium: { kana: 'せいちょう', kanji: '成長' },
    adult: { kana: 'おとな', kanji: '大人' },
    fading: { kana: 'よいん', kanji: '余韻' },
};

export interface IkimonoSceneText {
    stage: Exclude<IkimonoStage, 'gone'>;
    nowLine: string;
    transition: string;
    moodLine: string;
    aura: string[];
    whisper: string;
}

export function getSceneText(
    profileId: string | null,
    dayKey: string,
    weakCount: number,
    currentEventType: EventType | null,
    useKanjiText: boolean
): IkimonoSceneText {
    const snapshot = getStageSnapshot(profileId);
    const tone = STAGE_TONE[snapshot.stage];
    const seed = hashSeed(`${profileId || 'guest'}-${dayKey}-${snapshot.stage}`);
    const nowLineBase = pickBySeed(useKanjiText ? tone.now.standard : tone.now.easy, seed);
    const moodLineBase = pickBySeed(useKanjiText ? tone.mood.standard : tone.mood.easy, seed, 1);
    const nowTail = pickBySeed(useKanjiText ? SCENE_ADLIB.kanji : SCENE_ADLIB.kana, seed, 2);
    const moodTail = pickBySeed(useKanjiText ? MOOD_ADLIB.kanji : MOOD_ADLIB.kana, seed, 3);
    const nowLine = seed % 2 === 0 ? `${nowLineBase} ${nowTail}` : nowLineBase;
    const aura = [tone.aura[seed % tone.aura.length], tone.aura[(seed + 1) % tone.aura.length], tone.aura[(seed + 2) % tone.aura.length]];
    const transition = getTransitionNuance(snapshot.stage, snapshot.birthDate);

    let moodLine = seed % 3 === 0 ? `${moodLineBase} ${moodTail}` : moodLineBase;
    if (weakCount >= 6) moodLine = useKanjiText ? `${moodLineBase} ちょっと迷いもある。` : `${moodLineBase} ちょっと まよいも ある。`;
    if (weakCount === 0) moodLine = useKanjiText ? `${moodLineBase} いまは、すごく軽い。` : `${moodLineBase} いまは すごく かるい。`;
    if (currentEventType === 'periodic_test') moodLine = useKanjiText ? `${moodLineBase} 今日は少し、きりっと。` : `${moodLineBase} きょうは すこし きりっと。`;
    if (currentEventType === 'level_up') moodLine = useKanjiText ? `${moodLineBase} なんだか誇らしげ。` : `${moodLineBase} なんだか ほこらしげ。`;

    return {
        stage: snapshot.stage,
        nowLine,
        transition,
        moodLine,
        aura,
        whisper: currentEventType
            ? (useKanjiText ? '何か伝えたいことがあるみたい。' : 'なにか つたえたい ことが あるみたい。')
            : weakCount > 0
                ? (useKanjiText ? '少し気になることがあるみたい。' : 'すこし きになる ことが あるみたい。')
                : (useKanjiText ? '今日はただ、そばにいたいみたい。' : 'きょうは ただ、そばに いたいみたい。'),
    };
}
