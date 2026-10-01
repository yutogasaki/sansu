# 算数の単元対応表

2026-10-01: [教材の意味・種類・導入の整合性](learning-content-integrity.md)を適用する。既存ID・所属と保存済み予約を維持し、語義/例文、問題の範囲・型、追加の基礎導入を修正する。新規文脈はcurriculum-v2とし、旧文脈は保存版のまま検証する。
親仕様は[学習単元と習得証拠](31_learning_units_spec.md)。新規カタログ版は `curriculum-v2`。対応の実装は `src/domain/learning/mathCatalog.ts`。

## 適用範囲

既存118教材の74単元と、追加の基礎9教材の9単元を合わせて83単元に対応させる。これは保存済みの29レベルを再採番する処理ではない。現在の出題・解放・SRSは[仕様29](29_learning_progression_spec.md)を保ち、短い基礎導入と型の循環は教材整合性の契約に従う。保存レベルの必須ロックは増やさない。

単元は概念の整理先。範囲の異なる旧ID、入力形式、表現、実問題の内容を保持する。単元に属する一つの教材の正解から、ほかの教材・表現・数範囲の達成を作らない。仕上げの資格は現在範囲の全単元・型を確認する。Lv11の詳細な遅延確認と型別比較は34に従う。

## Lv11の比較対象

| 単元ID（math.を省略） | 内容 | 旧教材数 | 比較で必要な表現・型 |
|---|---|---:|---|
| add-two-one-no-regroup | 2桁+1桁・繰上なし | 4 | symbol または algorithm × default |
| add-two-one-regroup | 2桁+1桁・繰上あり | 4 | symbol または algorithm × default |
| subtract-two-one-no-regroup | 2桁−1桁・繰下なし | 4 | symbol または algorithm × default |
| subtract-two-one-regroup | 2桁−1桁・繰下あり | 4 | symbol または algorithm × default |
| add-two-two-no-regroup | 2桁+2桁・繰上なし | 1 | symbol または algorithm × default |
| add-two-two-regroup | 2桁+2桁・繰上あり | 1 | symbol または algorithm × default |
| subtract-two-two | 2桁−2桁 | 1 | symbol / algorithmのいずれか一方式で no-regroup / regroupを別々に確認 |

無補助の式を解く方法と、問題全体の筆算を独力で完了する方法は、どちらも計算できることの証拠として扱う。式だけに限定すると、既存の筆算入力を使って自力で解けた結果まで未確認になるため、この比較では一方式で必要な型を満たせば単元のreadinessを認める。確認できた方式を `readyMethods` に残し、筆算の達成から式だけの解答や表現間の応用まで達成したとはしない。これは全方式の習得を示す判定ではない。

同じ方式・型で異なる3問の独力正解を確認する。2桁−2桁では、式の繰下なしと筆算の繰下ありを足し合わせて単元達成にしない。図・暗算指示・補助付き戦略の結果は別欄へ残し、それだけではこの試作のreadinessを満たさない。筆算の途中ステップ、正答表示後の訂正、支援後の完了も独力の全問正解として数えない。

表現名は出題された方法の分類であり、子どもが頭の中で採用した方法の推定ではない。たとえば `add_2d1d_mental_nc` は数直線を示すので、無補助の暗算を証明しない。`strategy` も自分で方略を選べるという判定ではない。

`add_2d2d_nc`、`add_2d2d_c`、`sub_2d2d` の生成器は数値入力の式を返す。教材名だけで筆算扱いにしない。実際の予約が `inputType=hissan` に変換された場合は文脈側で `algorithm` を記録する。途中から表示形式を変えて凍結文脈と一致しなくなった回答は、元の表現の独力証拠にしない。

`sub_2d2d` の `regroup` は一の位で借りる問題、`no-regroup` は借りない問題。旧IDを分割保存せず、生成した問題の型を記録する。ほかの `default` は「その教材の既定分類」であり、全難度・全型を網羅したという意味を持たない。

## 全118教材の対応

表現: concrete=具体物、bridge=図と数・式の接続、symbol=式・記号、mental=暗算を促す表示、strategy=方略を促す表示、algorithm=筆算手順、reverse=逆向きの式。入力形式はこの列とは別に保存する。

| 旧Lv | 既存教材ID | 単元ID（math.を省略） | 表現 | 型 |
|---:|---|---|---|---|
| 0 | count_5 | count-quantity | concrete | default |
| 0 | count_dot | count-quantity | concrete | default |
| 0 | count_read | number-reading | bridge | default |
| 0 | one_to_one_match | one-to-one | concrete | default |
| 0 | same_count_match | equal-quantity | concrete | default |
| 1 | count_color | color-recognition | concrete | default |
| 1 | count_pair | visual-matching | concrete | default |
| 1 | count_shape | shape-recognition | concrete | default |
| 1 | pattern_copy | repeating-pattern | concrete | default |
| 1 | same_or_different | visual-matching | concrete | default |
| 2 | add_tiny | combine-small | concrete | default |
| 2 | compose_5 | compose-five | concrete | default |
| 2 | one_more | successor | bridge | default |
| 2 | ordinal_small | ordinal | concrete | default |
| 2 | spatial_words | spatial-relation | concrete | default |
| 3 | count_10 | count-quantity | concrete | default |
| 3 | count_back | predecessor | bridge | default |
| 3 | count_next_10 | successor | bridge | default |
| 3 | count_order | smallest-number | bridge | default |
| 3 | count_which_more | compare-quantities | concrete | default |
| 4 | big_small_compare | compare-size | concrete | default |
| 4 | count_oddone | classify-attributes | concrete | default |
| 4 | height_compare | compare-height | concrete | default |
| 4 | length_compare | compare-length | concrete | default |
| 4 | sort_by_attribute | classify-attributes | concrete | default |
| 4 | weight_compare | compare-weight | concrete | default |
| 5 | add_finger | combine-small | concrete | default |
| 5 | one_less | predecessor | bridge | default |
| 5 | share_equal | equal-sharing | concrete | default |
| 5 | two_more | two-more | bridge | default |
| 5 | which_is_empty | zero-quantity | concrete | default |
| 5 | zero_concept | zero-quantity | concrete | default |
| 6 | add_5 | combine-small | concrete | default |
| 6 | compose_10 | compose-ten | concrete | default |
| 6 | count_50 | successor | bridge | default |
| 6 | count_next_20 | successor | bridge | default |
| 6 | sub_tiny | remove-small | concrete | default |
| 6 | two_less | two-less | bridge | default |
| 7 | compare_1d | compare-one-digit | bridge | default |
| 7 | compare_2d | compare-two-digit | bridge | default |
| 7 | count_100 | successor | bridge | default |
| 7 | count_fill | sequence-gap | bridge | default |
| 8 | add_1d_1 | add-small-increments | symbol | default |
| 8 | add_1d_1_bridge | add-small-increments | bridge | default |
| 9 | add_1d_2 | add-wide-increments | symbol | default |
| 9 | add_1d_2_bridge | add-wide-increments | bridge | default |
| 10 | sub_1d1d_c | subtract-across-ten | symbol | default |
| 10 | sub_1d1d_c_bridge | subtract-across-ten | bridge | default |
| 10 | sub_1d1d_nc | subtract-within-ten | symbol | default |
| 10 | sub_1d1d_nc_bridge | subtract-within-ten | bridge | default |
| 11 | add_2d1d_c | add-two-one-regroup | symbol | default |
| 11 | add_2d1d_c_bridge | add-two-one-regroup | bridge | default |
| 11 | add_2d1d_hissan_c | add-two-one-regroup | algorithm | default |
| 11 | add_2d1d_hissan_nc | add-two-one-no-regroup | algorithm | default |
| 11 | add_2d1d_make10 | add-two-one-regroup | strategy | default |
| 11 | add_2d1d_mental_nc | add-two-one-no-regroup | mental | default |
| 11 | add_2d1d_nc | add-two-one-no-regroup | symbol | default |
| 11 | add_2d1d_nc_bridge | add-two-one-no-regroup | bridge | default |
| 11 | add_2d2d_c | add-two-two-regroup | symbol | default |
| 11 | add_2d2d_nc | add-two-two-no-regroup | symbol | default |
| 11 | sub_2d1d_back_add | subtract-two-one-regroup | reverse | default |
| 11 | sub_2d1d_c | subtract-two-one-regroup | symbol | default |
| 11 | sub_2d1d_c_bridge | subtract-two-one-regroup | bridge | default |
| 11 | sub_2d1d_diff | subtract-two-one-no-regroup | strategy | default |
| 11 | sub_2d1d_hissan_c | subtract-two-one-regroup | algorithm | default |
| 11 | sub_2d1d_hissan_nc | subtract-two-one-no-regroup | algorithm | default |
| 11 | sub_2d1d_nc | subtract-two-one-no-regroup | symbol | default |
| 11 | sub_2d1d_nc_bridge | subtract-two-one-no-regroup | bridge | default |
| 11 | sub_2d2d | subtract-two-two | symbol | no-regroup / regroup |
| 12 | add_3d3d | add-multi-digit | symbol | default |
| 12 | add_4d | add-multi-digit | symbol | default |
| 12 | sub_3d3d | subtract-multi-digit | symbol | default |
| 12 | sub_4d | subtract-multi-digit | symbol | default |
| 13 | mul_99_1 | multiplication-facts | symbol | table-1 |
| 13 | mul_99_2 | multiplication-facts | symbol | table-2 |
| 13 | mul_99_3 | multiplication-facts | symbol | table-3 |
| 13 | mul_99_4 | multiplication-facts | symbol | table-4 |
| 13 | mul_99_5 | multiplication-facts | symbol | table-5 |
| 14 | mul_99_6 | multiplication-facts | symbol | table-6 |
| 14 | mul_99_7 | multiplication-facts | symbol | table-7 |
| 14 | mul_99_8 | multiplication-facts | symbol | table-8 |
| 14 | mul_99_9 | multiplication-facts | symbol | table-9 |
| 14 | mul_99_rand | multiplication-facts | symbol | table-1 / table-2 / table-3 / table-4 / table-5 / table-6 / table-7 / table-8 / table-9 |
| 15 | mul_2d1d | multiply-one-digit | symbol | default |
| 15 | mul_3d1d | multiply-one-digit | symbol | default |
| 16 | div_2d1d_exact | divide-one-digit-exact | symbol | default |
| 16 | div_99_rev | divide-facts | symbol | default |
| 17 | div_rem_q1 | divide-remainder | symbol | default |
| 17 | div_rem_q2 | divide-remainder | symbol | default |
| 18 | div_2d2d_exact | divide-two-digit-exact | symbol | quotient-one / quotient-many |
| 18 | div_3d1d_exact | divide-one-digit-exact | symbol | default |
| 18 | div_3d2d_exact | divide-two-digit-exact | symbol | default |
| 18 | mul_2d2d | multiply-two-digit | symbol | default |
| 18 | mul_3d2d | multiply-two-digit | symbol | default |
| 19 | dec_add | decimal-add | symbol | default |
| 19 | dec_sub | decimal-subtract | symbol | default |
| 20 | dec_div_dec | decimal-divide-decimal | symbol | default |
| 20 | dec_div_int | decimal-divide-integer | symbol | default |
| 20 | dec_mul_dec | decimal-multiply-decimal | symbol | default |
| 20 | dec_mul_int | decimal-multiply-integer | symbol | default |
| 21 | frac_add_same | fraction-add-same | symbol | default |
| 21 | frac_sub_same | fraction-subtract-same | symbol | default |
| 22 | frac_add_diff | fraction-add-different | symbol | default |
| 22 | frac_mixed | fraction-add-mixed | symbol | default |
| 22 | frac_mixed_sub | fraction-subtract-mixed | symbol | default |
| 22 | frac_sub_diff | fraction-subtract-different | symbol | default |
| 23 | frac_mul_frac | fraction-multiply-fraction | symbol | default |
| 23 | frac_mul_int | fraction-multiply-integer | symbol | default |
| 24 | frac_div_frac | fraction-divide-fraction | symbol | default |
| 24 | frac_div_int | fraction-divide-integer | symbol | default |
| 24 | scale_10x | scale-powers-ten | symbol | times-ten / times-hundred / divide-ten |
| 25 | dec_compare | decimal-compare | symbol | default |
| 25 | large_number_unit | large-number-units | symbol | man / oku |
| 26 | frac_compare | fraction-compare | symbol | same-denominator / same-numerator / equivalent / different |
| 26 | percent_basic | percent | symbol | percent / part |
| 27 | average_basic | average | symbol | integer / decimal |
| 27 | ratio_basic | ratio | symbol | default |
| 28 | speed_basic | speed | symbol | distance / speed / time |

### 追加の基礎9教材（旧118教材の所属とは別）

| 開始Lv | 教材ID | 単元ID（math.を省略） | 表現 | 型 |
|---:|---|---|---|---|
| 11 | foundation_tens | place-value-tens | bridge | default |
| 12 | foundation_expanded | place-value-expanded | bridge | default |
| 19 | foundation_decimal | decimal-place-value | bridge | default |
| 21 | foundation_fraction | fraction-quantity | bridge | default |
| 21 | foundation_equivalence | fraction-equivalence | bridge | default |
| 22 | foundation_mixed | fraction-mixed-meaning | bridge | default |
| 13 | foundation_groups | equal-groups | bridge | default |
| 16 | foundation_division | division-meaning | bridge | default |
| 26 | foundation_rate | unit-rate | bridge | default |

## 前提と推奨順序

必須前提は概念・解答要求に必要な土台を示す設計上の関係。推奨は練習をつなぐ候補であり、唯一の学び順や因果関係の証明ではない。いずれも今回の通常学習には適用しない。特に未実装の前提を関門にすると既存ユーザーが進めなくなるため、比較結果では「前提未確認」と単元自体の実績を分ける。

色名・数字のかな読み・形・空間・測定を、計算全体の前提にしない。小数・分数の比較をその四則計算の後でなければ扱えないとは定義しない。前提の参照切れと、必須・推奨を合わせた循環はテストで検出する。

| 単元ID（math.を省略） | 内容 | 状態 | 必須前提（math.を省略） | 推奨（math.を省略） |
|---|---|---|---|---|
| count-quantity | ものの個数を数える | existing | — | — |
| number-reading | 数字と日本語の読みを結ぶ | existing | — | — |
| one-to-one | 一対一に対応させる | existing | — | — |
| equal-quantity | 同じ個数のまとまりを見つける | existing | — | — |
| shape-recognition | 形と形の名前を結ぶ | existing | — | — |
| color-recognition | 色の名前を選ぶ | existing | — | — |
| visual-matching | 同じもの・違うものを見分ける | existing | — | — |
| repeating-pattern | 繰り返しの続きを見つける | existing | — | — |
| successor | 次の数・一つ多い数 | existing | — | count-quantity |
| ordinal | 並びの何番目かを見つける | existing | — | — |
| spatial-relation | 位置関係を読み取る | existing | — | — |
| compose-five | 5をつくる残りの数 | existing | — | count-quantity |
| combine-small | 小さいまとまりを合わせる | existing | — | count-quantity |
| predecessor | 前の数・一つ少ない数 | existing | — | successor |
| smallest-number | 示された数から最小を選ぶ | existing | — | — |
| compare-quantities | 二つのまとまりの多さを比べる | existing | — | — |
| compare-length | 長さを比べる | existing | — | — |
| compare-height | 高さを比べる | existing | — | — |
| compare-size | 見た目の大きさを比べる | existing | — | — |
| compare-weight | 重さを比べる | existing | — | — |
| classify-attributes | 同じ属性・仲間外れを見つける | existing | — | — |
| two-more | 二つ多い数 | existing | — | successor |
| zero-quantity | 空と0を結ぶ | existing | — | — |
| equal-sharing | ものを等しく分ける | existing | — | one-to-one、count-quantity |
| compose-ten | 10をつくる残りの数 | existing | — | compose-five、count-quantity |
| two-less | 二つ少ない数 | existing | — | predecessor |
| remove-small | 小さいまとまりから取り去る | existing | — | count-quantity、zero-quantity |
| sequence-gap | 連続する数の穴を埋める | existing | — | successor、predecessor |
| compare-one-digit | 1桁の数を不等号で比べる | existing | — | compare-quantities、smallest-number |
| compare-two-digit | 2桁の数を不等号で比べる | existing | place-value-tens | compare-one-digit |
| add-small-increments | 小さい数を足す式 | existing | — | combine-small、successor |
| add-wide-increments | 大きめの数を足す式 | existing | — | add-small-increments、compose-ten |
| subtract-within-ten | 10以内の引き算の式 | existing | — | remove-small、zero-quantity |
| subtract-across-ten | 10をまたぐ引き算の式 | existing | — | subtract-within-ten、compose-ten |
| add-two-one-no-regroup | 2桁+1桁・繰上なし | existing | place-value-tens | add-small-increments、add-wide-increments |
| add-two-one-regroup | 2桁+1桁・繰上あり | existing | place-value-tens | add-two-one-no-regroup、compose-ten |
| subtract-two-one-no-regroup | 2桁−1桁・繰下なし | existing | place-value-tens | subtract-within-ten |
| subtract-two-one-regroup | 2桁−1桁・繰下あり | existing | place-value-tens | subtract-two-one-no-regroup、subtract-across-ten |
| add-two-two-no-regroup | 2桁+2桁・繰上なし | existing | place-value-tens | add-two-one-no-regroup |
| add-two-two-regroup | 2桁+2桁・繰上あり | existing | place-value-tens | add-two-two-no-regroup、add-two-one-regroup |
| subtract-two-two | 2桁−2桁 | existing | place-value-tens | subtract-two-one-no-regroup、subtract-two-one-regroup |
| add-multi-digit | 3桁・4桁の足し算 | existing | place-value-expanded | add-two-two-regroup |
| subtract-multi-digit | 3桁・4桁の引き算 | existing | place-value-expanded | subtract-two-two |
| multiplication-facts | 九九の積を求める | existing | equal-groups | combine-small |
| multiply-one-digit | 複数桁に1桁を掛ける | existing | place-value-expanded、equal-groups | multiplication-facts、add-multi-digit |
| divide-facts | 九九範囲の割り算 | existing | division-meaning | multiplication-facts |
| divide-one-digit-exact | 1桁で割る割り切れる計算 | existing | division-meaning、place-value-expanded | divide-facts、multiply-one-digit |
| divide-remainder | 商と余りを求める | existing | division-meaning | divide-one-digit-exact |
| multiply-two-digit | 複数桁に2桁を掛ける | existing | place-value-expanded、equal-groups | multiply-one-digit、add-multi-digit |
| divide-two-digit-exact | 2桁で割る割り切れる計算 | existing | division-meaning、place-value-expanded | divide-one-digit-exact、multiply-two-digit |
| decimal-add | 小数を足す | existing | decimal-place-value | decimal-compare、add-two-two-regroup |
| decimal-subtract | 小数を引く | existing | decimal-place-value | decimal-compare、subtract-two-two |
| decimal-multiply-integer | 小数に整数を掛ける | existing | decimal-place-value | multiply-one-digit、decimal-compare |
| decimal-divide-integer | 小数を整数で割る | existing | decimal-place-value、division-meaning | divide-one-digit-exact、decimal-compare |
| decimal-multiply-decimal | 小数に小数を掛ける | existing | decimal-place-value | decimal-multiply-integer、scale-powers-ten |
| decimal-divide-decimal | 小数を小数で割る | existing | decimal-place-value、division-meaning | decimal-divide-integer、scale-powers-ten |
| fraction-add-same | 同分母の分数を足す | existing | fraction-quantity、fraction-equivalence | fraction-compare |
| fraction-subtract-same | 同分母の分数を引く | existing | fraction-quantity、fraction-equivalence | fraction-compare |
| fraction-add-different | 異分母の分数を足す | existing | fraction-quantity、fraction-equivalence | fraction-add-same |
| fraction-subtract-different | 異分母の分数を引く | existing | fraction-quantity、fraction-equivalence | fraction-subtract-same |
| fraction-add-mixed | 同分母の帯分数を足す | existing | fraction-mixed-meaning、fraction-equivalence | fraction-add-same |
| fraction-subtract-mixed | 同分母の帯分数を引く | existing | fraction-mixed-meaning、fraction-equivalence | fraction-subtract-same |
| fraction-multiply-integer | 分数に整数を掛ける | existing | fraction-quantity、fraction-equivalence | multiplication-facts |
| fraction-multiply-fraction | 分数に分数を掛ける | existing | fraction-quantity、fraction-equivalence | fraction-multiply-integer |
| fraction-divide-integer | 分数を整数で割る | existing | fraction-quantity、fraction-equivalence、division-meaning | fraction-multiply-integer |
| fraction-divide-fraction | 分数を分数で割る | existing | fraction-quantity、fraction-equivalence、division-meaning | fraction-divide-integer、fraction-multiply-fraction |
| scale-powers-ten | 10倍・100倍・10分の1 | existing | place-value-expanded、decimal-place-value | — |
| large-number-units | 万・億の単位で数を読む | existing | place-value-expanded | — |
| decimal-compare | 小数の大小と等しさ | existing | decimal-place-value | compare-two-digit |
| fraction-compare | 分数の大小と等しさ | existing | fraction-quantity、fraction-equivalence | — |
| percent | 部分・全体・百分率の関係 | existing | unit-rate | decimal-multiply-integer、decimal-divide-integer |
| average | 複数の値の平均 | existing | division-meaning | add-multi-digit、divide-one-digit-exact |
| ratio | 等しい比の穴を埋める | existing | unit-rate | multiplication-facts、divide-facts |
| speed | 速さ・時間・距離の関係 | existing | unit-rate | multiply-one-digit、divide-one-digit-exact |
| place-value-tens | 10のまとまりと1の位 | existing | — | compose-ten、count-quantity |
| place-value-expanded | 100以上の位と位ごとの再構成 | existing | place-value-tens | — |
| decimal-place-value | 1を10等分した量と小数の位 | existing | place-value-tens | — |
| fraction-quantity | 等分した1と分数の量 | existing | — | equal-sharing |
| fraction-equivalence | 等しい分数・約分・通分の意味 | existing | fraction-quantity | multiplication-facts、divide-facts |
| fraction-mixed-meaning | 整数と分数を合わせた量 | existing | fraction-quantity | — |
| equal-groups | 同じ数ずつの集まりと掛け算 | existing | — | count-quantity、combine-small |
| division-meaning | 等分除・包含除・余りの量 | existing | — | equal-sharing、equal-groups |
| unit-rate | 1あたりの量と二量の対応 | existing | division-meaning | equal-groups |

## 教材から読み取れる範囲と不足

- **ものの個数を数える（count-quantity）**: 5枠・ドット・10枠と選択/数値入力を含む。各教材の数範囲と入力差は保持する。
- **数字と日本語の読みを結ぶ（number-reading）**: 数字・個数図からかなの読みを選ぶ。数量理解や算術全体の必須前提にしない。
- **色の名前を選ぶ（color-recognition）**: 色識別とかなの語彙が関わる独立した活動。算術の前提にしない。
- **次の数・一つ多い数（successor）**: count_50/count_100も大量のものを数える問題ではなく、次の数を補う問題。数範囲は旧IDごとに異なる。
- **示された数から最小を選ぶ（smallest-number）**: 現行問題は最小値の選択。数列全体を並べ替える能力までは確認していない。
- **小さい数を足す式（add-small-increments）**: 現行の+1〜+3は10をまたぐ場合もある。「繰上なし」という単元に分類しない。
- **大きめの数を足す式（add-wide-increments）**: 現行導入は繰上なし・10づくり・繰上ありを含む。旧IDの達成を繰上あり全般の達成にしない。
- **10をまたぐ引き算の式（subtract-across-ten）**: 旧IDは1d1dだが繰下ありの主範囲は11〜18から1桁を引く。導入の易しい型も同IDに含む。
- **2桁+1桁・繰上なし（add-two-one-no-regroup）**: mental教材には数直線の補助がある。モードの記録は解法の自力選択や無補助暗算の証明ではない。
- **2桁+2桁・繰上あり（add-two-two-regroup）**: 1の位または10の位の繰上を含む。v1のdefaultは両方の型の網羅を保証しない。
- **2桁−2桁（subtract-two-two）**: 一の位を借りるかは生成した問題から区別し、二つの型の証拠を混ぜない。
- **九九の積を求める（multiplication-facts）**: 段は概念の別単元ではなく練習範囲。後続評価では各因子・積の被覆を確認し、一つの段で全体達成にしない。
- **九九範囲の割り算（divide-facts）**: revというIDでも問題は a ÷ b = の式。掛け算の穴埋めによる逆向き表現ではない。
- **商と余りを求める（divide-remainder）**: 商1桁/2桁の範囲と複数欄入力を保持。余りの量はfoundation_divisionの追加導入で直接扱う。
- **同分母の分数を足す（fraction-add-same）**: 現行解答には約分が必要。分母の意味だけの達成と分けて扱う。
- **10倍・100倍・10分の1（scale-powers-ten）**: 整数の×10/×100と小数にもなる÷10を同IDに含む。v2はtimes-ten / times-hundred / divide-tenを内容から検証する。旧defaultは型別の達成を証明しない。
- **分数の大小と等しさ（fraction-compare）**: 同分母、同分子、等値、分子分母とも異なる不等値の4型を含む。分数の計算完了を比較の前提にしない。
- **10のまとまりと1の位（place-value-tens）**: 10と1への分解・再構成を追加の短い導入で直接確認する。
- **1を10等分した量と小数の位（decimal-place-value）**: 等分図の量・小数比較・10倍を追加の短い導入で直接確認する。

基礎9教材は直接答える短い導入として追加した。既存の計算図、年齢からの開始レベル、初期のretiredや旧ログの正答合計を、基礎単元の習得証拠に読み替えない。数直線・対応表・全般的な方略転移は別の後続設計とする。

v2では九九各段、2桁÷2桁の商1/複数、分数比較4型、10倍/100倍/10分の1、割合・速さの求める量、平均の整数/小数、万/億を区別する。後続の型別設計が必要な例は、2桁足し算の繰上の位、連続する借り、帯分数の繰上/繰下、小数の位数。v1の `default` の証拠だけから、これらを区別した習得を認定しない。

この分割は既存生成器を正しく記述し、Lv11を比較できる状態にする初期設計である。全単元数や順序が最適と確認された段階ではない。
