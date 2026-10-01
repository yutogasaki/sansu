import { roll } from '../../../domain/growingIsland/random';
import type { GrowingState, Villager } from '../../../domain/growingIsland';

const localDay = (now: Date) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

/**
 * Friends visiting Pokomoko's house today (up to three). The same visitors all day, a new
 * set tomorrow; えま and えいた come a little more often once they live on the island.
 */
export function houseGuests(state: GrowingState, now = new Date()): Villager[] {
    const day = localDay(now), present = state.villagers.filter(v => !v.away);
    const count = Math.min(3, present.length, 1 + Math.floor(roll(state.seed, 'house-guests', day, 0) * 3));
    return present.map(v => ({ v, r: roll(state.seed, 'house-guest', day, Number(v.id.replace(/\D/g, '')) || v.arrivedAt) / (v.species === 'girl' || v.species === 'boy' ? 1.6 : 1) }))
        .sort((a, b) => a.r - b.r).slice(0, count).map(entry => entry.v);
}

const LINES = ['きょうは あそびに きたよ！', 'ぽこもこの いえ、すき', 'この かべ、きれいだね', 'いっしょに おやつ たべよう', 'まなんだ ことば、かべに いっぱいだね'];
export function guestLine(guest: Villager, now = new Date()) {
    if (guest.species === 'girl') return 'あそびに きたよ！ かべの みずたま、さわってみて';
    if (guest.species === 'boy') return 'ぽこもこの いえ、たのしいね！';
    return LINES[(guest.arrivedAt + now.getDate()) % LINES.length];
}
