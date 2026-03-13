import { STAGE_BOUNDARIES } from "./lifecycle";
import { IkimonoStage } from "./types";

export type FuwafuwaAlbumStage = Exclude<IkimonoStage, "gone">;

export interface FuwafuwaAlbumMemory {
    phase: FuwafuwaAlbumStage;
    phaseLabel: string;
    auraLabel: string;
    cardTone: string;
    headline: string;
    reflection: string;
    closing: string;
    imageSuffix: 1 | 2 | 3;
}

type AlbumMemoryCopy = {
    phaseLabel: string;
    auraWords: string[];
    cardLines: string[];
    headlines: string[];
    reflections: string[];
    closings: string[];
};

const ALBUM_MEMORY_COPY: Record<FuwafuwaAlbumStage, AlbumMemoryCopy> = {
    egg: {
        phaseLabel: "はじまりの ころ",
        auraWords: ["ちいさな よかん", "ぬくもりの たね", "しずかな きざし"],
        cardLines: [
            "そっと みまもりたく なる はじまり。",
            "まだ ことばより ぬくもりが ちかい ころ。",
            "これからが たのしみな ひかりを もってた。",
        ],
        headlines: [
            "このころの ふわふわは、からの なかで そっと ゆれてた。",
            "このころは、しずかに じぶんの かたちを えらんでた。",
            "このころの ふわふわは、まだ ねむそうで ちゃんと きいてた。",
        ],
        reflections: [
            "おへやの くうきまで やわらかく なる ちいさな じかん。",
            "みているだけで、これからの きたいが ふくらんでいく。",
            "まだ ちいさいのに、ちゃんと ここに いる かんじがした。",
        ],
        closings: [
            "はじまりの ぬくもりが、いまも そっと のこってる。",
            "おもいだすと、こころが すこし まるく なる。",
            "さいしょの ひかりが、まだ かすかに のこってる。",
        ],
    },
    hatching: {
        phaseLabel: "めざめの ころ",
        auraWords: ["ちいさな こどう", "わくわくの しるし", "ゆれる けはい"],
        cardLines: [
            "いまにも ぴょこっと しそうな じかん。",
            "そわそわ ときめく ひかりが あった。",
            "めざめる まえの きらめきが のこってる。",
        ],
        headlines: [
            "このころの ふわふわは、からの むこうで こえを ためてた。",
            "このころは、もうすぐ はじまる よろこびで いっぱいだった。",
            "このころの ふわふわは、ちいさく はずみながら まってた。",
        ],
        reflections: [
            "もうすぐ あえる きたいで、おへやが すこし あかるく なった。",
            "かすかな こどうだけで、うれしさが ひろがっていく かんじ。",
            "そっと みているだけで、こっちまで そわそわ してくる。",
        ],
        closings: [
            "めざめる まえの きらめきが、まだ やさしく のこってる。",
            "おもいだすと、ちいさな ときめきが もどってくる。",
            "あの そわそわした くうきも、だいじな おもいで。",
        ],
    },
    small: {
        phaseLabel: "ぴょこぴょこ のころ",
        auraWords: ["きらきらの あしあと", "あたらしい いきおい", "ごきげんな ひかり"],
        cardLines: [
            "ぴょこぴょこ うごく たのしさで いっぱい。",
            "まわりを みるたび きらっと してた。",
            "ちいさいのに げんきが あふれてた。",
        ],
        headlines: [
            "このころの ふわふわは、なんでも きになって しかたなかった。",
            "このころは、ちいさな はずみで おへやを まるくしてた。",
            "このころの ふわふわは、うれしいものを すぐ みつけてた。",
        ],
        reflections: [
            "みていると、こっちまで すこし ごきげんに なる ふしぎな じかん。",
            "あたらしい ものを みつけるたび、くうきまで きらっと してた。",
            "いたずらっぽい げんきさが、おへやに たのしさを ふやしてた。",
        ],
        closings: [
            "いまも ちいさな あしおとが、どこかに のこってる きがする。",
            "おもいだすと、くすっと したく なる げんきさが あった。",
            "あの きらきらした いきおいが、まだ そっと のこってる。",
        ],
    },
    medium: {
        phaseLabel: "のびざかり",
        auraWords: ["まるい こきゅう", "おだやかな いきおい", "のびる きぶん"],
        cardLines: [
            "じぶんの リズムが でてきた ころ。",
            "すこし たのもしく なってきた じかん。",
            "まるく おちついた ひかりが あった。",
        ],
        headlines: [
            "このころの ふわふわは、じぶんの ばしょを やさしく つくってた。",
            "このころは、おちつきと げんきが ちょうど よく まざってた。",
            "このころの ふわふわは、ゆっくり でも しっかり そだってた。",
        ],
        reflections: [
            "そばに いるだけで、くうきが すこし ととのう かんじがした。",
            "あわてず にげず、じぶんの ペースを ちゃんと もってた。",
            "みまもっていると、すこし ほっと できる ぬくもりが あった。",
        ],
        closings: [
            "のびざかりの まるい こきゅうが、いまも おへやに のこってる。",
            "おもいだすと、すこし せなかを のばしたく なる。",
            "あの おだやかな いきおいが、まだ そっと つづいてる。",
        ],
    },
    adult: {
        phaseLabel: "おとなの ひかり",
        auraWords: ["やさしい ぬくもり", "しずかな つよさ", "ふかい まなざし"],
        cardLines: [
            "やさしい ぬくもりが ひろがる ころ。",
            "しずかに そこにいて、ちゃんと たのもしい。",
            "ことばが なくても つたわる ひかりが あった。",
        ],
        headlines: [
            "このころの ふわふわは、ゆっくり まわりを みわたしてた。",
            "このころは、そばに いるだけで いばしょに なってた。",
            "このころの ふわふわは、しずかに つよく おへやを ささえてた。",
        ],
        reflections: [
            "にぎやかじゃなくても、ちゃんと あたたかい くうきが のこる。",
            "あせらない ぬくもりで、こっちまで ほっと できる かんじ。",
            "まるく ひらいた まなざしが、そっと みまもってくれてた。",
        ],
        closings: [
            "おとなの ぬくもりが、いまも しずかに のこってる。",
            "おもいだすと、こころの すみが すこし あたたまる。",
            "あの しずかな つよさが、まだ そっと そばに いる。",
        ],
    },
    fading: {
        phaseLabel: "たびだちの よいん",
        auraWords: ["しずかな ひかり", "やわらかな よいん", "さよならの ぬくもり"],
        cardLines: [
            "しずかな ひかりを のこした ころ。",
            "やさしく てを ふる ような よいんが あった。",
            "おへやに ぬくもりを のこして たびだった。",
        ],
        headlines: [
            "このころの ふわふわは、かぜに まざるみたいに やわらかかった。",
            "このころは、さよならの まえでも ちゃんと やさしかった。",
            "このころの ふわふわは、しずかな ひかりを そっと のこしていった。",
        ],
        reflections: [
            "きえていく さみしさより、いっしょに いた ぬくもりが つよく のこる。",
            "おへやの くうきに、まだ すこし やさしい よいんが ただよってる。",
            "てを ふるみたいな しずけさが、きれいに こころへ のこってる。",
        ],
        closings: [
            "たびだちの ひかりが、いまも そっと おへやに のこってる。",
            "おもいだすたび、さみしさより ぬくもりが さきに くる。",
            "また あたらしい ふわふわへ つながる よいんが ある。",
        ],
    },
};

const hashSeed = (text: string): number => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) % 1000003;
    }
    return hash;
};

const pickBySeed = (items: string[], seed: number, shift = 0): string => {
    return items[(seed + shift) % items.length];
};

export const getAlbumMemoryStage = (daysTogether: number): FuwafuwaAlbumStage => {
    const safeDays = Math.max(1, Math.floor(daysTogether));

    for (const { stage, endDay } of STAGE_BOUNDARIES) {
        if (stage === "gone") continue;
        if (stage === "fading") return "fading";
        if (safeDays < endDay) return stage;
    }

    return "fading";
};

export const getAlbumImageSuffix = (stage: FuwafuwaAlbumStage): 1 | 2 | 3 => {
    switch (stage) {
        case "egg":
        case "hatching":
            return 1;
        case "small":
        case "medium":
            return 2;
        case "adult":
        case "fading":
            return 3;
    }
};

export const getFuwafuwaAlbumMemory = (daysTogether: number, seedText: string): FuwafuwaAlbumMemory => {
    const phase = getAlbumMemoryStage(daysTogether);
    const phaseCopy = ALBUM_MEMORY_COPY[phase];
    const seed = hashSeed(seedText);

    return {
        phase,
        phaseLabel: phaseCopy.phaseLabel,
        auraLabel: `${pickBySeed(phaseCopy.auraWords, seed)} の きおく`,
        cardTone: pickBySeed(phaseCopy.cardLines, seed, 1),
        headline: pickBySeed(phaseCopy.headlines, seed, 2),
        reflection: pickBySeed(phaseCopy.reflections, seed, 3),
        closing: pickBySeed(phaseCopy.closings, seed, 4),
        imageSuffix: getAlbumImageSuffix(phase),
    };
};
