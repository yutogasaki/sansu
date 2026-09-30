import { keepsakeKind } from '../../../domain/growingIsland';
import type { GrowingState } from '../../../domain/growingIsland';
import { KEEPSAKE_NAME, villagerName } from './growingCopy';

export interface Letter { id: string; from: string; text: string; order: number }

/**
 * なかまの てがみ: what happened on the island, written by the friends it happened to. Derived
 * from the island itself, so nothing new is saved and a letter can never go missing.
 */
export function islandLetters(state: GrowingState): Letter[] {
    const letters: Letter[] = [];
    for (const v of state.villagers) {
        const name = villagerName(v);
        const text = v.species === 'girl' ? 'おうちを たててくれて ありがとう！ しまで いっぱい あそぼうね'
            : v.species === 'boy' ? 'この しま、すごく いいね！ いっしょに きのぼり しようよ'
                : v.legacyId ? 'ずっと いっしょに いてくれて ありがとう。あたらしい しまも よろしくね'
                    : 'すむ ところを つくってくれて ありがとう。この しまが すきに なったよ';
        letters.push({ id: `arrive-${v.id}`, from: name, text, order: v.arrivedAt * 10 });
    }
    for (const plot of state.plots) {
        if (plot.kind !== 'home' || plot.stage < 4) continue;
        const people = state.villagers.filter(v => v.home === plot.id);
        if (!people.length) continue;
        letters.push({ id: `grand-${plot.id}`, from: people.map(villagerName).join('と '), text: 'おうちが ふたかいだてに なったよ！ まどから うみが みえるんだ', order: (plot.stagedAt ?? 0) * 10 + 1 });
    }
    state.keepsakes.forEach((k, i) => letters.push({ id: `keep-${k.id}`, from: 'ぽこもこ', order: 1e9 + i,
        text: `${KEEPSAKE_NAME[keepsakeKind(k.unitId)]}が とどいたね。まなんだ ことが かたちに なったよ。すごいね！` }));
    state.landmarks.filter(l => l.from).forEach((l, i) => letters.push({ id: `gift-${l.id}`, from: l.from!, order: 2e9 + i,
        text: 'おはなを おいてきたよ。きれいに さいてね' }));
    return letters.sort((a, b) => b.order - a.order);
}
