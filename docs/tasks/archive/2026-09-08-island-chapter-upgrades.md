# 居場所の完成で島全体をアップグレードする

- Date: 2026-09-08
- Owner: Codex
- Status: Complete
- Review By: 2026-09-15

## Scope

ユーザー選択「花壇や家などを育てきると、島全体が次の段階になる」を実装する。正本は[仕様30](../../product/30_living_island_growth_spec.md)。任意の1居場所成熟で東、2居場所成熟で西を開き、完成と島の拡張を一つの節目として伝える。旧土地・snapshot・予約・配置を保持する。

## Verification

Island行のcore、smoke、classic/Island PWA、DEV、production living、正式固定10問を適用。任意育成・成熟前の未解放・旧土地の維持・混在するアルバム・東がない時の家具/住民/灯台・新しい土地への配置を検証する。phone/tabletで予兆と節目の実画面を確認し、human N=0と作者評価を分ける。

## Docs To Touch

- 親01、仕様30、UI07/島28の該当契約。
- docs/design/audits/2026-09-08-island-chapter-upgrades/: 同じ版の実画面と検証。
- docs/done/2026-09.md、共有tasks: 完了時に更新。

## Result

任意の1居場所成熟で東、2居場所成熟で西へ広がるよう実装した。完成直前の予告、拡張を主見出しにする節目、完成と拡張をまとめる5記録、旧段階・snapshot・予約・配置の維持を確認した。固定候補 `9300ea0-chapters-250bf14c2fe2` / visual v5。

core 173ファイル/2,020テスト、smoke31、classic PWA4、Island DEV10/47画面、production living25区間×2/66画面、任意育成・混在履歴4ケース、Island PWA8と実SW offline、正式80run/15gate/eligibleがPASS。主島の外側の波紋の画角を修正して固定し直した。DEV初回の速度FAILは同一条件の再試行でPASSしたが原因未確定。正式80runは別benchmarkと並列であり、独占性能は認定しない。

[同じ版の実画面](../../design/audits/2026-09-08-island-chapter-upgrades/review.html)と[検証記録・原FAIL・対象境界](../../design/audits/2026-09-08-island-chapter-upgrades/README.md)へ保存。共有workspaceのdocs/typecheck/diffと対象13ファイル94テストもPASS。並行する別作業の変更は保持した。作者の視覚評価とhuman N=0、runtimeを別判定とし、ローカル実装まで完了。commit・push・deployなし。
