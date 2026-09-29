import { docked, foodSupport, housing, waitingSeeds } from '../../../domain/growingIsland';
import type { Character, GrowingState, LandmarkKind, SeedKind, Species, TownEvent, Villager } from '../../../domain/growingIsland';

export const SPECIES_NAME: Record<Species, string> = {
    rabbit: 'うさぎ', otter: 'カワウソ', fox: 'キツネ', duck: 'カモ', squirrel: 'リス', hedgehog: 'ハリネズミ', bird: 'ことり',
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
    fence: { name: 'さく', icon: '🪵' }, lighthouse: { name: 'とうだい', icon: '🗼' },
    pinwheel: { name: 'かざぐるま', icon: '🌀' }, 'flower-arch': { name: '花の アーチ', icon: '🌺' }, sandbox: { name: 'すなば', icon: '⛱️' },
    'garden-hut': { name: 'えんげい 小屋', icon: '🛖' }, library: { name: 'としょしつ', icon: '📚' },
};
export const HOME_STAGE = ['たね', 'テント', 'こや', 'いえ', 'ふたかいだて'] as const;

export const villagerName = (v: Pick<Villager, 'name' | 'species'>) => v.name ?? SPECIES_NAME[v.species];

/** Pokomoko's single line after opening town time. One reason, never blame (§11.3). */
export function revealLine(state: GrowingState, events: TownEvent[]) {
    const arrived = events.filter(e => e.type === 'arrived').length;
    if (state.arrivals.length) return arrived > 1 ? 'なかまが きたよ！ ふねを さわってね' : `${arrivalName(state)}が きたよ！ ふねを さわってね`;
    if (state.unopened.length) return 'つぼみが できたよ。さわって ひらいてみよう';
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
    if (events.some(e => e.type === 'boat')) return 'ふねが ちかづいてきたよ';
    return 'のんびりした じかんだったね';
}

function arrivalName(state: GrowingState) {
    const v = state.villagers.find(v => v.id === state.arrivals[0]);
    return v ? villagerName(v) : 'なかま';
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
    const lines = { lively: 'きょうも げんき いっぱい！', mellow: 'のんびり するのが すき', shy: 'えへへ…', hungry: 'おなか すいたなあ' } as const;
    return `${villagerName(v)}「${lines[v.trait]}」`;
}
