# Shared Task Queue

## Purpose

CodexとClaude Codeの共有実行キュー。詳細は `docs/tasks/active/`、全体の推奨順と実装済み項目は [バックログ](../../docs/tasks/backlog.md)、外部確認待ちは [保留キュー](BLOCKED.md) を参照。

## Rules

- 実行中のタスクを一行ずつ記す。履歴や将来候補を混ぜない。
- 同じ残件は既存の詳細へ集約し、横断目的ごとに重複起票しない。
- 閉じた区切りは `docs/done/YYYY-MM.md` に記録する。
- 実装済み・検証済み・公開済みを区別する。

## Current Queue

- Nature Town S1：受入46/47。次は町全体の空間構成・受渡し、実iOS。SAFE-06の独立回答待ちは保留キューを参照 -> docs/tasks/active/2026-09-16-nature-town-s1.md
- Mysterious island v3：島ホーム入口は局所改善済み。次は世界美術（巨大植物・局所陰・地形接続）と現行版の残件照合。C3/Human評価は未完 -> docs/tasks/active/2026-09-13-mysterious-island-v3.md
- Home journey connection preview：接続試作は検査済み、本制作・最終美術・公開範囲は未完。現行の家UI変更と対象系統を照合 -> docs/tasks/active/2026-09-09-home-journey-preview.md
- Full island experience from benchmark：採用項目の横断索引。Goal方式の追加分析は停止済み、既存の通常実装と残件を保持 -> docs/tasks/active/2026-09-08-island-experience.md
- Learning rhythm and island game experience：学習と暮らしの横断目的。個別実装はv3/家/S1と重複させず参照する -> docs/tasks/active/2026-09-07-experience-improvements.md
- Whole-app UX/UI coherence：旧Exploreとの取り違え原因を整理し、通常devをIsland (`/#/island`)へfail-closed固定。F-44で320pxナビ、F-45〜47で「ほかの あそび」/短横画面の主要3入口/写真CTA、F-48〜52で短横画面の学習/Welcome/遊び/写真境界、F-53で短横在庫のscroll案内、F-55で島/プロフィール読込エラーCTAを現行ぽこもこへ統一。`live-81`は5 / 137 checks / 91 captures、`live-84`は7 / 193 / 131、`live-85`は3 / 81 / 55、`live-87`は5 / 147 / 95、`live-88`は599px geometry / 29 / 19、`live-89`は4 / 123 / 79、`live-90`は480×431/599×430/phone/tabletで4 / 111 / 73、短横画面geometryは3 / 89 / 57、すべてpage error 0。`live-91`は844×390のRecords内部scrollを35 checks / 22 captures、`live-92`は5 viewportでRecords末尾・見出し到達を157 / 103、`live-97`は5 viewportでInventory cue/card/副CTA到達を160 / 107、`live-98`は320×568のcue非表示/no-overflow負条件を32 / 20。`live-99`はUtility capture待ちを400→800msへ延長し320×568で32 / 20、標準6 viewportで192 / 127を通過したが、`live-101`で320px `/battle` のフル画面PNGにナビ欠落が続くと訂正（33 checks pass、DOM/hit-test・nav単体captureは正常、表示の実端末確認は未完了）。`live-100`はF-54の幅360以下タイトル表示を320/360/390で95 / 60、標準7 viewportで226 / 147、`live-102`は2エラー経路×2 viewportで復帰、標準7 viewportで226 / 147 / page error 0、`verify:core` 457 files / 4,154 tests PASS。`e2e:island-navigation`の既定viewportへ320×568と360×640を追加。旧Exploreは任意副モード、Nature Town (`5233`)は別owner previewで変更なし。未完了: 全ルート/状態棚卸し、実端末のスクロール発見性/画面表示、実読み上げ、参加者理解/楽しさ、release/update評価 -> docs/tasks/active/2026-09-20-whole-app-ux-coherence.md
  - `live-103`：Islandの主要導線を1024×768 / 1440×900で30 checks/viewport、40 captures、page error 0。Welcome・島/家・学習・設定・記録・保護者・Battle setupまでの幅広画面証拠を追加。親画面CTAの自然なtouch発見性、全状態、実読み上げ/参加者評価は未完了。
