# 島のタブと戻り方の実装

- 目的: 承認ワイヤーの3項目ナビ、集中画面のタブ非表示、開始前への復帰を実装する。
- Review By: 2026-09-16
- SSOT: [画面遷移43](../../product/43_island_navigation_spec.md)、[親仕様](../../product/01_app_spec.md)。
- 範囲: Layout / Footer / Island / 設定・記録の入口、履歴・回帰テスト。
- 進行: タブとトップ起動の実装・検証完了。2026-09-09の追加指示でmainへcommit・pushする。
- 検証: focused tests → verify:core → smoke / PWA / Island、実画面の通常・学習・復帰。
- 既存の並行変更: 島造形、feature、Vite、既存QAハーネスを保持する。

## Docs To Touch

- `docs/product/43_island_navigation_spec.md`
- `docs/product/01_app_spec.md`
- `docs/product/12_screen_flow_spec.md`
- `docs/product/22_shared_subject_build_and_play_spec.md`
- `docs/product/28_mystic_island_spec.md`

## Verification

- [実装・固定候補・検証と残る範囲](../../design/audits/2026-09-09-island-navigation/verification.md)。
- 3,284 tests、68 focused、lint/type/build/assets、classic smoke/PWA、独自ナビE2E両幅、通常Island 10シナリオ、Island PWA 8経路、fixed-ten 80 runs PASS。
- 島の全成長巡回は既存の非表示通知の期待差でPARTIAL。今回のナビの合格と分けて保存した。
- 配置取消/保存の遷移競合と旧予約の報酬画面への更新割込みを、最終候補の実UIで再検証した。
- トップ追加修正: 固定v16候補で3,288 tests、72 focused、classic smoke 31、ナビ両幅、全モードの実active runからトップ復帰、classic/Island PWA、classic実二版更新がPASS。別作業の新地形の承認とは分ける。
- main反映前: v17のmainと統合して3,311 tests / core、配信構成のproductionナビ両幅、Island PWA 8経路・実offlineを再検証しPASS。
