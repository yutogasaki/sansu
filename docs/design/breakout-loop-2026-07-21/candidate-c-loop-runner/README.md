# Candidate C — 走る輪っか根

## 判定

**画像は却下。仕組みは次段階候補として HOLD。**

輪列と相棒が同じ接触点で重なり、64 pxでは「輪が脚の間を追い越した」より「輪に座る／跳び越える」に見える。初稿は跳躍に見えたため、許可された1回だけ相棒の姿勢を後ろ向きへ修正した。修正版も尻の三分割と中央輪への接触が人工的で、無文字の因果ゲートを通らない。runtimeには入れない。

- Keyframe: [`keyframe-rejected-01-390x844.png`](./keyframe-rejected-01-390x844.png)
- 64 px silhouette: [`silhouette-audit-64.svg`](./silhouette-audit-64.svg)
- 画像内UI・文字・数・式: なし
- 帽子オチ: なし
- 同一物体: 同形・同色の輪が5つ

## 3ビート脚本

1. **ほどく** — 正答と同時に、相棒が地面から出た輪っか根を一つだけ転がしてほどく。残った輪も同じ形のまま小さく弾む。
2. **返ってくる** — 次の正答で、5つの輪すべてに短い足が生える。輪列が相棒へ戻り、1つ目は足元を追い越す。続く列が脚の間を抜け、相棒の全身を後ろ向きに回す。
3. **座らされる** — 最後の正答で、逃げた同じ5輪が低い横長のベンチ形へ並び替わる。遅れて落ちてきた相棒が後ろ向きのまま柔らかく座り、輪の足だけがそっと引っ込む。帽子・説明モーダル・追加CTAは使わない。

各ビートは「正答 → 1つの身体反応 → 次の入力可能」を守る。輪は全ビートで形・色・個数を維持し、別物への突然変異にしない。

## 64 px黒シルエット監査

| 項目 | 判定 | 根拠 |
|---|---:|---|
| 相棒の全身方向 | △ | 後ろ向きは読めるが、尻の分割が別パーツに見える |
| 輪列の横長比 | ○ | 5輪全体は3:1以上で横移動が読める |
| 脚の間を通過 | × | 相棒と中央輪が黒く接続し、前後関係が消える |
| 同一物体の連続 | ○ | 穴のある同形輪が反復される |
| 尻もち直前 | △ | 崩れより「輪に乗る」シルエットが先に立つ |

**結果: 2/5。採用ゲート4/5未達。** 次に描き直すなら、輪列を相棒より完全に手前へ出し、中央輪と胴体の間に最低8 px相当の地色を残す。相棒の尻は一つの豆形のまま、脚と腕の角度だけで後方回転を表す。

## 10軸予測採点

画像の完成度ではなく、この3ビートを読みやすいレイヤー作画で実装できた場合の予測。現画像はシルエットゲート未達のため採用不可。

| 軸 | 点 | 根拠 |
|---|---:|---|
| 1秒理解 | 7 | 輪列は明快だが「脚間通過」の前後関係が難しい |
| テンポ | 9 | 答えごとに輪が1動作し、停止説明が要らない |
| 因果 | 7 | 同じ輪の往復は強いが、折り返す理由を動きで補う必要がある |
| 身体ギャグ | 8 | 追越し、全身回転、着座へ段階的に大きくなる |
| ポップさ | 8 | 円の反復と短い足、大色面で遠目にも形が立つ |
| 次を見たい | 8 | 走り出した輪が次に何をするか予測と裏切りを作れる |
| リプレイ | 7 | 走順や抜ける側を替えられるが、最終オチは一系統 |
| 拡張性 | 8 | 輪、足、相棒、背景を独立レイヤーで量産できる |
| 安全性 | 9 | 柔らかい低位置の尻もちで、失敗や誤答を嘲笑しない |
| 学習接続 | 9 | 1回答1反応でTenKey連打を止めず、3問で完結する |
| **合計** | **80/100** | 瞬間体験6軸は47/60。production基準52/60に未達 |

## 生成prompt

Built-in `image_gen` を使用。参照画像はプロジェクト内モデルシートで、黄色い相棒の同一性だけに使用した。

```text
Use case: illustration-story
Asset type: exploratory mobile-game keyframe, portrait composition equivalent to a 390 × 844 phone screen, but containing NO interface.
Input image: use the supplied project model sheet only to preserve the small yellow bean-shaped companion's identity: golden-yellow bean body, two thin black antenna hairs, tiny black stick arms and legs. Do not copy the sheet layout, expressions, root character, or any recognizable external game IP.
Scene/backdrop: a sunny fantasy clearing made from a few large flat color shapes: warm cream sky, broad mint-green hill, one coral shrub, a simple ochre ground path. Very sparse, no decorative clutter.
Primary action at this single instant: five identical dark-green root rings form one long low horizontal procession, total procession silhouette at least 3:1 width-to-height. Every ring is unmistakably the same loop-shaped object and each ring has two comically short black feet. The ring procession is running from foreground-left to background-right THROUGH THE GAP BETWEEN THE yellow companion's legs and has just overtaken it. The companion is full-body, seen mostly from behind in a readable three-quarter back view; its torso twists the opposite way, both arms windmill, one foot lifts, knees buckle, and its bottom is about to land backward. This must read as “the root-ring line ran between its legs and turned it around” without words.
Character expression: small side-profile dot eye only if necessary; closed crooked mouth, startled rather than smiling. No giant eyes, no cute smile.
Style/medium: bold children’s editorial screen-print / cut-paper gouache, crisp hand-cut edges, flat opaque color fills, deliberately uneven contour rhythm, only 5–7 large color areas. Minimal dry-brush accents localized to the ground only. Not glossy, not 3D, not painterly fantasy concept art.
Composition/framing: character occupies central 45% of canvas, ring line crosses the lower-middle and is fully visible from first to last ring, generous negative space above, ground horizon low. Strong asymmetrical movement, exaggerated full-body silhouette, no tangencies between rings and legs.
Lighting/mood: bright midday, playful slapstick, direct and pop.
Constraints: one yellow companion only; exactly five same green root rings; each ring must have tiny running feet; full body visible; the line must visibly pass between both legs; no hat, no bench, no root vegetable, no extra creatures, no dirt impact cloud hiding the action.
Avoid: any text, UI, numerals, mathematical symbols, borders, panels, watermark, logos, gradients, airbrushed glow, cinematic lighting, detailed foliage, repeating decorative texture, symmetrical centered mascot pose, plastic 3D rendering, oversized eyes, open happy mouth, AI-like uniform stipple, resemblance to Mario/Yoshi/Pokémon/Dragon Quest characters.
```

### 単点修正prompt

初稿は跳躍に見えたため、背景・輪列を固定し、相棒の姿勢だけを修正した。

```text
Change ONLY the yellow companion’s full-body pose. Preserve the exact portrait framing, backdrop, palette, five green root rings, their positions, their tiny running feet, and the absence of UI/text.
Required new pose: the companion is seen clearly from a three-quarter BACK view, hips very low and bottom facing the viewer, about to sit backward. Both legs are lifted and spread forward so the central green running ring is unmistakably passing through the gap between the legs. Torso twists toward the departing line, arms windmill in opposite directions, whole silhouette tilts backward. This is a losing-balance pose, NOT a jump, stride, dance, or hurdle.
```

## 実装へ進める条件

1. 64 pxで相棒・輪列・脚間の地色が分離する。
2. 無文字5人中4人以上が「輪が脚の間を走って、相棒が後ろへ倒れる」と説明できる。
3. 全面生成画像ではなく、固定背景・相棒pose・5輪・足・速度線のレイヤーで再構成する。
4. 3回答とも入力復帰P95が550 ms以下になる。
