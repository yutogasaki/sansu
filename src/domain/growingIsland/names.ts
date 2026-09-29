import { roll } from './random';
import { isKid, KID } from './rules';
import type { GrowingState, Species, Visitor } from './types';

/**
 * Names a friend arrives with (§1: "付けなければ候補から自動"). Children can rename every
 * animal (えま and えいた keep their names); these only make eight rabbits eight different rabbits from the first day.
 */
export const NAME_CANDIDATES: Record<Species, readonly string[]> = {
    rabbit: ['みみ', 'しらたま', 'もなか', 'ふわり', 'うさこ', 'ぴょんた'],
    otter: ['ちゃぷ', 'なみの', 'すいすい', 'ぽちゃ', 'かいり', 'るる'],
    fox: ['こんた', 'きなこ', 'もみじ', 'ゆず', 'ぽん', 'あんず'],
    duck: ['ぷくり', 'ぱる', 'かもみ', 'ぺたこ', 'ちゃっぷ', 'ぐぅ'],
    squirrel: ['くるみ', 'どんぐり', 'まろん', 'くりこ', 'ちっぷ', 'ぽっけ'],
    hedgehog: ['とげまる', 'ころん', 'まるる', 'いがっち', 'ちくちく', 'はりぃ'],
    bird: ['ぴぴ', 'ちゅんた', 'るり', 'ぴいこ', 'ことね', 'そよ'],
    girl: [KID.girl.name],
    boy: [KID.boy.name],
};

/** The first candidate nobody on the island uses yet, starting from a deterministic place. */
export function arrivalName(state: Pick<GrowingState, 'seed' | 'villagers'>, visitor: Pick<Visitor, 'species' | 'ordinal'>) {
    if (isKid(visitor.species)) return KID[visitor.species].name;
    const list = NAME_CANDIDATES[visitor.species];
    const start = Math.floor(roll(state.seed, 'name', visitor.species, visitor.ordinal) * list.length);
    const used = new Set(state.villagers.map(v => v.name));
    for (let i = 0; i < list.length; i++) {
        const name = list[(start + i) % list.length];
        if (!used.has(name)) return name;
    }
    return list[start];
}
