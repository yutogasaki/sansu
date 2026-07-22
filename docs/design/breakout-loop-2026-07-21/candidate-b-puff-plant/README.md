# 候補B: ふくらむ筒花

## 判定

**最終候補としては却下（予測 82/100、瞬間体験 49/60）**。

「入力すると身体で返る」「帽子ではない全身オチ」「筒花 → 空気輪 → 相棒 → 花弁」という因果は、現行 Root Pull より明快になる可能性がある。一方、最終の 64px 黒シルエットで相棒の手足と空気輪が接続し、花弁も中心と影で一塊になる。生成後の見栄えではなく、最小表示で四つの役割が分離することを突破条件にしたため、この絵は runtime 実装へ進めない。

初稿に対して許可された単点修正を一度だけ実施した。修正点は「相棒を 1.65 倍にし、輪と相棒、各花弁の間に負の空間を作る」。通常の 64px サムネイルでは改善したが、黒シルエット基準は未達だった。

## 3ビート脚本

1. **触角が横へ** — 回答と同時に相棒が柔らかい筒花を一度だけ押す。筒花が同じ強さの小さな空気を「ぽん」と返し、相棒の二本の触角だけが真横へ倒れる。入力から反応まで待ち画面を挟まない。
2. **全身アコーディオン** — 次の回答で筒花が短く縮んでから空気を返す。相棒の胴が一瞬だけ三段に縮み、足先はその場に残る。0.25 秒で元へ戻り、次の問題をすでに入力できる。
3. **くるり、花弁へ** — 3回答目で一つの丸い空気輪が出る。輪が相棒を半回転させ、下で開いた五枚花弁の座布団へ着地する。帽子・衝突・敵対表現は使わない。

三段階とも「同じ対象が、回答のたびに強さではなく身体変形の種類を変えて返す」。台詞や説明を読まなくても、左から右へ作用が伝わることを狙う。

## 64px 黒シルエット監査

| 観点 | 結果 | 根拠 |
| --- | --- | --- |
| 筒花 3:1 | PASS | 左の長い曲線が最小表示でも独立して残る |
| 相棒との差 | PASS | 長い筒と短い豆型で外形が競合しない |
| 空気輪 | PASS | 中央の一つの円環を認識できる |
| 相棒の横回転 | HOLD | 通常サムネイルでは読めるが、黒化すると細い手足が輪へ接続する |
| 花弁座布団 | FAIL | 色では五枚を読めるが、黒化すると中心と影が花弁を一塊にする |
| 因果の作用空間 | HOLD | 上下の空間はあるが、輪と相棒の間に十分な黒地分離がない |

監査画像:

- `candidate-b-thumbnail-64px.png`: 実色 64px
- `candidate-b-silhouette-64px.png`: 主役四要素を抽出して黒化した 64px 監査
- `candidate-b-silhouette-initial-rejected-64px.png`: 単点修正前

次にこの案を再探索する場合は、生成絵から始めず、まず 64px の四つの黒形を手作業で離して配置する。空気輪は相棒の背後に回さず半円にし、花弁は中央で接触させない。そのシルエットが通った場合だけ高解像度化する。

## 10軸予測採点

未実装のため体感実測ではなく、脚本と keyframe からの予測値。合格ラインは総合 86、かつ最初の6軸 52/60。

| 軸 | 点 | 根拠 |
| --- | ---: | --- |
| 1秒理解 | 7 | 実色では因果を追えるが、64px 黒化で輪・相棒・着地点が一部結合する |
| 問題テンポ | 8 | 1回答1反応で説明モーダル不要。実装・P95計測前なので9にはしない |
| 入力と反応の因果 | 9 | 筒花から出た一つの輪が相棒へ届く一本道 |
| 身体ギャグ | 9 | 触角、全身圧縮、半回転着地で身体変化が三段階に異なる |
| ポップさ | 9 | 明るい大色面と赤・黄・青・緑の高い分離 |
| 次の一手への期待 | 7 | 強度上昇は読めるが、2問目から3問目の予告を keyframe だけでは担保できない |
| リプレイ性 | 7 | 1ルートの三段オチで、反復時の別オチはまだない |
| 拡張性 | 8 | 筒の形、空気の返し、着地点を独立レイヤーにしやすい |
| 安全性 | 9 | 柔らかな空気と花弁で、敵・失敗・負傷表現がない |
| 学習の邪魔をしない | 9 | 答えるたび即反応し、追加説明や選択を要求しない |
| **合計** | **82/100** | **HOLD** |
| **最初の6軸** | **49/60** | **突破条件 52/60 未達** |

## 生成物

- `candidate-b-keyframe.png`: 単点修正後の高解像度原本（853×1844）
- `candidate-b-keyframe-390x844.png`: 端末相当の監査版
- `candidate-b-keyframe-initial-rejected-source.png`: 初稿の高解像度原本
- `candidate-b-keyframe-initial-rejected-390x844.png`: 初稿の端末相当版

画像は built-in `imagegen` で生成した。コードと runtime asset は変更していない。

## 初稿プロンプト

```text
Use case: illustration-story
Asset type: mobile educational game keyframe concept, portrait composition matching a 390 × 844 phone screen
Primary request: Create one single frozen action moment from an original, cheerful, non-combat children’s game. A tiny original bean-shaped amber-yellow companion is being lifted into a gentle half-turn by one large round ring of puffed air from an original soft tubular flower, exactly one instant before landing safely on a broad flower-petal cushion.
Scene/backdrop: bright whimsical meadow clearing with three or four large flat color planes; simple sky-blue upper field, warm cream path, saturated coral and leaf-green plant shapes; abundant clear negative action space around the air ring; shallow stage-like depth, not a detailed fantasy landscape.
Subject: the companion has a compact bean silhouette, two short black feelers, simple dot eyes, tiny mittenless line arms and feet, no costume and no hat. The tubular flower is clearly a different species and silhouette: one very long flexible trumpet stem at least three times longer than its width, with a wide coral bell and broad leaves, anchored at screen-left. The flower is an object/creature but must not have human eyes, a mouth, or a smile. The flower has just blown one clearly readable circular air ring, which gently rotates the companion in midair. Below the companion is a large open flower made of five broad rounded petals, visibly soft like a safe cushion; the companion has not landed yet.
Style/medium: original hand-cut paper and flat gouache children’s illustration, decisive slightly irregular contour shapes, sparse dry-brush accents only at edges, no smooth digital airbrush, no 3D render, no generic AI storybook finish. Design by silhouette first.
Composition/framing: tall portrait; keep all action in the upper two thirds so a game keypad could exist below later, but draw no UI. The long tube flower is screen-left, its bell points diagonally toward center. The single air ring dominates center. The rotating companion is centered above the petal cushion, body tilted nearly sideways with feelers trailing. All subjects fully visible with generous padding. At 64px thumbnail, the long tube, round ring, sideways bean, and petal landing pad must remain distinct black silhouettes.
Lighting/mood: clear sunny daytime, playful surprise, safe kinetic comedy, no peril.
Color palette: large saturated color blocks: sky cyan, sunny amber, coral-red, leaf green, cream; strong value separation between all major shapes.
Materials/textures: mostly flat matte paper-gouache; limited handmade edge variation; no repeated speckles, no homogeneous fuzzy texture, no glossy plastic.
Constraints: a single instant only; readable cause-and-effect from left to center to landing pad; flower aspect ratio at least 3:1; flower and companion must have clearly different silhouettes; one companion only; one air ring only; safe non-hostile interaction; original design with no resemblance to any established game character; no UI, text, numbers, equations, icons, borders, cards, meters, buttons, or watermark.
Avoid: hats or headwear, smiling flower face, giant cute eyes, big-mouth smile, enemy behavior, projectiles, explosion, impact starburst, fear, injury, clutter, multiple panels, storyboard, montage, gradients, cinematic bloom, tiny decorative detail, faux depth-of-field, glossy 3D, soft AI airbrush, uniform texture across every surface.
```

## 単点修正プロンプト

```text
Use case: precise-object-edit
Asset type: mobile educational game keyframe concept, portrait composition
Primary request: Improve only the 64-pixel silhouette separation of the existing action cluster.
Input images: Image 1 is the edit target and must remain the same scene and visual style.
Required edit: Make the amber bean-shaped companion about 1.65 times larger, still nearly sideways and still airborne, but place it clearly inside the open center of the single air ring with a visible sky-blue gap around its complete outline so it does not touch or merge with the ring. Enlarge the five-petal landing cushion slightly and separate each broad petal with a deep visible V-shaped gap of cream ground between petals, so the landing pad reads as five petals rather than one round blob at a 64-pixel thumbnail. Keep the companion exactly one instant before landing.
Invariants: keep the long coral tubular flower, its position and 3:1-or-longer silhouette; keep exactly one round air ring; keep the left-to-center-to-petal cause-and-effect; keep the bright flat large color planes, portrait framing, safe non-hostile mood, and handmade flat gouache/cut-paper treatment. Keep one companion only. Keep all action above the lower keypad-safe area. No other compositional or stylistic changes.
Constraints: no UI, text, numbers, equations, symbols, icons, buttons, cards, borders, watermark, hat, headwear, smiling flower face, giant eyes, big-mouth smile, enemy behavior, impact, injury, explosion, multiple panels, or added characters. No AI airbrush, glossy 3D, repeated speckles, or homogeneous fuzzy texture.
```
