# Golden Discovery Page visual direction

## Decision

`concept-keyframe-v1.png` と `concept-keyframe-v2.png` は、2026-07-19の再ベンチマークでvisual targetから退役した。v2の平面ガッシュ、切り紙、7色均等配色、一定線幅、三手掛かりノートを新規画面へ翻訳しない。現行方向は [14_ui_world_motion_spec.md](../../product/14_ui_world_motion_spec.md) の `いびつ生態ポップ`、比較根拠は [再ベンチマーク](../research-library-2026-07-19/benchmark-yoshi-fukashigi.md) を正とする。

これらは履歴・比較用画像であり、制作基準画像でも本番配信資産でもない。`public` へ移動せず、PWA precacheへ含めない。

## Implementation review

以下は当時の状態、DOM、操作、アクセシビリティを示す実装証拠であり、現在のvisual quality targetではない。

初回縦切り（独立レビュー前）:

- `implementation-feature-2-390x844.jpg`: 通常発見。P1修正前の自動で閉じる調査スリップ、2/3手掛かり、次の気配
- `implementation-feature-3-390x844.jpg`: 3つ目の手掛かり。背後の結果面も育つ紙ジオラマへ変更後
- `implementation-big-discovery-390x844.jpg`: 3手掛かりの次に開く大発見。明示的な続行操作
- `implementation-return-summary-390x844.jpg`: 調査ページを1ランの物語として帰還画面へ統合

独立レビューP1修正後:

- `implementation-p1-feature-1-390x844.png`: 通常発見。12〜14px以上の本文、明示的な48px続行操作、続行操作へのフォーカス、背後UIの`inert`を確認
- `implementation-p1-feature-3-390x844.png`: 3つ目の手掛かり。通常発見の静かな完成状態と、画面内の主操作を確認
- `implementation-p1-big-discovery-390x844.png`: 大発見。複数の花と光源がつながり、3つ目の手掛かりとは静止画でも異なる世界変化を確認
- `implementation-p1-return-summary-390x844.png`: 調査ページ直後へ再探索CTAを移し、初期表示内に48px操作が見えることを確認

初回390×844はin-app browser、P1修正後390×844はPlaywright Chromiumで実レンダリングを確認した。タブレット幅は自動E2Eで確認し、in-app browserの表示上限により得られた473×1024の参考画像は `in-app-browser-return-summary-473x1024.jpg` として区別した。

## RETIRED_DO_NOT_USE — Prompt v1

```text
Use case: ui-mockup
Asset type: portrait mobile game visual-direction keyframe for an original children's math exploration game
Primary request: Design one irresistible 9:16 gameplay screen where solving a small addition visibly reveals a living mystery and fills one clue in a field notebook.
Scene/backdrop: a bright underground root grotto built like a handcrafted pop-up storybook; layered paper rock arches, moss islands, tiny underground stream, crystal lanterns, warm safe darkness only at the outer edges.
Subject: an original "sum-bloom" organism at center. Three seed-lights glow on one curling stem and two seed-lights glow on another; they flow together and become a five-petal luminous flower, making 3 + 2 = 5 visually obvious without instructional text. A tiny original round cave companion watches with delighted curiosity, not resembling any existing franchise character.
Style/medium: authored children's field-journal illustration; gouache plus cut-paper collage; consistent bold ink contour; simplified iconic shapes; slight risograph print grain; deliberate limited palette of deep teal, cyan, moss green, warm amber, coral, parchment, and dark ink. Premium console-game art direction, playful and tactile, not babyish.
Composition/framing: portrait mobile screen. Quiet slim resource/map strip at top; large interaction diorama in the middle; an open parchment research notebook rising from the bottom with exactly three clue-stamp slots, one newly filled by a flower-shaped stamp; one obvious rounded primary-action area at the very bottom. UI is integrated as physical expedition gear. Strong focal hierarchy and generous breathing room.
Lighting/mood: calm bioluminescent ambience with one brief warm discovery flare around the flower; cozy wonder, curiosity, safe suspense.
Constraints: completely original visual language; no recognizable characters, creatures, logos, UI layouts, trademarks, or copied assets from existing games; no written words, no gibberish text, no watermark; important state must be clear through shape, count, and composition.
Avoid: photorealism, glossy 3D render, generic AI fantasy art, hyper-detailed texture, neon purple-blue gradient, dark horror, combat, clutter, floating glass dashboard cards, emoji, plastic mobile-game icons.
```

## RETIRED_DO_NOT_USE — Prompt v2

```text
Use case: ui-mockup
Asset type: portrait mobile game visual-direction keyframe, second art-direction variant
Primary request: Create a highly authored, flat 2D version of a children's math-discovery game screen. A small addition must visibly transform the world and stamp one clue into an expedition notebook.
Scene/backdrop: bright underground root garden shown as a stage-like paper diorama with only four depth layers: foreground notebook, central organism platform, cave arch, distant stream. No realistic perspective clutter.
Subject: an original sum-bloom. Exactly three round seed-lights sit on the left vine and exactly two on the right vine; five light trails meet and open exactly five broad petals. One tiny original pebble-like cave companion points at the result. It must not resemble any known franchise mascot.
Style/medium: flat gouache and screenprint children's field-guide illustration; visibly hand-cut paper edges; one consistent dark-teal ink outline width; chunky geometric silhouettes; deliberately imperfect registration; sparse stipple and dry-brush grain only. Strict palette of seven inks: parchment, dark teal, turquoise, moss, amber, coral, and cream. Think an authored pop-up field journal, not a rendered fantasy scene.
Composition/framing: 9:16 portrait. Top 12% is a quiet sewn expedition belt with three simple resource symbols. Middle 55% is the large interactive organism stage. Bottom 33% is an open paper notebook with exactly three large stamp circles; the first contains a five-petal stamp and the other two are blank; below it is one large physical tab-shaped action control with no label. Strong negative space around the flower.
Lighting/mood: mostly flat color; one restrained amber halo behind the new five-petal flower as the earned peak. Cozy curiosity and tactile play.
Constraints: completely original; no copied characters, branding, UI, or assets; no written words, numerals, equations, gibberish, logos, or watermark; state is communicated only by count, shape, and position; mobile-safe tap areas; simple enough to reproduce as layered HTML/CSS/SVG and small sprite assets.
Avoid: photorealism, realistic materials, glossy 3D, cinematic concept art, generic AI fantasy, excessive micro-detail, neon gradients, purple glow, glass cards, floating dashboard UI, emoji, dark horror, combat, confetti, plastic toy render.
```
