# 02 算数仕様書

算数コンテンツの定義仕様書

---

## 0. 目次

- [1. 基本方針](#1-基本方針)
- [1.3 学び方の戦略](#13-学び方の戦略)
- [1.4 領域別ロードマップ](#14-領域別ロードマップ)
- [1.5 次に増やすスキルの指針](#15-次に増やすスキルの指針)
- [1.6 Lv13-18 教材改善プラン](#16-lv13-18-教材改善プラン)
- [1.7 共通で足したい出題タイプ](#17-共通で足したい出題タイプ)
- [1.8 Lv19-28 教材改善プラン](#18-lv19-28-教材改善プラン)
- [1.9 筆算と復習の改善プラン](#19-筆算と復習の改善プラン)
- [2. スキル採用判定](#2-スキル採用判定)
- [3. 採用スキル一覧（レベル順）](#3-採用スキル一覧レベル順)
- [4. レベル定義](#4-レベル定義)
- [5. 入力UI仕様](#5-入力ui仕様)
- [6. データ構造](#6-データ構造)

---

## 0. この仕様書の位置づけ

### 0.1 役割

このドキュメントは、算数の**コンテンツ定義**および**基本UI仕様**を定義する。
詳細な問題生成ルールは [04_math_problems.md](./04_math_problems.md) を参照。

| 定義する内容 | 定義しない内容（親を参照） |
|---|---|
| 採用するスキル一覧 | 解放条件（正答率85%） |
| レベルとスキルの対応 | **ステータス管理（Active/Retired）** |
| 入力仕様（UI） | 記憶強度アルゴリズム |
| データ構造（算数固有） | ユーザーデータ全体 |

### 0.2 関連仕様書

| No. | ファイル名 | 参照する内容 |
|---|---|---|
| 01 | 01_app_spec.md | 解放条件、**ステータス管理**、忘却曲線、共通UI |
| 04 | 04_math_problems.md | 詳細な問題生成ルール |

---

## 1. 基本方針

### 1.1 コンセプト

**公文式のように「計算力」に特化**

- 四則演算、分数、小数の計算スキルを段階的に習得
- 公文で扱う計算領域（A-F相当）は最低限カバーする
- 図形・文章題・グラフは扱わない
- 「考える」より「手が動く」トレーニング

### 1.2 対象範囲

| 項目 | 内容 |
|---|---|
| 対象学年 | 未就学児〜小学6年 |
| スキル数 | 全118スキル（29レベルに分類） |
| 出題形式 | 数字入力（テンキー）・選択式 |

### 1.3 学び方の戦略

同じ計算内容でも、**表現を行き来する力** と **解き方を選ぶ力** を育てる。

| 段階 | 役割 | 典型表現 | 身につけたいこと |
|---|---|---|---|
| Concrete | 具体物で理解する | 絵、物、まとまり | 数の意味、増える・減る実感 |
| Bridge | 具体物と式をつなぐ | 絵 + 式 | 目で見た変化を式に写す |
| Symbol | 記号だけで処理する | `8 + 7 =` | 抽象的に計算する |
| Strategy | 考え方を選ぶ | 10をつくる、差で考える、分ける | 複数の解法を使い分ける |
| Mental | 頭の中で処理する | 暗算、途中式なし | 速さと見通し |
| Algorithm | 手順で処理する | 筆算、標準アルゴリズム | 正確さと位の整列 |
| Reverse | 逆から考える | 引き算を足し算で考える、割り算を掛け算で考える | 関係理解と柔軟性 |

方針:

- 初学では `Concrete` と `Bridge` を厚くする。
- 定着期では `Symbol` と `Strategy` を増やす。
- 桁数が増えたら `Mental` と `Algorithm` を分けて育てる。
- 同じ答えに複数の解き方がある内容は、別スキルとして分けてもよい。

### 1.4 領域別ロードマップ

| 領域 | 入口 | 橋渡し | 戦略 | 暗算 | 筆算・手順 |
|---|---|---|---|---|---|
| 足し算 | 具体物をあわせる | 絵 + 式 | 5をつくる、10をつくる、分けて足す | 2桁+1桁、2桁+2桁 | 位をそろえて筆算 |
| 引き算 | 取る・残る | 絵 + 式 | 差で考える、足し算に戻す、10をまたぐ | 2桁-1桁、2桁-2桁 | くり下がり筆算 |
| 掛け算 | 同じ数ずつの集まり | 配列、くり返し足し算 | 分配法則、まとまりで考える | 九九、2桁×1桁の一部 | かけ算筆算 |
| 割り算 | 同じに分ける、何こずつ | 図、配列、逆算 | 掛け算との往復、引き算のくり返し | 割り切れ、余りの見通し | わり算筆算 |
| 小数 | 位取り、数直線 | 10倍100倍、整数との対応 | 位ごとの処理 | 小数の加減の一部 | 小数の筆算 |
| 分数 | 部分、数直線 | 等しい分数、図 + 式 | 通分、約分、比較 | 単純な同分母処理 | 標準手順の定着 |
| 割合・比・速さ | 表、テープ図 | 比例表、2量の対応 | もとの量・くらべる量・割合の往復 | 単位量あたりの見通し | 定型関係で処理 |

### 1.5 次に増やすスキルの指針

以下は**次の実装候補**。現行スキルを置き換えるのではなく、学び方を増やすための拡張とする。

| レベル帯 | ねらい | 代表スキル案 | 備考 |
|---|---|---|---|
| Lv11 前後 | 2桁どうしの位取りを見える化 | `add_2d2d_place_nc`, `sub_2d2d_place_nc` | 10のまとまり、位ごとの増減 |
| Lv11-12 | 2桁どうしの暗算戦略 | `add_2d2d_make10`, `sub_2d2d_diff`, `sub_2d2d_back_add` | 2けた同士でも分けて考える |
| Lv12-13 | 2桁どうしの筆算導入 | `add_2d2d_hissan_nc`, `sub_2d2d_hissan_basic`, `add_2d2d_hissan_c` | 2桁+1桁 / 2桁-1桁 の筆算導入は実装済み |
| Lv13-15 | 九九前後の橋渡し | `mul_group_intro`, `mul_array_intro`, `mul_skip_count` | 九九暗記だけで終わらせない |
| Lv16-18 | 割り算の表現往復 | `div_group_intro`, `div_measure_intro`, `div_inverse_intro` | 分ける/いくつずつ/掛け算逆算 |
| Lv19-24 | 小数・分数の土台強化 | `dec_place_value`, `frac_number_line`, `frac_equiv_visual`, `frac_compare_line` | ルール暗記だけにしない |
| Lv25 以降 | 応用の表と関係 | `percent_table_basic`, `ratio_table_basic`, `speed_table_basic` | 割合・比・速さの共通構造を作る |

実装ルール:

- `Mental` 系と `Algorithm` 系は別スキルに分ける。
- `Bridge` 系は既存スキルの前に置くか、同レベルで併置する。
- 同一内容でも「絵」「式」「表」「数直線」は別学習として扱ってよい。
- 既存ユーザーの進度を壊さないため、途中レベルの大規模な並び替えより、追加レベルまたは併置を優先する。

### 1.6 Lv13-18 教材改善プラン

現状の Lv13-18 は、`九九暗記 -> 数字だけの掛け算 -> 数字だけの割り算` へ進む比率が高い。
教材としては、**同じ意味を別表現で往復する段階** と **暗算/手順を分ける段階** を足したほうが伸びやすい。

前提:

- 既存の `mul_99_*`, `mul_2d1d`, `div_99_rev`, `div_rem_q1` などは残す。
- 追加スキルは、既存レベルの前後に差し込むか、補助レベルとして併置する。
- 1問ごとのランダム性より、`導入 -> 変換 -> 定着` の小さな束を意識する。

| 入れる位置 | 追加したいスキル | 段階 | ねらい | 対応する現行スキル |
|---|---|---|---|---|
| Lv13 の前 | `mul_group_intro` | Concrete | 同じ数ずつの集まりを「ぜんぶでいくつ」として理解する | `mul_99_1` 〜 `mul_99_5` |
| Lv13 の前 | `mul_skip_count` | Bridge / Mental | 2とび、3とびを掛け算とつなぐ | `mul_99_2` 〜 `mul_99_5` |
| Lv13-14 の間 | `mul_array_intro` | Bridge | 行と列の見え方から `a × b` を読む | `mul_99_6` 〜 `mul_99_9` |
| Lv13-14 の間 | `mul_formula_match` | Reverse | 絵・配列・式を相互変換する | `mul_99_rand` |
| Lv15 の前 | `mul_2d1d_mental_split` | Strategy / Mental | `(20 + 3) × 4` のように分けて考える | `mul_2d1d` |
| Lv15 の前 | `mul_2d1d_algorithm` | Algorithm | 位をそろえた標準手順に慣れる | `mul_2d1d`, `mul_3d1d` |
| Lv16 の前 | `div_group_intro` | Concrete | 「同じに分ける」割り算を絵で理解する | `div_99_rev`, `div_2d1d_exact` |
| Lv16 の前 | `div_measure_intro` | Concrete / Bridge | 「何こずつ取れるか」の割り算を理解する | `div_99_rev`, `div_2d1d_exact` |
| Lv16-17 の間 | `div_inverse_intro` | Reverse | `□ × 4 = 20` と `20 ÷ 4 = □` を往復する | `div_99_rev` |
| Lv17 の前 | `div_remainder_visual` | Bridge | 余りを「配れなかった残り」として見る | `div_rem_q1`, `div_rem_q2` |
| Lv18 の前 | `div_2d1d_mental` | Strategy / Mental | 九九を使って商を見通す | `div_2d1d_exact`, `div_3d1d_exact` |
| Lv18 の前 | `div_2d1d_algorithm` | Algorithm | 標準手順または部分商で割り算を処理する | `div_2d2d_exact`, `div_3d1d_exact`, `div_3d2d_exact` |

推奨の並び:

1. `Concrete`: `mul_group_intro`, `div_group_intro`
2. `Bridge`: `mul_skip_count`, `mul_array_intro`, `div_measure_intro`, `div_remainder_visual`
3. `Reverse`: `mul_formula_match`, `div_inverse_intro`
4. `Mental`: `mul_2d1d_mental_split`, `div_2d1d_mental`
5. `Algorithm`: `mul_2d1d_algorithm`, `div_2d1d_algorithm`

各スキルの最低要件:

- `mul_group_intro`: 1問の中で「同じ数ずつ」を複数グループで見せる。
- `mul_skip_count`: 数列と集まりの両方を使い、`2,4,6,8` と `2 × 4` をつなぐ。
- `mul_array_intro`: 行と列の向きを変えても同じ数になる経験を入れる。
- `mul_formula_match`: `絵 -> 式` と `式 -> 絵` の両方向を含む。
- `mul_2d1d_mental_split`: `20 × 3` と `4 × 3` に分ける型を固定する。
- `mul_2d1d_algorithm`: 途中の位と部分積が見える UI を前提にする。
- `div_group_intro`: 何人に同じ数ずつ配るかを絵で出す。
- `div_measure_intro`: 「2こずつ取ると何回」で、等分と区別して出す。
- `div_inverse_intro`: 掛け算の空欄補充と割り算を同じ答えで往復させる。
- `div_remainder_visual`: 余りだけを問う問題も混ぜる。
- `div_2d1d_mental`: 近い九九をまず選ばせる。
- `div_2d1d_algorithm`: 商を立てる位置と引く処理を分けて見せる。

### 1.7 共通で足したい出題タイプ

スキル追加と同じくらい、**問い方の種類** を増やすことが教材として重要。

| 出題タイプ | 例 | ねらい | 入れたい領域 |
|---|---|---|---|
| 表現マッチ | `この絵に あう しきは？` | 絵・式・数直線の変換力 | 足し算、掛け算、割り算、分数 |
| 解法選択 | `このもんだいは あんざん？ ひっさん？` | 方法選択の判断 | 2桁加減算、2桁×1桁、2桁÷1桁 |
| 誤答診断 | `どこで まちがえた？` | 手順理解と見直し力 | 繰り上がり、繰り下がり、筆算、わり算 |
| 逆向き問題 | `□ に はいる かずは？` | 演算の関係理解 | 引き算、割り算、割合 |
| 余りだけ問う | `いくつ あまる？` | 余りの意味を独立して学ぶ | 割り算 |
| ミニレッスン束 | `絵 -> 式 -> 方法選択` の3問連続 | 同じ内容を別表現で定着 | 全領域 |

ミニレッスン束の基本形:

1. 1問目は `Concrete` または `Bridge`
2. 2問目は `Symbol` または `Reverse`
3. 3問目は `Mental` または `Algorithm`

これにより、`答えを出せた` だけで終わらず、`別の見え方でも同じ内容だと分かる` ところまで育てる。

注:

- これらの束を **いつ差し込むか** の親ロジックは [01_app_spec.md](./01_app_spec.md) の 5.4 を正とする。

### 1.8 Lv19-28 教材改善プラン

Lv19 以降は、計算範囲そのものよりも、**位・大きさ・関係を見失わない土台** が重要になる。
現状は `小数の計算` `分数の計算` `割合・比・速さの式処理` に寄りやすいので、先に `数直線` `位取り` `表` を増やしたい。

| 入れる位置 | 追加したいスキル | 段階 | ねらい | 対応する現行スキル |
|---|---|---|---|---|
| Lv19 の前 | `dec_place_value` | Concrete / Bridge | 0.1, 0.01 の位の意味を見える化する | `dec_add`, `dec_sub`, `dec_compare` |
| Lv19 の前 | `dec_number_line` | Concrete / Bridge | 小数を数直線上の位置で比べる | `dec_compare`, `dec_add`, `dec_sub` |
| Lv19-20 の間 | `dec_point_align_add`, `dec_point_align_sub` | Algorithm | 小数点をそろえる意味を手順として学ぶ | `dec_add`, `dec_sub` |
| Lv20 の前 | `dec_scale_10_visual` | Bridge / Strategy | 10倍・100倍と小数点移動の関係を理解する | `scale_10x`, `dec_mul_int`, `dec_div_int` |
| Lv20 の前 | `dec_mul_place_reason`, `dec_div_place_reason` | Strategy | 小数の掛け割りで桁がどう動くかを予想する | `dec_mul_dec`, `dec_div_dec` |
| Lv21 の前 | `frac_part_whole` | Concrete | 1つの全体に対する部分として分数を見る | `frac_add_same`, `frac_sub_same` |
| Lv21 の前 | `frac_number_line` | Concrete / Bridge | 分数を量として並べる | `frac_compare`, `frac_add_same`, `frac_sub_same` |
| Lv21-22 の間 | `frac_equiv_visual` | Bridge | 等しい分数を図で理解する | `frac_add_diff`, `frac_sub_diff`, `frac_compare` |
| Lv21-22 の間 | `frac_compare_line` | Strategy | 通分の前に、数直線や面積図で大小を比べる | `frac_compare` |
| Lv22 の前 | `frac_common_denominator_bridge` | Bridge / Algorithm | 通分の意味を「同じ大きさの切り方」に変換する | `frac_add_diff`, `frac_sub_diff` |
| Lv23-24 の前 | `frac_of_int_visual` | Concrete / Bridge | `3/4 の 8` を図で理解する | `frac_mul_int`, `frac_mul_frac` |
| Lv23-24 の前 | `frac_div_inverse` | Reverse | 分数の割り算を逆数ルールだけでなく意味でつなぐ | `frac_div_int`, `frac_div_frac` |
| Lv25-26 の前 | `percent_table_basic` | Bridge | もとの量・くらべる量・割合を表でそろえる | `percent_basic` |
| Lv27 の前 | `ratio_table_basic` | Bridge | 比を対応表でそろえて考える | `ratio_basic` |
| Lv28 の前 | `speed_table_basic` | Bridge | 速さ・時間・道のりを表で往復する | `speed_basic` |

推奨の並び:

1. 小数は `dec_place_value -> dec_number_line -> dec_point_align_* -> dec_scale_10_visual`
2. 分数は `frac_part_whole -> frac_number_line -> frac_equiv_visual -> frac_common_denominator_bridge`
3. 応用は `percent_table_basic -> ratio_table_basic -> speed_table_basic`

各スキルの最低要件:

- `dec_place_value`: 1.2 と 1.02 を並べ、位の違いが見える表示を含む。
- `dec_number_line`: 0 と 1 の間だけでなく、1 をまたぐ数直線も扱う。
- `dec_point_align_add` / `dec_point_align_sub`: 小数点をそろえる前後の見え方を出す。
- `dec_scale_10_visual`: `0.4 × 10`, `4 ÷ 10`, `40 ÷ 100` を同じ系列で扱う。
- `dec_mul_place_reason` / `dec_div_place_reason`: 答えの桁感を先に予想させる問題を混ぜる。
- `frac_part_whole`: 同じ形でも全体が違えば分数が変わる例を含める。
- `frac_number_line`: `1/2`, `3/2`, `5/4` のように 1 をまたぐ分数も含む。
- `frac_equiv_visual`: `1/2 = 2/4 = 4/8` を図で往復する。
- `frac_common_denominator_bridge`: 通分後の「同じ単位で比べている」ことが見える表示を持つ。
- `frac_of_int_visual`: 面積図またはテープ図で「何分のいくつ」を表す。
- `frac_div_inverse`: `1/2 ÷ 1/4` を「1/4 が何こ入るか」で出す。
- `percent_table_basic`, `ratio_table_basic`, `speed_table_basic`: 必ず 2量をそろえる表を先に見せる。

### 1.9 筆算と復習の改善プラン

いまの筆算は「答えが合うか」を見る比率が高い。
教材としては、**途中手順を理解する問題** と **まちがい方に応じた復習** を別に持ったほうが強い。

| 種類 | 追加したいスキル / 仕組み | ねらい | 対応する現行スキル |
|---|---|---|---|
| 筆算手順 | `add_carry_step` | くり上がりを書く位置を理解する | `add_2d2d_c`, `add_3d3d` |
| 筆算手順 | `sub_borrow_step` | くり下がりで 10 をくずす意味を理解する | `sub_2d1d_c`, `sub_2d2d`, `sub_3d3d` |
| 筆算手順 | `mul_partial_product_step` | 部分積と位のずれを理解する | `mul_2d1d`, `mul_2d2d`, `mul_3d2d` |
| 筆算手順 | `div_quotient_position_step` | 商を立てる位置と引く順序を理解する | `div_2d1d_exact`, `div_2d2d_exact`, `div_3d2d_exact` |
| 解法選択 | `calc_method_choice` | 暗算向きか筆算向きかを選ぶ | 2桁以上の加減乗除 |
| 誤答診断 | `calc_error_check` | 典型的な誤りを見抜く | くり上がり、くり下がり、筆算全般 |
| 復習導線 | `representation_retry` | 間違えた内容を別表現で復習する | 全領域 |
| 復習導線 | `mini_lesson_review` | 同じ概念を 3問束で復習する | 全領域 |

復習ルール:

- 同じ skillId の再出題だけでなく、対応する `Bridge` `Reverse` `Algorithm` スキルへ横に広げてよい。
- `暗算で失敗した -> 位取りを見せる`
- `筆算で失敗した -> 途中手順を問う`
- `比較で失敗した -> 数直線や表へ戻す`
- `割合で失敗した -> 表スキルへ戻す`

ミニレッスン復習の例:

1. `frac_compare` で失敗したら `frac_number_line`
2. 次に `frac_equiv_visual`
3. 最後に `frac_compare` へ戻す

この構成にすると、単なる再挑戦ではなく「理解が足りなかった場所」まで戻せる。

注:

- `representation_retry` や `mini_lesson_review` の発火条件・混入比率は [01_app_spec.md](./01_app_spec.md) の 5.4-5.5 を参照する。

---

## 2. スキル採用判定

（詳細は概念レベルのため省略せず残すが、後方参照のため簡略化してもよい。ここでは現状維持。）

（中略：採用・不採用の議論ログはそのまま保持）

---

## 3. 採用スキル一覧（レベル順）

各スキルは正答率85%で次が解放される（01仕様書参照）。
レベル順に習得することを想定している。

| レベル | No. | カテゴリ | スキル名 | ID | inputType |
|---:|---:|---|---|---|---|
| 0 | 1 | プリスクール | 5まで数える | count_5 | choice |
| 0 | 2 | プリスクール | ドットを数える | count_dot | choice |
| 0 | 3 | プリスクール | 数字を読む | count_read | choice |
| 0 | 4 | プリスクール | 1対1対応 | one_to_one_match | choice |
| 0 | 5 | プリスクール | 同数マッチ | same_count_match | choice |
| 1 | 6 | プリスクール | 形の認識 | count_shape | choice |
| 1 | 7 | プリスクール | 色の認識 | count_color | choice |
| 1 | 8 | プリスクール | ペアマッチ | count_pair | choice |
| 1 | 9 | プリスクール | 同じか違うか | same_or_different | choice |
| 1 | 10 | プリスクール | パターンコピー | pattern_copy | choice |
| 2 | 11 | プリスクール | 1つ多い | one_more | choice |
| 2 | 12 | プリスクール | 順序（小） | ordinal_small | choice |
| 2 | 13 | プリスクール | 空間ことば | spatial_words | choice |
| 2 | 14 | プリスクール | 5の合成 | compose_5 | single |
| 2 | 15 | プリスクール | ちいさい足し算 | add_tiny | single |
| 3 | 16 | プリスクール | 10まで数える | count_10 | single |
| 3 | 17 | プリスクール | 次の数（10まで） | count_next_10 | single |
| 3 | 18 | プリスクール | 逆順カウント | count_back | single |
| 3 | 19 | プリスクール | 順番並べ | count_order | choice |
| 3 | 20 | プリスクール | どっちが多い | count_which_more | choice |
| 4 | 21 | プリスクール | 長さ比較 | length_compare | choice |
| 4 | 22 | プリスクール | 高さ比較 | height_compare | choice |
| 4 | 23 | プリスクール | 大きさ比較 | big_small_compare | choice |
| 4 | 24 | プリスクール | 重さ比較 | weight_compare | choice |
| 4 | 25 | プリスクール | 属性ソート | sort_by_attribute | choice |
| 4 | 26 | プリスクール | 仲間はずれ | count_oddone | choice |
| 5 | 27 | プリスクール | 1つ少ない | one_less | choice |
| 5 | 28 | プリスクール | 2つ多い | two_more | choice |
| 5 | 29 | プリスクール | 空はどれ | which_is_empty | choice |
| 5 | 30 | プリスクール | ゼロの概念 | zero_concept | choice |
| 5 | 31 | プリスクール | 等分 | share_equal | choice |
| 5 | 32 | プリスクール | 指で足し算 | add_finger | single |
| 6 | 33 | プリスクール | 50まで数える | count_50 | single |
| 6 | 34 | プリスクール | 次の数（20まで） | count_next_20 | single |
| 6 | 35 | プリスクール | 5ずつ足す | add_5 | single |
| 6 | 36 | プリスクール | 10の合成 | compose_10 | single |
| 6 | 37 | プリスクール | 2つ少ない | two_less | choice |
| 6 | 38 | プリスクール | ちいさい引き算 | sub_tiny | single |
| 7 | 39 | 数の基礎 | 数を数える（1-100） | count_100 | single |
| 7 | 40 | 数の基礎 | 数の順番（穴埋め） | count_fill | single |
| 7 | 41 | 数の基礎 | 大小比較（1桁） | compare_1d | choice |
| 7 | 42 | 数の基礎 | 大小比較（2桁） | compare_2d | choice |
| 8 | 43 | 足し算 | +1〜+3（絵と式） | add_1d_1_bridge | single |
| 8 | 44 | 足し算 | +1〜+3（1桁） | add_1d_1 | single |
| 9 | 45 | 足し算 | +4〜+10（絵と式） | add_1d_2_bridge | single |
| 9 | 46 | 足し算 | +4〜+10（1桁） | add_1d_2 | single |
| 10 | 47 | 引き算 | 1桁-1桁（絵と式・繰下なし） | sub_1d1d_nc_bridge | single |
| 10 | 48 | 引き算 | 1桁-1桁（繰下なし） | sub_1d1d_nc | single |
| 10 | 49 | 引き算 | 1桁-1桁（絵と式・繰下あり） | sub_1d1d_c_bridge | single |
| 10 | 50 | 引き算 | 1桁-1桁（繰下あり） | sub_1d1d_c | single |
| 11 | 51 | 足し算 | 2桁+1桁（10のまとまり・繰上なし） | add_2d1d_nc_bridge | single |
| 11 | 52 | 足し算 | 2桁+1桁（数直線・繰上なし） | add_2d1d_mental_nc | single |
| 11 | 53 | 足し算 | 2桁+1桁（筆算・繰上なし） | add_2d1d_hissan_nc | single |
| 11 | 54 | 足し算 | 2桁+1桁（繰上なし） | add_2d1d_nc | single |
| 11 | 55 | 足し算 | 2桁+1桁（10のまとまり・繰上あり） | add_2d1d_c_bridge | single |
| 11 | 56 | 足し算 | 2桁+1桁（10をつくる） | add_2d1d_make10 | single |
| 11 | 57 | 足し算 | 2桁+1桁（筆算・繰上あり） | add_2d1d_hissan_c | single |
| 11 | 58 | 足し算 | 2桁+1桁（繰上あり） | add_2d1d_c | single |
| 11 | 59 | 引き算 | 2桁-1桁（10のまとまり・繰下なし） | sub_2d1d_nc_bridge | single |
| 11 | 60 | 引き算 | 2桁-1桁（数直線・繰下なし） | sub_2d1d_diff | single |
| 11 | 61 | 引き算 | 2桁-1桁（筆算・繰下なし） | sub_2d1d_hissan_nc | single |
| 11 | 62 | 引き算 | 2桁-1桁（繰下なし） | sub_2d1d_nc | single |
| 11 | 63 | 引き算 | 2桁-1桁（10のまとまり・繰下あり） | sub_2d1d_c_bridge | single |
| 11 | 64 | 引き算 | 2桁-1桁（たし算にもどす） | sub_2d1d_back_add | single |
| 11 | 65 | 引き算 | 2桁-1桁（筆算・繰下あり） | sub_2d1d_hissan_c | single |
| 11 | 66 | 引き算 | 2桁-1桁（繰下あり） | sub_2d1d_c | single |
| 11 | 67 | 足し算 | 2桁+2桁（繰上なし） | add_2d2d_nc | single |
| 11 | 68 | 足し算 | 2桁+2桁（繰上あり） | add_2d2d_c | single |
| 11 | 69 | 引き算 | 2桁-2桁 | sub_2d2d | single |
| 12 | 70 | 足し算 | 3桁+3桁 | add_3d3d | single |
| 12 | 71 | 引き算 | 3桁-3桁 | sub_3d3d | single |
| 12 | 72 | 足し算 | 4桁以上 | add_4d | single |
| 12 | 73 | 引き算 | 4桁以上 | sub_4d | single |
| 13 | 74 | 掛け算 | 九九（2の段） | mul_99_2 | single |
| 13 | 75 | 掛け算 | 九九（3の段） | mul_99_3 | single |
| 13 | 76 | 掛け算 | 九九（4の段） | mul_99_4 | single |
| 13 | 77 | 掛け算 | 九九（5の段） | mul_99_5 | single |
| 13 | 78 | 掛け算 | 九九（1の段） | mul_99_1 | single |
| 14 | 79 | 掛け算 | 九九（6の段） | mul_99_6 | single |
| 14 | 80 | 掛け算 | 九九（7の段） | mul_99_7 | single |
| 14 | 81 | 掛け算 | 九九（8の段） | mul_99_8 | single |
| 14 | 82 | 掛け算 | 九九（9の段） | mul_99_9 | single |
| 14 | 83 | 掛け算 | 九九ランダム | mul_99_rand | single |
| 15 | 84 | 掛け算 | 2桁×1桁 | mul_2d1d | single |
| 15 | 85 | 掛け算 | 3桁×1桁 | mul_3d1d | single |
| 16 | 86 | 割り算 | 割り切れる（九九逆） | div_99_rev | single |
| 16 | 87 | 割り算 | 2桁÷1桁（割切） | div_2d1d_exact | single |
| 17 | 88 | 割り算 | 余りあり（商1桁） | div_rem_q1 | multi |
| 17 | 89 | 割り算 | 余りあり（商2桁） | div_rem_q2 | multi |
| 18 | 90 | 掛け算 | 2桁×2桁 | mul_2d2d | single |
| 18 | 91 | 掛け算 | 3桁×2桁 | mul_3d2d | single |
| 18 | 92 | 割り算 | 2桁÷2桁 | div_2d2d_exact | single |
| 18 | 93 | 割り算 | 3桁÷1桁 | div_3d1d_exact | single |
| 18 | 94 | 割り算 | 3桁÷2桁 | div_3d2d_exact | single |
| 19 | 95 | 小数 | 小数の足し算 | dec_add | single |
| 19 | 96 | 小数 | 小数の引き算 | dec_sub | single |
| 20 | 97 | 小数 | 小数×整数 | dec_mul_int | single |
| 20 | 98 | 小数 | 小数÷整数 | dec_div_int | single |
| 20 | 99 | 小数 | 小数×小数 | dec_mul_dec | single |
| 20 | 100 | 小数 | 小数÷小数 | dec_div_dec | single |
| 21 | 101 | 分数 | 同分母の足し算 | frac_add_same | multi |
| 21 | 102 | 分数 | 同分母の引き算 | frac_sub_same | multi |
| 22 | 103 | 分数 | 異分母の足し算 | frac_add_diff | multi |
| 22 | 104 | 分数 | 異分母の引き算 | frac_sub_diff | multi |
| 22 | 105 | 分数 | 帯分数の計算 | frac_mixed | multi |
| 22 | 106 | 分数 | 帯分数の引き算 | frac_mixed_sub | multi |
| 23 | 107 | 分数 | 分数×整数 | frac_mul_int | multi |
| 23 | 108 | 分数 | 分数×分数 | frac_mul_frac | multi |
| 24 | 109 | 分数 | 分数÷整数 | frac_div_int | multi |
| 24 | 110 | 分数 | 分数÷分数 | frac_div_frac | multi |
| 24 | 111 | その他 | 10倍、100倍、1/10 | scale_10x | single |
| 25 | 112 | 数の応用 | 大きな数（万・億） | large_number_unit | single |
| 25 | 113 | 小数 | 小数のくらべ方 | dec_compare | choice |
| 26 | 114 | 分数 | 分数のくらべ方 | frac_compare | choice |
| 26 | 115 | 応用計算 | 割合（%） | percent_basic | single |
| 27 | 116 | 応用計算 | 平均 | average_basic | single |
| 27 | 117 | 応用計算 | 比 | ratio_basic | single |
| 28 | 118 | 応用計算 | 速さ | speed_basic | single |

---

## 4. レベル定義

各レベルの学習目標概要。

| レベル | 名称 | 概要 | スキル数 |
|---|---|---|---|
| 0 | はじめてのかず | 5まで数える・1対1対応 | 5 |
| 1 | かたちといろ | 形・色・パターン認識 | 5 |
| 2 | かずのきもち | 多い少ない・順序・空間 | 5 |
| 3 | 10までかぞえよう | 10までの数・順逆カウント | 5 |
| 4 | くらべてみよう | 長さ・重さ・大小比較 | 6 |
| 5 | ゼロとわける | ゼロの概念・等分・指足し算 | 6 |
| 6 | 50まで・まとまり | 50までの数・10の合成 | 6 |
| 7 | 100まで・大小比較 | 100までの数・大小比較 | 4 |
| 8 | 足し算（入門） | 1桁の足し算（絵と式の橋渡し） | 2 |
| 9 | 足し算（基礎） | 1桁の足し算（10づくり前後） | 2 |
| 10 | 引き算（1桁） | 1桁の引き算（絵と式の橋渡し） | 4 |
| 11 | 足し引き（2桁） | 10のまとまり・数直線・逆算・筆算で2桁の足し算・引き算へ進む | 19 |
| 12 | 足し引き（3桁以上） | 3桁以上の筆算 | 4 |
| 13 | 九九（前半） | 1〜5の段 | 5 |
| 14 | 九九（後半） | 6〜9の段、ランダム | 5 |
| 15 | 掛け算（筆算） | ×1桁の筆算 | 2 |
| 16 | 割り算（基礎） | 割り切れる計算 | 2 |
| 17 | 割り算（余りあり） | 余りのある計算 | 2 |
| 18 | 掛け割り（大きな数） | まとまった桁数の掛け割り | 5 |
| 19 | 小数（足し引き） | 小数の加減 | 2 |
| 20 | 小数（掛け割り） | 小数の乗除 | 4 |
| 21 | 分数（同分母） | 同分母の加減 | 2 |
| 22 | 分数（異分母） | 異分母の加減、帯分数 | 4 |
| 23 | 分数（掛け算） | 分数の掛け算 | 2 |
| 24 | 分数（割り算） | 分数の割り算・倍数変化 | 3 |
| 25 | 数と小数の応用 | 万・億、小数の比較 | 2 |
| 26 | 分数と割合 | 分数の比較、割合 | 2 |
| 27 | 応用計算 | 平均・比 | 2 |
| 28 | 速さ | 速さ・時間・道のり | 1 |

---

## 5. 入力UI仕様

### 5.1 入力方式

| 問題タイプ | 入力方式 | UI |
|---|---|---|
| 整数 | テンキー | 0-9 + 決定 + クリア |
| 小数 | テンキー + 小数点 | 0-9 + . + 決定 + クリア |
| 分数 | 分数パッド | 分子入力 → 分母入力 → 決定 |
| 帯分数 | 帯分数パッド | 整数 → 分子 → 分母 → 決定 |
| 余りあり | 商・余りパッド | 商入力 → 余り入力 → 決定 |
| 大小比較 | 3択 | > = < ボタン |
| 数を数える | テンキー | 0-9 + 決定 |

### 5.2 テンキーUI

```
┌─────────────────────────┐
│      問題: 23 + 45      │
│                         │
│        [ 68 ]           │  ← 入力中の答え
│                         │
├─────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐     │
│  │ 7 │ │ 8 │ │ 9 │     │
│  └───┘ └───┘ └───┘     │
│  ┌───┐ ┌───┐ ┌───┐     │
│  │ 4 │ │ 5 │ │ 6 │     │
│  └───┘ └───┘ └───┘     │
│  ┌───┐ ┌───┐ ┌───┐     │
│  │ 1 │ │ 2 │ │ 3 │     │
│  └───┘ └───┘ └───┘     │
│  ┌───┐ ┌───┐ ┌───┐     │
│  │ C │ │ 0 │ │ ✓ │     │
│  └───┘ └───┘ └───┘     │
└─────────────────────────┘
```

### 5.3 分数入力UI

```
┌─────────────────────────┐
│    問題: 1/2 + 1/3      │
│                         │
│        [ 5 ]            │  ← 分子
│       ─────             │
│        [ 6 ]            │  ← 分母
│                         │
├─────────────────────────┤
│  分子 ←→ 分母  切替     │
│  テンキー + 決定         │
└─────────────────────────┘
```

### 5.4 スキップ

- 左スワイプでスキップ
- 答えを表示してから次の問題へ
- 記憶強度は1にリセット

---

## 6. データ構造

### 6.1 スキル定義

```typescript
interface MathSkill {
  id: string;              // "add_1d_1"
  name: string;            // "+1〜+3（1桁）"
  level: number;           // 4
  category: MathCategory;  // "addition"
  inputType: InputType;    // "numpad"
  family?: string;         // "addition-basic"
  representation?: MathRepresentation;
  reviewFallbackSkillIds?: string[];
  sameConceptSkillIds?: string[];
  // generate関数は実装時に 04_math_problems.md の仕様に基づいて実装する
}

type MathCategory = 
  | "counting"      // 数の基礎
  | "addition"      // 足し算
  | "subtraction"   // 引き算
  | "multiplication"// 掛け算
  | "division"      // 割り算
  | "decimal"       // 小数
  | "fraction";     // 分数

type InputType = 
  | "numpad"        // 整数テンキー
  | "decimal"       // 小数テンキー
  | "fraction"      // 分数パッド
  | "mixed"         // 帯分数パッド
  | "remainder"     // 商・余りパッド
  | "comparison";   // 大小比較（3択）

type MathRepresentation =
  | "concrete"
  | "bridge"
  | "symbol"
  | "strategy"
  | "mental"
  | "algorithm"
  | "reverse";
```

補足:

- `reviewFallbackSkillIds` は、記号問題でつまずいたときに戻す候補を持つ。
- `reviewFallbackSkillIds` は、`Symbol -> Bridge` だけでなく `Bridge -> Concrete` にも使える。
- `sameConceptSkillIds` は、同じ概念の別表現スキルを束ね、`Bridge -> Symbol` の進行にも使う。
- 現在の実装では、初期の `絵と式` 橋渡しに加えて、2桁+1桁 / 2桁-1桁 で `Bridge -> Mental/Strategy/Reverse -> Algorithm -> Symbol` の小さい階段をこの metadata で持ち始めている。

---

作成日: 2026年1月15日
最終更新: 2026年3月29日
