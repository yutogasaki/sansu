# 島ホームの表示面積とコンパクトなタブ

- 目的: 島の表示が小さくタブが大きいという追加指示に対応する。
- Review By: 2026-09-16
- Status: ローカル実装・検証完了。commit / push / 公開なし。
- SSOT: [ナビ43](../../product/43_island_navigation_spec.md)、[UI指針](../../product/07_ui_design_guideline.md)。
- 範囲: ホームの画面配分・任意操作・タブ。既存の学習、保存、他画面の戻り先を維持する。
- 並行作業: 別担当の島の実体験QA・既存検証文書は保持する。

## Docs To Touch

- `docs/product/01_app_spec.md`
- `docs/product/07_ui_design_guideline.md`
- `docs/product/43_island_navigation_spec.md`

## Verification

- 実画面で旧ナビv1と比較。390×844、短いphone、768×1024で島と全操作、学習と復帰を確認する。
- lint / typecheck / tests / build / docs。必要なナビ回帰とPWAを既存検証に重ねる。

## Outcome

- phoneの島表示338→503px、タブ82→60px。操作を1列へ整理し、44pxのタブと全入口を保持した。
- アルバム・学習からの横送り位置復元と、Tab選択時にボタン全体を表示する補正を追加。
- [実画面と検証範囲](../../design/audits/2026-09-09-island-home-space/verification.md)。
