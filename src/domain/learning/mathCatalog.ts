import type { LearningItemMapping, LearningRepresentation, LearningUnitDefinition } from './types';

type Item = readonly [id: string, level: number, representation: LearningRepresentation, variants?: readonly string[]];
type Dependencies = {
    prerequisites?: readonly string[];
    suggestedPrerequisites?: readonly string[];
    notes?: string;
};
type Entry = { unit: LearningUnitDefinition; mappings: readonly LearningItemMapping[] };

const existing = (
    concept: string, label: string, strand: string, items: readonly Item[], dependencies: Dependencies = {},
): Entry => {
    const id = `math.${concept}`;
    return {
        unit: {
            id, subject: 'math', label, strand, itemIds: items.map(item => item[0]),
            availability: 'existing', prerequisites: [], suggestedPrerequisites: [], ...dependencies,
        },
        mappings: items.map(([itemId, legacyLevel, representation, variants = ['default']]) => ({
            itemId, subject: 'math', unitId: id, legacyLevel, representation, variants,
        })),
    };
};

const planned = (concept: string, label: string, strand: string, dependencies: Dependencies = {}): Entry => ({
    unit: {
        id: `math.${concept}`, subject: 'math', label, strand, itemIds: [], availability: 'planned',
        prerequisites: [], suggestedPrerequisites: [], ...dependencies,
    },
    mappings: [],
});

/** Shadow metadata: these relationships must never gate the legacy planner. */
const ENTRIES: readonly Entry[] = [
    existing('count-quantity', 'ものの個数を数える', 'quantity', [
        ['count_5', 0, 'concrete'], ['count_dot', 0, 'concrete'], ['count_10', 3, 'concrete'],
    ], { notes: '5枠・ドット・10枠と選択/数値入力を含む。各教材の数範囲と入力差は保持する。' }),
    existing('number-reading', '数字と日本語の読みを結ぶ', 'number-language', [
        ['count_read', 0, 'bridge'],
    ], { notes: '数字・個数図からかなの読みを選ぶ。数量理解や算術全体の必須前提にしない。' }),
    existing('one-to-one', '一対一に対応させる', 'quantity', [['one_to_one_match', 0, 'concrete']]),
    existing('equal-quantity', '同じ個数のまとまりを見つける', 'quantity', [['same_count_match', 0, 'concrete']]),
    existing('shape-recognition', '形と形の名前を結ぶ', 'shape', [['count_shape', 1, 'concrete']]),
    existing('color-recognition', '色の名前を選ぶ', 'attribute', [['count_color', 1, 'concrete']], {
        notes: '色識別とかなの語彙が関わる独立した活動。算術の前提にしない。',
    }),
    existing('visual-matching', '同じもの・違うものを見分ける', 'attribute', [
        ['count_pair', 1, 'concrete'], ['same_or_different', 1, 'concrete'],
    ]),
    existing('repeating-pattern', '繰り返しの続きを見つける', 'pattern', [['pattern_copy', 1, 'concrete']]),
    existing('successor', '次の数・一つ多い数', 'number-sequence', [
        ['one_more', 2, 'bridge'], ['count_next_10', 3, 'bridge'], ['count_50', 6, 'bridge'],
        ['count_next_20', 6, 'bridge'], ['count_100', 7, 'bridge'],
    ], {
        suggestedPrerequisites: ['math.count-quantity'],
        notes: 'count_50/count_100も大量のものを数える問題ではなく、次の数を補う問題。数範囲は旧IDごとに異なる。',
    }),
    existing('ordinal', '並びの何番目かを見つける', 'number-sequence', [['ordinal_small', 2, 'concrete']]),
    existing('spatial-relation', '位置関係を読み取る', 'space', [['spatial_words', 2, 'concrete']]),
    existing('compose-five', '5をつくる残りの数', 'quantity-structure', [['compose_5', 2, 'concrete']], {
        suggestedPrerequisites: ['math.count-quantity'],
    }),
    existing('combine-small', '小さいまとまりを合わせる', 'addition', [
        ['add_tiny', 2, 'concrete'], ['add_finger', 5, 'concrete'], ['add_5', 6, 'concrete'],
    ], { suggestedPrerequisites: ['math.count-quantity'] }),
    existing('predecessor', '前の数・一つ少ない数', 'number-sequence', [
        ['count_back', 3, 'bridge'], ['one_less', 5, 'bridge'],
    ], { suggestedPrerequisites: ['math.successor'] }),
    existing('smallest-number', '示された数から最小を選ぶ', 'number-order', [['count_order', 3, 'bridge']], {
        notes: '現行問題は最小値の選択。数列全体を並べ替える能力までは確認していない。',
    }),
    existing('compare-quantities', '二つのまとまりの多さを比べる', 'quantity', [['count_which_more', 3, 'concrete']]),
    existing('compare-length', '長さを比べる', 'measurement', [['length_compare', 4, 'concrete']]),
    existing('compare-height', '高さを比べる', 'measurement', [['height_compare', 4, 'concrete']]),
    existing('compare-size', '見た目の大きさを比べる', 'measurement', [['big_small_compare', 4, 'concrete']]),
    existing('compare-weight', '重さを比べる', 'measurement', [['weight_compare', 4, 'concrete']]),
    existing('classify-attributes', '同じ属性・仲間外れを見つける', 'attribute', [
        ['sort_by_attribute', 4, 'concrete'], ['count_oddone', 4, 'concrete'],
    ]),
    existing('two-more', '二つ多い数', 'number-sequence', [['two_more', 5, 'bridge']], {
        suggestedPrerequisites: ['math.successor'],
    }),
    existing('zero-quantity', '空と0を結ぶ', 'quantity', [
        ['which_is_empty', 5, 'concrete'], ['zero_concept', 5, 'concrete'],
    ]),
    existing('equal-sharing', 'ものを等しく分ける', 'division', [['share_equal', 5, 'concrete']], {
        suggestedPrerequisites: ['math.one-to-one', 'math.count-quantity'],
    }),
    existing('compose-ten', '10をつくる残りの数', 'quantity-structure', [['compose_10', 6, 'concrete']], {
        suggestedPrerequisites: ['math.compose-five', 'math.count-quantity'],
    }),
    existing('two-less', '二つ少ない数', 'number-sequence', [['two_less', 6, 'bridge']], {
        suggestedPrerequisites: ['math.predecessor'],
    }),
    existing('remove-small', '小さいまとまりから取り去る', 'subtraction', [['sub_tiny', 6, 'concrete']], {
        suggestedPrerequisites: ['math.count-quantity', 'math.zero-quantity'],
    }),
    existing('sequence-gap', '連続する数の穴を埋める', 'number-sequence', [['count_fill', 7, 'bridge']], {
        suggestedPrerequisites: ['math.successor', 'math.predecessor'],
    }),
    existing('compare-one-digit', '1桁の数を不等号で比べる', 'number-order', [['compare_1d', 7, 'bridge']], {
        suggestedPrerequisites: ['math.compare-quantities', 'math.smallest-number'],
    }),
    existing('compare-two-digit', '2桁の数を不等号で比べる', 'number-order', [['compare_2d', 7, 'bridge']], {
        prerequisites: ['math.place-value-tens'], suggestedPrerequisites: ['math.compare-one-digit'],
    }),
    existing('add-small-increments', '小さい数を足す式', 'addition', [
        ['add_1d_1_bridge', 8, 'bridge'], ['add_1d_1', 8, 'symbol'],
    ], {
        suggestedPrerequisites: ['math.combine-small', 'math.successor'],
        notes: '現行の+1〜+3は10をまたぐ場合もある。「繰上なし」という単元に分類しない。',
    }),
    existing('add-wide-increments', '大きめの数を足す式', 'addition', [
        ['add_1d_2_bridge', 9, 'bridge'], ['add_1d_2', 9, 'symbol'],
    ], {
        suggestedPrerequisites: ['math.add-small-increments', 'math.compose-ten'],
        notes: '現行導入は繰上なし・10づくり・繰上ありを含む。旧IDの達成を繰上あり全般の達成にしない。',
    }),
    existing('subtract-within-ten', '10以内の引き算の式', 'subtraction', [
        ['sub_1d1d_nc_bridge', 10, 'bridge'], ['sub_1d1d_nc', 10, 'symbol'],
    ], { suggestedPrerequisites: ['math.remove-small', 'math.zero-quantity'] }),
    existing('subtract-across-ten', '10をまたぐ引き算の式', 'subtraction', [
        ['sub_1d1d_c_bridge', 10, 'bridge'], ['sub_1d1d_c', 10, 'symbol'],
    ], {
        suggestedPrerequisites: ['math.subtract-within-ten', 'math.compose-ten'],
        notes: '旧IDは1d1dだが繰下ありの主範囲は11〜18から1桁を引く。導入の易しい型も同IDに含む。',
    }),
    existing('add-two-one-no-regroup', '2桁+1桁・繰上なし', 'addition', [
        ['add_2d1d_nc_bridge', 11, 'bridge'], ['add_2d1d_mental_nc', 11, 'mental'],
        ['add_2d1d_hissan_nc', 11, 'algorithm'], ['add_2d1d_nc', 11, 'symbol'],
    ], {
        prerequisites: ['math.place-value-tens'], suggestedPrerequisites: ['math.add-small-increments', 'math.add-wide-increments'],
        notes: 'mental教材には数直線の補助がある。モードの記録は解法の自力選択や無補助暗算の証明ではない。',
    }),
    existing('add-two-one-regroup', '2桁+1桁・繰上あり', 'addition', [
        ['add_2d1d_c_bridge', 11, 'bridge'], ['add_2d1d_make10', 11, 'strategy'],
        ['add_2d1d_hissan_c', 11, 'algorithm'], ['add_2d1d_c', 11, 'symbol'],
    ], {
        prerequisites: ['math.place-value-tens'],
        suggestedPrerequisites: ['math.add-two-one-no-regroup', 'math.compose-ten'],
    }),
    existing('subtract-two-one-no-regroup', '2桁−1桁・繰下なし', 'subtraction', [
        ['sub_2d1d_nc_bridge', 11, 'bridge'], ['sub_2d1d_diff', 11, 'strategy'],
        ['sub_2d1d_hissan_nc', 11, 'algorithm'], ['sub_2d1d_nc', 11, 'symbol'],
    ], { prerequisites: ['math.place-value-tens'], suggestedPrerequisites: ['math.subtract-within-ten'] }),
    existing('subtract-two-one-regroup', '2桁−1桁・繰下あり', 'subtraction', [
        ['sub_2d1d_c_bridge', 11, 'bridge'], ['sub_2d1d_back_add', 11, 'reverse'],
        ['sub_2d1d_hissan_c', 11, 'algorithm'], ['sub_2d1d_c', 11, 'symbol'],
    ], {
        prerequisites: ['math.place-value-tens'],
        suggestedPrerequisites: ['math.subtract-two-one-no-regroup', 'math.subtract-across-ten'],
    }),
    existing('add-two-two-no-regroup', '2桁+2桁・繰上なし', 'addition', [['add_2d2d_nc', 11, 'symbol']], {
        prerequisites: ['math.place-value-tens'], suggestedPrerequisites: ['math.add-two-one-no-regroup'],
    }),
    existing('add-two-two-regroup', '2桁+2桁・繰上あり', 'addition', [['add_2d2d_c', 11, 'symbol']], {
        prerequisites: ['math.place-value-tens'],
        suggestedPrerequisites: ['math.add-two-two-no-regroup', 'math.add-two-one-regroup'],
        notes: '1の位または10の位の繰上を含む。v1のdefaultは両方の型の網羅を保証しない。',
    }),
    existing('subtract-two-two', '2桁−2桁', 'subtraction', [
        ['sub_2d2d', 11, 'symbol', ['no-regroup', 'regroup']],
    ], {
        prerequisites: ['math.place-value-tens'],
        suggestedPrerequisites: ['math.subtract-two-one-no-regroup', 'math.subtract-two-one-regroup'],
        notes: '一の位を借りるかは生成した問題から区別し、二つの型の証拠を混ぜない。',
    }),
    existing('add-multi-digit', '3桁・4桁の足し算', 'addition', [
        ['add_3d3d', 12, 'symbol'], ['add_4d', 12, 'symbol'],
    ], { prerequisites: ['math.place-value-expanded'], suggestedPrerequisites: ['math.add-two-two-regroup'] }),
    existing('subtract-multi-digit', '3桁・4桁の引き算', 'subtraction', [
        ['sub_3d3d', 12, 'symbol'], ['sub_4d', 12, 'symbol'],
    ], { prerequisites: ['math.place-value-expanded'], suggestedPrerequisites: ['math.subtract-two-two'] }),
    existing('multiplication-facts', '九九の積を求める', 'multiplication', [
        ['mul_99_2', 13, 'symbol'], ['mul_99_3', 13, 'symbol'], ['mul_99_4', 13, 'symbol'],
        ['mul_99_5', 13, 'symbol'], ['mul_99_1', 13, 'symbol'], ['mul_99_6', 14, 'symbol'],
        ['mul_99_7', 14, 'symbol'], ['mul_99_8', 14, 'symbol'], ['mul_99_9', 14, 'symbol'], ['mul_99_rand', 14, 'symbol'],
    ], {
        prerequisites: ['math.equal-groups'], suggestedPrerequisites: ['math.combine-small'],
        notes: '段は概念の別単元ではなく練習範囲。後続評価では各因子・積の被覆を確認し、一つの段で全体達成にしない。',
    }),
    existing('multiply-one-digit', '複数桁に1桁を掛ける', 'multiplication', [
        ['mul_2d1d', 15, 'symbol'], ['mul_3d1d', 15, 'symbol'],
    ], {
        prerequisites: ['math.place-value-expanded', 'math.equal-groups'],
        suggestedPrerequisites: ['math.multiplication-facts', 'math.add-multi-digit'],
    }),
    existing('divide-facts', '九九範囲の割り算', 'division', [['div_99_rev', 16, 'symbol']], {
        prerequisites: ['math.division-meaning'], suggestedPrerequisites: ['math.multiplication-facts'],
        notes: 'revというIDでも問題は a ÷ b = の式。掛け算の穴埋めによる逆向き表現ではない。',
    }),
    existing('divide-one-digit-exact', '1桁で割る割り切れる計算', 'division', [
        ['div_2d1d_exact', 16, 'symbol'], ['div_3d1d_exact', 18, 'symbol'],
    ], {
        prerequisites: ['math.division-meaning', 'math.place-value-expanded'],
        suggestedPrerequisites: ['math.divide-facts', 'math.multiply-one-digit'],
    }),
    existing('divide-remainder', '商と余りを求める', 'division', [
        ['div_rem_q1', 17, 'symbol'], ['div_rem_q2', 17, 'symbol'],
    ], {
        prerequisites: ['math.division-meaning'], suggestedPrerequisites: ['math.divide-one-digit-exact'],
        notes: '商1桁/2桁の範囲と複数欄入力を保持。余りの量を直接説明する教材は未実装。',
    }),
    existing('multiply-two-digit', '複数桁に2桁を掛ける', 'multiplication', [
        ['mul_2d2d', 18, 'symbol'], ['mul_3d2d', 18, 'symbol'],
    ], {
        prerequisites: ['math.place-value-expanded', 'math.equal-groups'],
        suggestedPrerequisites: ['math.multiply-one-digit', 'math.add-multi-digit'],
    }),
    existing('divide-two-digit-exact', '2桁で割る割り切れる計算', 'division', [
        ['div_2d2d_exact', 18, 'symbol'], ['div_3d2d_exact', 18, 'symbol'],
    ], {
        prerequisites: ['math.division-meaning', 'math.place-value-expanded'],
        suggestedPrerequisites: ['math.divide-one-digit-exact', 'math.multiply-two-digit'],
    }),
    existing('decimal-add', '小数を足す', 'decimal', [['dec_add', 19, 'symbol']], {
        prerequisites: ['math.decimal-place-value'], suggestedPrerequisites: ['math.decimal-compare', 'math.add-two-two-regroup'],
    }),
    existing('decimal-subtract', '小数を引く', 'decimal', [['dec_sub', 19, 'symbol']], {
        prerequisites: ['math.decimal-place-value'], suggestedPrerequisites: ['math.decimal-compare', 'math.subtract-two-two'],
    }),
    existing('decimal-multiply-integer', '小数に整数を掛ける', 'decimal', [['dec_mul_int', 20, 'symbol']], {
        prerequisites: ['math.decimal-place-value'], suggestedPrerequisites: ['math.multiply-one-digit', 'math.decimal-compare'],
    }),
    existing('decimal-divide-integer', '小数を整数で割る', 'decimal', [['dec_div_int', 20, 'symbol']], {
        prerequisites: ['math.decimal-place-value', 'math.division-meaning'],
        suggestedPrerequisites: ['math.divide-one-digit-exact', 'math.decimal-compare'],
    }),
    existing('decimal-multiply-decimal', '小数に小数を掛ける', 'decimal', [['dec_mul_dec', 20, 'symbol']], {
        prerequisites: ['math.decimal-place-value'],
        suggestedPrerequisites: ['math.decimal-multiply-integer', 'math.scale-powers-ten'],
    }),
    existing('decimal-divide-decimal', '小数を小数で割る', 'decimal', [['dec_div_dec', 20, 'symbol']], {
        prerequisites: ['math.decimal-place-value', 'math.division-meaning'],
        suggestedPrerequisites: ['math.decimal-divide-integer', 'math.scale-powers-ten'],
    }),
    existing('fraction-add-same', '同分母の分数を足す', 'fraction', [['frac_add_same', 21, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-compare'], notes: '現行解答には約分が必要。分母の意味だけの達成と分けて扱う。',
    }),
    existing('fraction-subtract-same', '同分母の分数を引く', 'fraction', [['frac_sub_same', 21, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-compare'],
    }),
    existing('fraction-add-different', '異分母の分数を足す', 'fraction', [['frac_add_diff', 22, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-add-same'],
    }),
    existing('fraction-subtract-different', '異分母の分数を引く', 'fraction', [['frac_sub_diff', 22, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-subtract-same'],
    }),
    existing('fraction-add-mixed', '同分母の帯分数を足す', 'fraction', [['frac_mixed', 22, 'symbol']], {
        prerequisites: ['math.fraction-mixed-meaning', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-add-same'],
    }),
    existing('fraction-subtract-mixed', '同分母の帯分数を引く', 'fraction', [['frac_mixed_sub', 22, 'symbol']], {
        prerequisites: ['math.fraction-mixed-meaning', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-subtract-same'],
    }),
    existing('fraction-multiply-integer', '分数に整数を掛ける', 'fraction', [['frac_mul_int', 23, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.multiplication-facts'],
    }),
    existing('fraction-multiply-fraction', '分数に分数を掛ける', 'fraction', [['frac_mul_frac', 23, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        suggestedPrerequisites: ['math.fraction-multiply-integer'],
    }),
    existing('fraction-divide-integer', '分数を整数で割る', 'fraction', [['frac_div_int', 24, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence', 'math.division-meaning'],
        suggestedPrerequisites: ['math.fraction-multiply-integer'],
    }),
    existing('fraction-divide-fraction', '分数を分数で割る', 'fraction', [['frac_div_frac', 24, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence', 'math.division-meaning'],
        suggestedPrerequisites: ['math.fraction-divide-integer', 'math.fraction-multiply-fraction'],
    }),
    existing('scale-powers-ten', '10倍・100倍・10分の1', 'place-value', [['scale_10x', 24, 'symbol']], {
        prerequisites: ['math.place-value-expanded', 'math.decimal-place-value'],
        notes: '整数の×10/×100と小数にもなる÷10を同IDに含む。defaultは型別の達成を証明しない。',
    }),
    existing('large-number-units', '万・億の単位で数を読む', 'place-value', [['large_number_unit', 25, 'symbol']], {
        prerequisites: ['math.place-value-expanded'],
    }),
    existing('decimal-compare', '小数の大小と等しさ', 'decimal', [['dec_compare', 25, 'symbol']], {
        prerequisites: ['math.decimal-place-value'], suggestedPrerequisites: ['math.compare-two-digit'],
    }),
    existing('fraction-compare', '分数の大小と等しさ', 'fraction', [['frac_compare', 26, 'symbol']], {
        prerequisites: ['math.fraction-quantity', 'math.fraction-equivalence'],
        notes: '同分母、同分子、等しい分数の3型を含む。分数の計算完了を比較の前提にしない。',
    }),
    existing('percent', '部分・全体・百分率の関係', 'proportional-reasoning', [['percent_basic', 26, 'symbol']], {
        prerequisites: ['math.unit-rate'], suggestedPrerequisites: ['math.decimal-multiply-integer', 'math.decimal-divide-integer'],
    }),
    existing('average', '複数の値の平均', 'data', [['average_basic', 27, 'symbol']], {
        prerequisites: ['math.division-meaning'], suggestedPrerequisites: ['math.add-multi-digit', 'math.divide-one-digit-exact'],
    }),
    existing('ratio', '等しい比の穴を埋める', 'proportional-reasoning', [['ratio_basic', 27, 'symbol']], {
        prerequisites: ['math.unit-rate'], suggestedPrerequisites: ['math.multiplication-facts', 'math.divide-facts'],
    }),
    existing('speed', '速さ・時間・距離の関係', 'proportional-reasoning', [['speed_basic', 28, 'symbol']], {
        prerequisites: ['math.unit-rate'], suggestedPrerequisites: ['math.multiply-one-digit', 'math.divide-one-digit-exact'],
    }),
    planned('place-value-tens', '10のまとまりと1の位', 'place-value', {
        suggestedPrerequisites: ['math.compose-ten', 'math.count-quantity'],
        notes: '図の補助は既存計算にあるが、10と1への分解・再構成を直接答える教材は未実装。',
    }),
    planned('place-value-expanded', '100以上の位と位ごとの再構成', 'place-value', {
        prerequisites: ['math.place-value-tens'],
    }),
    planned('decimal-place-value', '1を10等分した量と小数の位', 'decimal', {
        prerequisites: ['math.place-value-tens'],
        notes: '小数比較や計算を通じた間接証拠から、量・位取りの直接確認を作らない。',
    }),
    planned('fraction-quantity', '等分した1と分数の量', 'fraction', {
        suggestedPrerequisites: ['math.equal-sharing'],
    }),
    planned('fraction-equivalence', '等しい分数・約分・通分の意味', 'fraction', {
        prerequisites: ['math.fraction-quantity'], suggestedPrerequisites: ['math.multiplication-facts', 'math.divide-facts'],
    }),
    planned('fraction-mixed-meaning', '整数と分数を合わせた量', 'fraction', {
        prerequisites: ['math.fraction-quantity'],
    }),
    planned('equal-groups', '同じ数ずつの集まりと掛け算', 'multiplication', {
        suggestedPrerequisites: ['math.count-quantity', 'math.combine-small'],
    }),
    planned('division-meaning', '等分除・包含除・余りの量', 'division', {
        suggestedPrerequisites: ['math.equal-sharing', 'math.equal-groups'],
    }),
    planned('unit-rate', '1あたりの量と二量の対応', 'proportional-reasoning', {
        prerequisites: ['math.division-meaning'], suggestedPrerequisites: ['math.equal-groups'],
    }),
];

export const MATH_LEARNING_UNITS: readonly LearningUnitDefinition[] = ENTRIES.map(entry => entry.unit);
export const MATH_ITEM_MAPPINGS: readonly LearningItemMapping[] = ENTRIES.flatMap(entry => entry.mappings);

export const MATH_LV11_UNIT_IDS: readonly string[] = [
    'math.add-two-one-no-regroup',
    'math.add-two-one-regroup',
    'math.subtract-two-one-no-regroup',
    'math.subtract-two-one-regroup',
    'math.add-two-two-no-regroup',
    'math.add-two-two-regroup',
    'math.subtract-two-two',
];
