import { comfort, docked, foodSupport, housing, likesOf, waitingSeeds } from '../../../domain/growingIsland';
import type { Character, GrowingState, KeepsakeKind, Like, LandmarkKind, SeedKind, Species, TownEvent, Villager } from '../../../domain/growingIsland';

export const SPECIES_NAME: Record<Species, string> = {
    rabbit: 'うさぎ', otter: 'カワウソ', fox: 'キツネ', duck: 'カモ', squirrel: 'リス', hedgehog: 'ハリネズミ', bird: 'ことり',
    girl: 'えま', boy: 'えいた',
};
export const CHARACTER_NAME: Record<Character, string> = {
    water: 'みずべの しま', tree: 'もりの しま', flower: 'はなの しま', farm: 'はたけの しま', light: 'ほしあかりの しま', mixed: 'いろいろの しま',
};
export const SEED_LABEL: Record<SeedKind, { name: string; icon: string; note: string }> = {
    home: { name: 'すむ', icon: '🏠', note: 'おうちが たつよ' },
    farm: { name: 'たべる', icon: '🥕', note: 'はたけが できるよ' },
    play: { name: 'あそぶ', icon: '🎈', note: 'あそびばが できるよ' },
    wild: { name: 'しぜん', icon: '🌼', note: '花や 草が ひろがるよ' },
    market: { name: 'いちば', icon: '🧺', note: 'ごはんが いっぱい' },
    festival: { name: 'おまつり ひろば', icon: '🎪', note: 'みんなで あそべるよ' },
};
export const LANDMARK_LABEL: Partial<Record<LandmarkKind, { name: string; icon: string }>> = {
    flower: { name: 'おはな', icon: '🌸' }, bench: { name: 'ベンチ', icon: '🪑' }, 'water-bowl': { name: '水ばち', icon: '💧' },
    sapling: { name: '木の なえ', icon: '🌱' }, 'water-channel': { name: 'みずみち', icon: '〰️' }, 'picnic-table': { name: 'テーブル', icon: '🍽️' },
    planter: { name: 'うえ木ばち', icon: '🪴' }, swing: { name: 'ブランコ', icon: '🎠' }, lantern: { name: 'あかり', icon: '🏮' },
    fence: { name: 'さく', icon: '🪵' }, lighthouse: { name: 'とうだい', icon: '🗼' }, bandstand: { name: 'おんがくの ひろば', icon: '🎵' },
    pinwheel: { name: 'かざぐるま', icon: '🌀' }, 'flower-arch': { name: '花の アーチ', icon: '🌺' }, sandbox: { name: 'すなば', icon: '⛱️' },
    'garden-hut': { name: 'えんげい 小屋', icon: '🛖' }, library: { name: 'としょしつ', icon: '📚' },
};
export const KEEPSAKE_NAME: Record<KeepsakeKind, string> = {
    blocks: 'かずの つみき', balance: 'くらべっこの てんびん', fountain: 'けいさんの ふんすい', clock: 'くくの とけいとう',
    windmill: 'かけわりの ふうしゃ', star: 'しょうすうの ほし', flowerbed: 'ぶんすうの はなだん', tower: 'ちえの とう',
    book: 'ことばの ほん', globe: 'えいごの ちきゅうぎ',
};
const MOMENT_LINE = {
    rainbow: 'にじが でたよ！', butterflies: 'ちょうちょが あつまってきたよ', friends: 'なかよしの ふたりが いっしょに いるよ',
    'guest-water': 'みなもの たびどりが あそびに きたよ。こんやだけ だって', 'guest-grove': 'こもれびの おきゃくさんが きたよ。こんやだけ だって',
} as const;

export const HOME_STAGE = ['たね', 'テント', 'こや', 'いえ', 'ふたかいだて'] as const;

export const villagerName = (v: Pick<Villager, 'name' | 'species'>) => v.name ?? SPECIES_NAME[v.species];
/** What kind of friend someone is; えま and えいた are simply a girl and a boy. */
export const kindName = (species: Species) => species === 'girl' ? 'おんなのこ' : species === 'boy' ? 'おとこのこ' : SPECIES_NAME[species];
const KID_LINES = { girl: ['いっしょに あそぼう！', 'みずあそび したいな', 'この しま だいすき！'], boy: ['きのぼり しようよ！', 'おなか すいたね', 'この しま たのしいね！'] } as const;

/** Pokomoko's single line after opening town time. One reason, never blame (§11.3). */
export function revealLine(state: GrowingState, events: TownEvent[]) {
    const arrived = events.filter(e => e.type === 'arrived').length;
    if (state.arrivals.length) return arrived > 1 ? 'なかまが きたよ！ ふねを さわってね' : `${arrivalName(state)}が きたよ！ ふねを さわってね`;
    if (state.unopened.length) return 'つぼみが できたよ。さわって ひらいてみよう';
    if (events.some(e => e.type === 'keepsake')) return 'まなびの きねんひんが とどいたよ！「たね」の しまってある から おいてみよう';
    const gift = events.find(e => e.type === 'gift');
    if (gift?.type === 'gift') return `${gift.from}が おはなを くれたよ`;
    const level = events.find(e => e.type === 'level');
    if (level) return 'しまが げんきに なったよ！ おまつりだ';
    const character = events.find(e => e.type === 'character');
    if (character && character.type === 'character') return `しまが、${CHARACTER_NAME[character.character]}に なったよ`;
    if (events.some(e => e.type === 'unlocked')) return 'あたらしい ものが とどいたよ。「たね」を みてね';
    const blocked = events.find(e => e.type === 'blocked');
    if (blocked?.type === 'blocked') {
        if (blocked.reason === 'unreachable') return 'ここまで いけないみたい。まわりを あけてみよう';
        if (blocked.reason === 'full') return 'おうちが いっぱいで、とまれなかったみたい。つぎは きっと';
        return 'ごはんが とどいてないみたい。はたけを つくってみよう';
    }
    const moment = events.find(e => e.type === 'moment');
    if (moment?.type === 'moment') return MOMENT_LINE[moment.moment];
    if (events.some(e => e.type === 'boat')) return 'ふねが ちかづいてきたよ';
    return 'のんびりした じかんだったね';
}

function arrivalName(state: GrowingState) {
    const v = state.villagers.find(v => v.id === state.arrivals[0]);
    // A new animal's name is not known yet, so say what kind of friend they are first.
    if (!v) return 'なかま';
    return v.species === 'girl' || v.species === 'boy' || !v.name ? villagerName(v) : `${SPECIES_NAME[v.species]}の ${v.name}`;
}

/** What Pokomoko says while the child plays; it suggests, never asks for more learning. */
export function idleLine(state: GrowingState) {
    const visitor = SPECIES_NAME[state.pier.visitor.species];
    if (state.tutorial === 'first-home') return `${visitor}が ここに すみたいって。「たね」から おうちを たててみよう`;
    if (state.unopened.length) return 'つぼみを さわって ひらいてみよう';
    if (state.arrivals.length) return 'ふねを さわると なかまが おりてくるよ';
    const seeds = waitingSeeds(state);
    if (docked(state) && housing(state).vacancy + state.plots.filter(p => p.kind === 'home' && p.stage === 0).length < 1)
        return `ふねの ${visitor}が すみたいって。おうちの たねを おいてみよう`;
    if (docked(state) && foodSupport(state) <= state.villagers.length && state.unlocked.includes('seed:farm'))
        return 'ごはんが たりないみたい。はたけの たねは どうかな';
    if (seeds) return `たねが ${seeds}こ まってるよ。まなぶと しまの じかんが すすむよ`;
    if (!docked(state)) return `ふねで ${visitor}が こっちに むかってるよ`;
    return 'みんなを さわったり、つまんで はこんだり してみよう';
}

export function actorLine(state: GrowingState, id: string) {
    if (id === 'pokomoko') return idleLine(state);
    if (id === 'visitor') return `${SPECIES_NAME[state.pier.visitor.species]}「ここに すめたら いいな」`;
    const v = state.villagers.find(v => v.id === id);
    if (!v) return '';
    if (v.species === 'girl' || v.species === 'boy') {
        const lines = KID_LINES[v.species];
        return `${villagerName(v)}「${lines[Math.floor(Date.now() / 4000) % lines.length]}」`;
    }
    const lines = { lively: 'きょうも げんき いっぱい！', mellow: 'のんびり するのが すき', shy: 'えへへ…', hungry: 'おなか すいたなあ' } as const;
    return `${villagerName(v)}「${lines[v.trait]}」`;
}

const LIKE_WISH: Record<Like, string> = {
    flower: 'おはなが ちかくに あったら うれしいな', water: 'みずが ちかくに あったら うれしいな', tree: 'きが ちかくに あったら うれしいな',
    light: 'あかりが ちかくに あったら うれしいな', food: 'ごはんが もっと あったら うれしいな', play: 'あそびばが ちかくに あったら うれしいな',
    farm: 'はたけが ちかくに あったら うれしいな', quiet: 'しずかな ところが すきなんだ',
};

/** A friend's wish in their own words: comfort is never shown as a number (§7.4). */
export function wishLine(state: GrowingState, villager: Villager) {
    const stars = comfort(state, villager);
    if (stars >= 3) return 'この しま だいすき！';
    return LIKE_WISH[likesOf(villager)[stars === 0 ? 0 : 1]];
}
