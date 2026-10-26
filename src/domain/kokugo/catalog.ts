import { kanjiItems } from './kanji/catalog';
import { kanjiEntry } from './kanji/data';
import { kanjiUnitInfo } from './kanji/curriculum';
import { familyForItem } from './families';
import { KOKUGO_AUDIO } from './audioAssets';
import { EDITORIAL_ROWS, EDITORIAL_FAMILIES, EDITORIAL_CONDITIONS } from './catalogEditorial';
import { REVIEW_ROWS } from './catalogExtension';
import { BASIC_ROWS } from './catalogBasics';
import { TEXT_ROWS } from './catalogTexts';
import { KOKUGO_STARTER_UNITS, kokugoUnit, itemCondition } from './curriculum';
import type { KokugoItem } from './types';
const activities: Record<string, [string, string][]> = {
    H06: [['「川」を 紙に 書いてみよう。', '書いたら「川」と 見くらべよう。線の数や 向きを 見てみよう。'], ['「花」を 紙に 書いてみよう。', '書いたら「花」と 見くらべよう。上と下の まとまりを 見てみよう。'], ['「空」を 紙に 書いてみよう。', '書いたら「空」と 見くらべよう。大きさや 位置を 見てみよう。']],
    E05: [['今日 読んだ文を、自分のことばで 短く まとめよう。', '何についての文か、大切だと 思うことを 残してみよう。'], ['昨日 あったことを 二文で まとめよう。', 'いつ、何があったか。順番も たしかめよう。'], ['好きな本を まだ読んでいない人に 紹介しよう。', '内容の 大切なところと、おすすめする 理由を 書いてみよう。']],
    E06: [['学校や家で 変えたいことを、理由と いっしょに 書こう。', '私は〜と考える。理由は〜だから。という形も 使えるよ。'], ['外で 遊ぶ楽しさを、体験を 入れて 書こう。', '考えと 体験を 分け、体験が どう理由になるか つなげよう。'], ['図書館に 置きたい本を、理由と いっしょに 書こう。', 'だれに 役立つか、どんな点が よいかも 考えてみよう。']],
    E07: [['自分の文章を 読み返して、直したいところを 書こう。', '主語と述語、つながり、同じことばの 重なりを 見てみよう。'], ['本の一文を 引用し、自分の感想と 分けて 書こう。', '引用は「 」で 囲み、本の名前も 記そう。'], ['短い案内を 書き、日時・場所・持ち物を 点検しよう。', '初めて 読む人にも 必要なことが 伝わるかな。']],
    E08: [['今日 うれしかったことを、だれかに 話してみよう。', '話したことや、聞いてもらった 感想を 残してもいいよ。録音は しないよ。'], ['相手の話を 聞いて、一つ 質問してみよう。', 'もっと 知りたいところを 聞いてみよう。'], ['目を 閉じて、まわりの 音を 聞いてみよう。', 'どんな音が したか、ことばや絵で 残してみよう。']],
};
const rows = { ...BASIC_ROWS, ...TEXT_ROWS };
export const KOKUGO_ITEMS: KokugoItem[] = KOKUGO_STARTER_UNITS.flatMap<KokugoItem>(unit => {
    if (activities[unit.id]) return activities[unit.id].map(([prompt, model], index) => ({
        id: `${unit.id}-${index + 1}`, unitId: unit.id, version: 'kokugo-starter-2' as const,
        target: unit.id, family: familyForItem(unit.id, index), exposureGroup: `${unit.id}-material-${index + 1}`, condition: itemCondition(unit.id, index), mode: 'expression-open' as const,
        form: 'activity' as const, prompt, choices: [], answer: '', hint: model, model,
        ...(unit.id === 'H06' ? { teachingTarget: kanjiEntry(['川', '花', '空'][index])!.target } : {}),
    }));
    return [...(rows[unit.id] ?? []), ...(REVIEW_ROWS[unit.id] ?? []), ...(EDITORIAL_ROWS[unit.id] ?? [])].map(([prompt, answer, b, c, passage, target], index) => {
        const editorialIndex = index - (rows[unit.id]?.length ?? 0) - (REVIEW_ROWS[unit.id]?.length ?? 0);
        const editorialFamily = EDITORIAL_FAMILIES[unit.id]?.[editorialIndex];
        const order = unit.id === 'S05' || unit.id === 'E02';
        const choices = order ? answer.split('｜') : [answer, b, c];
        // Fixed, balanced answer positions, frozen again in a reservation.
        const offset = index % choices.length;
        return {
            id: `${unit.id}-${index + 1}`, unitId: unit.id, version: 'kokugo-starter-2' as const,
            target: target ?? unit.id, family: editorialFamily ? `${unit.id}:${editorialFamily}` : familyForItem(unit.id, index), exposureGroup: `${unit.id}-material-${index + 1}`, condition: EDITORIAL_CONDITIONS[unit.id]?.[editorialIndex] ?? itemCondition(unit.id, index),
            mode: unit.id === 'K01' ? 'listening' as const : unit.track === 'K' || unit.id === 'H01' || unit.id === 'H02' ? 'decoding' as const
                : unit.track === 'E' ? 'expression-structured' as const : 'reading' as const,
            form: unit.id === 'K05' ? 'short' as const : order ? 'order' as const : unit.id === 'R04' && index === 0 ? 'span' as const : 'choice' as const,
            prompt: unit.id === 'K01' ? 'きいた ことばの はじめの おとは？' : unit.id === 'E02' ? 'だれが → 何を（何に）→ どうした の順に ならべよう。' : order ? '文に 書かれた順に ならべよう。' : prompt,
            passage: unit.id === 'S05' ? `はじめに ${choices[0]}。つぎに ${choices[1]}。さいごに ${choices[2]}。` : passage, choices: [...choices.slice(offset), ...choices.slice(0, offset)], answer,
            hint: passage ? '文に もどって、たずねられた ところを さがしてみよう。' : '例と くらべながら、もう一度 考えてみよう。',
            model: `答えの例は「${answer.split('｜').join(' ')}」。${passage ? '文の 手がかりと くらべてみよう。' : ''}`,
            ...(unit.id === 'K01' ? { audio: `/kokugo/v1/audio/K01-${index + 1}.mp3`, audioSha256: KOKUGO_AUDIO[`/kokugo/v1/audio/K01-${index + 1}.mp3`] } : {}),
        };
    });
});
export function itemsForUnit(unitId: string, focusTarget?: string) { kokugoUnit(unitId); return kanjiUnitInfo(unitId) ? kanjiItems(unitId, focusTarget) : KOKUGO_ITEMS.filter(item => item.unitId === unitId); }
export const READING_BOOKS = [
    { id: 'seed', title: '小さな たね', text: 'りすは 小さな たねを ひろいました。\n土に うめて、水を やりました。\n雨の日も、晴れの日も、りすは 土を 見ていました。\nある朝、小さな みどりの めが 出ていました。\nりすは そっと となりに すわりました。' },
    { id: 'bridge', title: '雨あがりの 橋', text: '雨がやむと、川の上に 光が さしました。\nはるは 橋のまんなかで 足を止めました。いつもより 水の音が 大きく聞こえます。\n岸の草には 水のつぶが 並んでいます。\n急いで 帰るつもりだった はるは、今日は ゆっくり 歩くことにしました。' },
    { id: 'shade', title: '木かげを 調べる', text: '夏の午後、公園のベンチに すわりました。日なたのベンチは 熱く、木かげのベンチは 涼しく感じます。\n木の葉は 日ざしを さえぎります。でも、涼しさの 理由は それだけでしょうか。風の通り方や 地面の様子も、場所によって 違います。\n一つの理由を 見つけたあとも、別の手がかりを 探すと 新しい問いが 生まれます。' },
    { id: 'shell', title: 'なみの おくりもの', text: 'あさ、うみべに しろい かいが ありました。\nあきは てのひらに のせました。\nなみが すなに せんを ひきます。\nあきは かいを すなに おき、となりに ちいさな せんを かきました。\nつぎの なみが、ふたつの せんを そっと けしました。' },
    { id: 'map', title: 'まちの 音の 地図', text: 'りおは まちを 歩きながら、聞こえた音を 地図に 書きました。\nパン屋の前では、とんとん。川のそばでは、さらさら。橋の下では、自分の足音が 少し 大きく なりました。\n同じ道でも、目を 閉じると 別のまちのようです。\n家に 帰って 地図を 見せると、弟が 言いました。「あしたは 朝の音も 聞きたいな。」' },
    { id: 'measure', title: '比べるために そろえる', text: '二つの鉢の 芽を 比べようとしたら、一方だけ 大きくなっていました。水の量が 違うからでしょうか。それとも、置いた場所の 違いでしょうか。\n二つの鉢は、土の量も 違っていました。このままでは、どの違いが 成長に 関わったか はっきりしません。\n次は、調べたい条件を 一つ 決め、それ以外を できるだけ そろえることにしました。比べるための 準備も、観察の 大切な 一部です。' },
];
