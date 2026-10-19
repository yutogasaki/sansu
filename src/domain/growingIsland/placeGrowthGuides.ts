import type { PlaceGoalId } from './placeTypes';

/** New-world instructions describe current rules; the finite art catalog stays intact. */
export const GROWTH_PLACE_GUIDES: Record<PlaceGoalId, { name: string; hint: string; missing: string[]; inputs: string; note: string }> = {
    P01: { name: '木陰の庭', hint: '木を おいて そだててみよう', missing: ['木を おいて そだててみよう'], inputs: '木 1から・あるける すきま', note: '木のならべかたで 木陰が かわるよ。ベンチは すきなところへ' },
    P02: { name: '大樹の場所', hint: '大木を よせて、入口を あけてみよう', missing: ['大木を 2ほん以上 そだててみよう', '木のかたちに あう 入口を あけよう'], inputs: '大木 2ほん以上・かたちに あう 木と入口', note: '木が 大きく そだつのを たのしもう。入口の かたちが あうと、森の道へ' },
    P03: { name: '水辺の庭', hint: '水ばちの そばを あけてみよう', missing: ['水ばちを おいて、そばを あけてみよう'], inputs: '水ばち 1から・あるける 岸', note: '水ばちから みずみちを つなぐと、水のとおる 場所が かわるよ' },
    P04: { name: 'みんなの庭', hint: 'いえを 2けん、近くで そだててみよう', missing: ['いえを 2けん、近くで そだててみよう', 'いえの入口を つなぐ すきまを あけよう'], inputs: 'そだった いえ 2けんから・入口へ つながる すきま', note: 'いえのあいだの 庭へ、ぽこもこと なかまが あそびにくるよ' },
    P05: { name: '花の庭', hint: 'はなを おいて、ひらくのを たのしもう', missing: ['はなを おいて、ひらくのを たのしもう'], inputs: 'はな 1から・あるける すきま', note: 'すきな色で いいよ。列や まとまりで 花の庭が かわるよ' },
    P06: { name: 'めぐれる島', hint: 'ちがう 場所を 3しゅるい つないでみよう', missing: [], inputs: '', note: '木陰・水辺・花・みんなの庭から、すきな3しゅるいを つなごう' },
};

type Example = { id: string; label: string; result: string; demo: { role: string; x: number; z: number }[] };
const row = (role: string, count: number) => Array.from({ length: count }, (_, x) => ({ role, x: x * 2, z: 0 }));
export function growthPlaceExamples(id: PlaceGoalId, finiteExamples: Example[]): Example[] {
    switch (id) {
        case 'P01': return [
            { id: 'single', label: 'ひとつ', result: '木が そだつと、その木の 木陰に。', demo: row('tree', 1) },
            { id: 'lane', label: 'ならべる', result: '木と木の あいだを あけて、木陰の道へ。', demo: row('tree', 3) },
        ];
        case 'P02': return finiteExamples.map(example => ({ ...example, demo: example.demo.filter(item => item.role === 'tree'), result: '大木と入口の かたちが あう場所で、森の道を たのしもう。' }));
        case 'P03': return [
            { id: 'waterside', label: 'みずべ', result: '水ばちの そばに、あるける 岸を のこそう。', demo: [{ role: 'water', x: 0, z: 0 }] },
            { id: 'waterway', label: 'つなぐ', result: 'みずみちを 水ばちに つないでみよう。', demo: [{ role: 'water', x: 0, z: 0 }, { role: 'channel', x: 1, z: 0 }, { role: 'channel', x: 2, z: 0 }] },
        ];
        case 'P04': return [
            { id: 'garden', label: 'むかいの庭', result: 'そだった いえの入口を、あるける 庭で つなごう。', demo: row('home', 2) },
            { id: 'lane', label: 'ならぶ庭', result: 'いえを ふやしても、入口の すきまを のこそう。', demo: row('home', 3) },
        ];
        case 'P05': return [
            { id: 'single', label: 'ひとつ', result: 'ひとつの花から、すきな庭を はじめよう。', demo: row('flower', 1) },
            { id: 'flower-path', label: 'ならべる', result: '花が ひらくと、ならべた 色が つながるよ。', demo: row('flower', 3) },
            { id: 'flower-bed', label: 'あつめる', result: '花を あつめて、あるける まわりを のこそう。', demo: [{ role: 'flower', x: 0, z: 0 }, { role: 'flower', x: 1, z: 0 }, { role: 'flower', x: 0, z: 1 }, { role: 'flower', x: 1, z: 1 }] },
        ];
        case 'P06': return [];
    }
}

export const GROWTH_RELATION_GUIDES: Record<string, { name: string; visible: string; play: string }> = {
    C01: { name: '木陰と水辺', visible: '水と 木陰が とどく場所を つなごう', play: '木陰から みずべへ あるいてみよう' },
    C02: { name: '水辺と花の庭', visible: '水が とどく 花の庭へ つなごう', play: 'みずべから 花の庭へ あるいてみよう' },
    C03: { name: '木陰とみんなの庭', visible: 'みんなの庭に 木陰を とどけよう', play: '木陰と いえの庭を めぐってみよう' },
    C04: { name: '花とみんなの庭', visible: '花の庭と みんなの庭を つなごう', play: 'いえの庭から 花を みにいこう' },
};
