import { evaluateDiscovery } from './discovery';
import type { DiscoveryScene } from './discoveryJournal';
import { growthStage, type LifeState } from './model';

/** Resolve the original participants from the recorded rule signature and frozen
 * scene, never from whichever plant currently happens to be first on the island. */
export function discoveryParticipants(event: DiscoveryScene) {
    const snapshot = event.snapshot.scene;
    const state: LifeState = { ...snapshot, drops: 0, light: 0, styles: [], days: {} };
    let signature: unknown;
    try { signature = JSON.parse(event.semanticSignature); } catch { return []; }
    if (!Array.isArray(signature) || typeof signature[0] !== 'string') return [];
    const rule = evaluateDiscovery(state, event.profileId).find(rule => rule.ruleId === event.ruleId
        && rule.ruleVersion === event.ruleVersion && rule.semanticSignature === signature[0]);
    return rule ? rule.participantIds.flatMap(id => snapshot.items.filter(item => item.id === id)) : [];
}

export function discoveryTitle(event: DiscoveryScene) {
    if (event.ruleId === 'M2') {
        const plant = discoveryParticipants(event)[0];
        return plant?.kind === 'flower' && growthStage(plant) === 2 ? 'はなびらが うえへ' : 'はっぱが うえへ';
    }
    return { G0: 'つながった つち', GF3: 'あつまった おはな', GF6: 'ひろがった おはな',
        GT3: 'つながった 木かげ', GT6: 'ひろがった 木かげ', GW2: 'ならんだ 水べ',
        GP2: 'ならんだ あそびば', GP3: 'ひろがった あそびば', R1: 'おはなの そばの ベンチ', R2: '木かげの テーブル', R3: 'ブランコの そばの ベンチ', R4: '水べの ベンチ', R5: 'ほんを はこんで ひとやすみ', R6: 'どうぐを はこんで おていれ' }[event.ruleId];
}
