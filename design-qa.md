# Design QA: ひかりの橋・縦切り

- source visual truth: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/04-light-bridge-vertical-slice.png`
- implementation screenshot: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/09-implementation-idle-pass-2-390x844.png`
- bridge-built feedback screenshot: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/13-implementation-complete-390x844.png`
- crossed-companion frame: `/Users/yutogasaki/Projects/sansu/public/assets/explore/light-bridge/scene-crossed.jpg`
- incorrect-state screenshot: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/14-implementation-incorrect-390x844.png`
- hint-state screenshot: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/15-implementation-hint-390x844.png`
- viewport: `390 × 844` primary; `768 × 1024` responsive/reduced-motion smoke coverage
- state: ひかりの橋を選択した足し算遭遇。未入力、誤答、継続ヒント、正解、橋完成を確認

## Full-view comparison evidence

- pass 1: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/06-comparison-full-pass-1.png`
- pass 2: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/10-comparison-full-pass-2.png`

## Focused region comparison evidence

- HUD・問題面: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/11-comparison-top-focus-pass-2.png`
- キーパッド: `/Users/yutogasaki/Projects/sansu/docs/design/explore-immersive-directions-2026-07-19/12-comparison-controls-focus-pass-2.png`

## Findings

P0/P1/P2の未解決項目はありません。

- Typography: ターゲットの絵本的な焼き込み文字に対し、実装は既存の `Noto Sans JP` とDOMテキストを使用。見出し、式、状態文、数字の階層は明確で、390px幅でも欠け・不自然な折返しはありません。動的問題と読み上げを守るための意図的な差分です。
- Spacing and layout: ターゲットの全面アートに対し、実装は既存探索HUDを残し、その下を没入シーンにしています。主要な橋、子ども、相棒、式、入力が同時に見え、持続操作は画面内に収まります。390×844と768×1024の両方で外周オーバーフローなし、全ボタン44px以上を確認しました。
- Colors and tokens: 深い青緑、水晶のシアン、光の金色をターゲットから引き継ぎました。誤答は琥珀、正解は緑で既存の探索セマンティクスとも一致します。
- Image quality and asset fidelity: 未完成、橋完成、相棒が対岸へ渡った余韻は、同一構図を参照した生成済み実画像を使用し、文字・HUD・操作は画像へ焼き込んでいません。390px表示で目立つ圧縮崩れ、伸長、ハロー、置換用CSSアートはありません。
- Copy and content: 「橋が ぽよん」「まとまりを見て、もういちど」「こたえが光になった」で、失敗を責めずに世界の反応と次の行動を伝えています。
- Icons and controls: 既存Lucideアイコンとネイティブボタンを維持。ターゲットの3列キーに対し、実装はクリア・削除を残す4列構成です。操作回復性のための意図的差分で、石・光の配色へ統合済みです。
- Accessibility and states: 問題見出しへのフォーカス、空回答時の決定無効化、誤答`alert`、成功`status`、入力ロック、8桁制限、キーボード入力、reduced motionを確認しました。背景画像は装飾扱いで、式と操作はDOMに残っています。

## Comparison history

### Pass 1

- [P2] キーパッドが明るいクリーム面で、ターゲットの石と光の世界から浮き、一般的な学習フォームに見えました。
- evidence: `06-comparison-full-pass-1.png`, `08-comparison-controls-focus-pass-1.png`
- fix: 数字・補助キーを深い苔色と金色の文字へ変更し、決定キーを光の金色へ変更。既存の操作構成と44pxタップ領域は保持しました。

### Pass 2

- evidence: `10-comparison-full-pass-2.png`, `12-comparison-controls-focus-pass-2.png`
- result: 入力面が地下湖の色と一体化し、ターゲットの触覚的な石キーの意図に近づきました。新たなP0/P1/P2はありません。

## Primary interactions tested

- Gameから探索へ入り、2ノードを正解して橋へ到達
- 「ひかりの橋」を選択し、足し算問題と生成済み未完成シーンを表示
- 誤答でひかりが1減ること、同じ遭遇に留まること、具体物ヒントが持続することを確認
- 正解で入力をロックし、同一シーンが完成橋へ変わった後、相棒が対岸へ移る静止フレームになること、橋コストが既存ルールどおり反映されることを確認
- 390×844と768×1024のreduced-motionスモークを完走
- ブラウザコンソールのwarning/error: 0件

## Follow-up polish

- [P3] ターゲットは洞窟アートがHUDの背後まで続きますが、実装はSansu共通HUDの明るい外殻を維持しています。探索全体を同じ没入HUDへ展開する段階で共通化を検討できます。
- [P3] ターゲットの手描き表示文字は画像固有です。将来ブランド用の可読性確認済み丸ゴシックを導入する場合、探索見出しだけ段階的に寄せられます。

## Implementation checklist

- [x] P0/P1/P2の追加修正なし
- [x] `e2e:smoke`（390×844 / 768×1024、reduced motionを含む）
- [x] `verify:core` 最終実行（441 tests / production build）

final result: passed
