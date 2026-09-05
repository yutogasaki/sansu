# G0 Number Suika — Runtime Audit

## Scope

開発専用ラボ `/#/__dev/suika` の whitebox を対象とする。

- Experiment ID: `g0-number-suika-v1`
- 候補名: かずのスイカ（元ネタ: スイカゲームの「落とす位置だけが入力」× 2048 の「同じものが合体」）
- Source base revision: `47831f9` に未コミットの作業ツリー
- Runtime target: ローカル Vite development server
- Build revision: `development-local`
- Delivery flag: `snap-root-v1`（production Explore の flag。この DEV route を選ばない）
- Cache/update state: Vite development/HMR。production PWA build ではない
- Formal status: **HOLD**

これは試験器が動く証拠であり、楽しさの PASS でも production 採用の根拠でもない。
既存の [G0 Core Loop Lab Audit](../2026-07-25-g0-core-loop-lab/README.md) と
[G0 Mechanic Remix v2](../2026-07-25-g0-mechanic-remix-v2/README.md) は上書きしない。

## なぜ別候補を作ったか

[18_core_game_redesign_proposal.md](../../../product/18_core_game_redesign_proposal.md)
の候補 A / B は、操作文法を新規に設計する前提だった。今回は方針を変え、
**すでに広く遊ばれている操作文法をそのまま借り、合体結果だけを算数へ置き換える**。

借りるもの: 落下位置だけを選ぶ入力、接触による合体、容器があふれる終了条件、
run 終了時の 3 択強化（ローグライト）。
借りないもの: 果物・キャラクター・固有名・UI レイアウト・音・造形。

## ルール

規則は数の種類に依らず一つだけ。

```text
触れた2つの「量」の和が 目標量 以下  → 合体して和になる
和がちょうど 目標量                → 弾けて消える（+100 × チェイン）
和が 目標量 を超える               → 合体しない（積み上がる、赤く弾く）
```

盤面に 7 があるとき 3 が欲しくなる。**補数が、演出ではなく操作そのもの**になる。
`docs/product/18` §5.3 の `MathActionContract` が要求する
「式を無関係な仮ボタンへ置換すると成立しない」条件を満たす。

## 数の種類（profile）

整数専用として作ってから小数・分数を後付けする作りにはしていない。
量は最初から有理数（`n / d`）で持ち、profileは目標量と出現プールだけを変える。

| profile | 目標量 | 出る玉 | 成立する式の例 | 想定skill |
|---|---|---|---|---|
| `tens` 整数 | 10 | 1〜5 | `3+4=7`, `6+4=10`, `6+5=11`（不成立） | `compose_10` / `add_1d_*` / `add_2d1d_make10` / `sub_2d1d_back_add` |
| `decimal` 小数 | 1 | 0.1〜0.5 | `0.3+0.4=0.7`, `0.6+0.4=1`, `0.6+0.5=1.1`（不成立） | `dec_place_value` / `dec_add` / `dec_sub` / `scale_10x` |
| `fraction` 分数 | 1 | 1/2, 1/3, 1/4, 1/6 | `1/3+1/6=1/2`, `1/4+1/3=7/12`, `1/2+1/2=1`, `2/3+1/2=7/6`（不成立） | `frac_part_whole` / `frac_equiv_visual` / `frac_add_same` / `frac_add_diff` |

玉の大きさと色は「目標量に対する割合」で決まる。したがって
**整数の 5、小数の 0.5、分数の 1/2 は同じ大きさ・同じ色**になり、
表記が違っても同じ量だと目で分かる。異分母の足し算は、通分の手順を教える前に
「1/3 の玉と 1/6 の玉がくっついて 1/2 の玉になる」という物理として起きる。

量は有理数で扱うので `0.1 + 0.2` が `0.30000000000000004` になることはない。
浮動小数の比較は `suikaQuantity.ts` の層で禁じている。

## 実装境界

production 挙動は一切変更していない。

| 追加 | 役割 |
|---|---|
| `src/domain/explore/suikaQuantity.ts` | 量の有理数表現。加算、比較、約分、目標量比、表示整形 |
| `src/domain/explore/g0NumberSuika.ts` | 純粋ドメイン。profile、Verlet 物理、合体規則、あふれ判定、おまもり、run 間持ち越し |
| `src/components/dev/suika/NumberSuikaStage.tsx` | SVG ステージと入力（ポインタ / キーボード）。分数は縦積みで描く |
| `src/components/dev/suika/suikaPalette.ts` | whitebox 用の平面色。量の割合で決める |
| `src/pages/dev/NumberSuikaLab.tsx` / `.css` | ラボ画面、rAF ループ、HUD、数の種類タブ、おまもり選択、診断記録 |
| `tools/capture-suika-lab.mjs` | 実ブラウザ・実フレームでの動作記録とキャプチャ |

route は `import.meta.env.DEV` でのみ登録する。production build には入らない。
学習 planner、SRS、receipt、保存、PWA には接続していない。

## 検証

### 自動テスト

`npm run lint` / `npm run typecheck` / `npm run test:run`（100 files, 945 tests）/ `npm run build` すべて PASS。

新規 49 件の内訳:

- `suikaQuantity.test.ts`（7 件）: 約分、異分母加算、`0.1 + 0.2` の誤差なし加算、
  表記が違う同量の等値判定、目標量比、表示整形
- `g0NumberSuika.test.ts`（32 件）: 3 profile それぞれの合体・解放・非合体、
  表記が違う同量が同じ大きさになること、チェイン、落下クールダウン、狙いの丸め、
  決定論（同 seed・同操作列・同 dt 列で同一盤面）、あふれ、おまもり効果、
  数の種類切替での持ち越し、メトリクス
- `NumberSuikaStage.test.tsx`（10 件）: 容器・持ち玉・盤面描画、整数 / 小数 / 分数の
  ラベル描画、3 profile の式表示、非合体の式表示、reduced motion、あふれ間近の状態

### 実ブラウザ・実フレーム

`node tools/capture-suika-lab.mjs` を実行。Playwright Chromium、deviceScaleFactor 2、
実際の requestAnimationFrame。HMR を挟まない固定ビルドで取り直した結果。

| シナリオ | 目標量 | 実時間で落下 | 落下数 | 終了 | 出た式 | 解放の撮影 | console error |
|---|---|---|---:|---|---:|---|---:|
| 390×844 整数 | 10 | PASS | 60 | 継続中 | 19 種 | PASS | 0 |
| 390×844 小数 | 1 | PASS | 60 | 継続中 | 18 種 | PASS | 0 |
| 390×844 分数 | 1 | PASS | 60 | 継続中 | 18 種 | PASS | 0 |
| 768×1024 分数 | 1 | PASS | 35 | あふれで終了 | 14 種 | PASS | 0 |

768 の分数だけが 60 落下以内にあふれ、おまもり 3 択と新 run 開始まで到達した。
記録は [captures/runtime-report.json](./captures/runtime-report.json)、画面は
`captures/{390-tens,390-decimal,390-fraction,768-fraction}-{ready,merge,target-pop}.png`。

### 分かったこと

**1. 3 種類とも同じ規則で成立する。**
`3+4=7` / `0.5+0.5=1` / `3/4+1/4=1` が、いずれも同じ落下・接触・解放として起きた。
1 run あたり 14〜19 種類の異なる式が成立しており、決まった数問を消化する構造にはなっていない。

**2. 狙いが結果を変える。**
現行 Explore の中心的な欠陥は「選択が結果を変えない」ことだった（`docs/product/18` §2.1）。
整数 profile で同一 seed・同一ルールのまま落とし方だけを変えると、次の差が出た。

| 遊び方 | 落下数 | スコア | 10 の解放 |
|---|---:|---:|---:|
| 位置を散らすだけ | 40 | 35 | 0 |
| 和が 10 になる相手を狙う | 9 | 325 | 複数 |

同じ玉列でも、**狙いだけで結果が一桁変わる**。操作が結果へ接続していることの
最低限の証拠にはなる。ただしこれはスクリプトの挙動であり、子どもの上達曲線ではない。

**3. 上手く遊べる相手には簡単すぎる。**
目標量ちょうどを狙う単純なスクリプトに対し、390 の 3 profile はいずれも
60 落下であふれなかった。緊張が生まれるのは下手に置いたときだけで、
容器サイズ、出現プール、クールダウンは未調整のまま。難度設計はこれから。

**4. 同じ盤面が再現しない場合がある。**
純粋ドメインは同一 dt 列に対して決定論だが、実ブラウザの rAF は dt が揺れるため
同じ操作列でも軌道が分岐する。混在ビルドで撮った前の試行では 390 分数が 28 落下で
終わり、固定ビルドでは 60 落下でも終わらなかった。物理ゲームとして想定内だが、
**実機比較を「同じ結果になるはず」という前提で行わないこと。**

## 証明していないこと

- **楽しいかどうか**。子どもは一人も触っていない。自発リプレイ、因果説明、
  再訪はすべて未測定
- **分数・小数が子どもに読めるか**。縦積み分数と小数表記が 64px 相当で
  読めるかは実機で未確認。大人の目で成立していることしか分かっていない
- 学習接続。planner / SRS / receipt / TenKey とは未接続
- **この文法が扱えるのは「目標量への加法」だけ**。下記は未実装:
  - 引き算（玉を割る操作が要る）
  - 掛け算・割り算（同じ量のまとまり / 等分の操作が要る）
  - 筆算全般（`*_hissan_*`）。手順そのものが学習目的なので、この文法では代替できない
  - 応用計算（`percent_basic` / `average_basic` / `ratio_basic` / `speed_basic`）
  - 非数量スキル（形・色・パターン・長さ / 重さ比較）
- 難度。狙って遊ぶと容器が空きやすく、あふれにくい可能性がある。
  容器サイズ、玉の出現重み、クールダウンは profile ごとに未調整
- 音、演出、絵。whitebox の平面色のままで、意図的に作り込んでいない
- production 保存、resume、PWA 更新契約への影響（未接続のため未評価）

## 次のゲート

`docs/product/18` §11 の G0 停止条件をこの候補にも適用する。

1. 事前に人数・baseline・最低条件を日付付きで固定する（§11.0）
2. 子どもへ無言で渡し、自発リプレイ 4/5、因果説明 4/5、失敗後の再試行 4/5、
   危険・痛そう・責められた解釈 0 件を見る
3. 未達なら絵を直さず、合体規則か終了条件を変える
4. 通過した場合だけ G1 で実 planner・実 receipt を接続する。
   その際、合体操作そのものを回答入力にできる skill と、
   TenKey へ fail-close する skill の境界を先に決める

数の種類は 1 回の観察で 3 つ全部を見せない。まず対象学年に合う 1 profile だけを
無言で渡し、通ってから次を足す。`docs/product/02_math_skills.md` の 7 段階でいえば、
この文法が効くのは Concrete / Bridge / Strategy であり、Algorithm（筆算）ではない。
筆算と応用計算は既存の `/study` に TenKey のまま残す前提とする。

現行 production（固定 8 問 Explore）は containment として維持する。
