import { getIslandHabitatLevel, getIslandItemGrowthLevel, ISLAND_DISCOVERIES, isIslandHabitatUnlocked } from '../../domain/island/growth';
import { resolveIslandLivingSetting } from '../../domain/island/livingSettings';
import { isIslandVisitor, islandVisitorAvailability } from '../../domain/island/visitors';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';

export const ISLAND_DISCOVERY_HINTS: Record<string, { question: string; hint: string; setting: string }> = {
    'flower-scent': { question: 'おはな、どんな におい？', hint: 'さいた おはなへ どうぶつを よんでみよう。', setting: 'おはなの まわりを あけてみよう。' },
    'butterfly-visit': { question: 'おはなに だれが くる？', hint: 'おはなが そだったら、そばを ながめてみよう。', setting: 'おはなを しまに おいてみよう。' },
    'flower-sharing': { question: 'おはなを だれかに？', hint: 'おはなの ほうを むいた ベンチを、そばに おこう。', setting: 'ベンチと おはなを 近づけて、むきを かえてみよう。' },
    'water-gazing': { question: 'みずの そばで なにをする？', hint: 'ふんすいへ よんだり、みずの ほうへ ブランコを むけよう。', setting: 'ブランコを ふんすいの ほうへ むけてみよう。' },
    'water-sharing': { question: 'みずたま、わたせるかな？', hint: 'ふんすいの ほうを むいた ブランコを、そばに おこう。', setting: 'ふんすいと ブランコを 近づけて、むきを かえてみよう。' },
    'leaf-boat': { question: 'みずに なにが うかぶ？', hint: '大きく そだった ふんすいを ながめてみよう。', setting: 'ふんすいを しまに おいてみよう。' },
    'shade-rest': { question: '木の したは どんな ばしょ？', hint: 'きのこの いすを 大きな 木の そばへ。', setting: 'きのこの いすを 木の そばへ うごかしてみよう。' },
    'lantern-sharing': { question: 'あかりを いっしょに？', hint: 'あかりの ほうを むいた きのこの いすを、そばに おこう。', setting: 'きのこの いすと あかりを 近づけて、むきを かえてみよう。' },
    'home-visit': { question: 'おうちへ だれが くる？', hint: 'おうちが そだったら、あかりの そばへ よんでみよう。', setting: 'いえの あかりを しまに おいてみよう。' },
    'terrace-time': { question: 'テラスで いっしょに？', hint: '大きく そだった おうちへ、どうぶつを よんでみよう。', setting: 'いえまでの みちを あけてみよう。' },
    'petal-ripple': { question: '花びらが みずに のると？', hint: 'そだった おはなを ふんすいの そばへ。', setting: 'おはなと ふんすいを 近づけてみよう。' },
    'lantern-reflection': { question: 'あかりが みずに うつる？', hint: 'そだった あかりを ふんすいの そばへ。', setting: 'あかりと ふんすいを 近づけてみよう。' },
    'ribbon-butterfly': { question: 'もようの ちがう おきゃくさん？', hint: 'そだった おはなに、ときどき やってくるよ。', setting: 'おはなを しまに おいてみよう。' },
    'pond-firefly': { question: 'みずべで ひかるのは？', hint: 'そだった みずべに、ときどき やってくるよ。', setting: 'ふんすいを しまに おいてみよう。' },
    'leaf-bird': { question: '木かげで 葉っぱが うごく？', hint: 'そだった 木かげに、ときどき やってくるよ。', setting: 'きのこの いすを 木かげに おいてみよう。' },
};

/** A guide predicts opportunities; only the real renderer can add observations. */
export function islandDiscoveryGuide(island: IslandRecord, discoveryId: string) {
    const entry = ISLAND_DISCOVERIES.find(candidate => candidate.id === discoveryId);
    if (!entry) return;
    const seen = island.growth?.discoveries.find(discovery => discovery.id === entry.id);
    const hosts = island.items.filter(item => entry.kinds.includes(item.kind)
        && (item.habitatId === entry.habitatId || ['lantern-sharing', 'lantern-reflection'].includes(entry.id)
            && (item.habitatId === 'grove' || item.habitatId === 'village')));
    const earnedHosts = hosts.filter(item => getIslandItemGrowthLevel(item) >= entry.minLevel
        && getIslandHabitatLevel(island, item.habitatId ?? entry.habitatId) >= entry.minLevel);
    const item = earnedHosts.find(item => item.position && item.id === seen?.itemId)
        ?? earnedHosts.find(item => item.position) ?? earnedHosts[0] ?? hosts[0];
    const hint = ISLAND_DISCOVERY_HINTS[entry.id] ?? { question: 'どんな くらしが あるかな？', hint: entry.description, setting: 'おく ばしょや むきを かえてみよう。' };
    const unlocked = Boolean(island.growth) && isIslandHabitatUnlocked(island, item?.habitatId ?? entry.habitatId);
    const status = !earnedHosts.length || !unlocked ? 'grow'
        : !item?.position ? 'place'
            : !resolveIslandLivingSetting(island, item, entry.id) ? 'arrange'
                : isIslandVisitor(entry.id) && !islandVisitorAvailability(island, entry.id, item.id).offered && !seen ? 'visit'
                    : 'try';
    return { entry, item, seen, hint, status, unlocked, habitatId: item?.habitatId ?? entry.habitatId };
}

export function firstIslandDiscovery(island: IslandRecord, habitatId: IslandHabitatId) {
    const entries = ISLAND_DISCOVERIES.filter(entry => entry.habitatId === habitatId);
    return entries.find(entry => !island.growth?.discoveries.some(discovery => discovery.id === entry.id))?.id ?? entries[0]?.id;
}
