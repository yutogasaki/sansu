# 全画面レイアウト戦略の実装

Status: Complete
Owner: Codex layout thread
Started: 2026-09-09

- Review By: 2026-09-16

## Docs To Touch

- Product specs 01, 07, 43, 44
- Documentation index and layout verification evidence

## Goal

ユーザーが承認した比較提案を[仕様44](../../product/44_display_layout_spec.md)として実装。島・問題・一覧・編集・思い出・管理の主役を一致させ、戻り方と保存を保つ。

## Ownership

- Root: Island.tsx配置、IslandHomeActions、IslandStageのカメラ入口、IslandShell/PokomokoWorld/shared utilityの配置CSS、SSOTと統合検証。
- utility_layout: Settings/Statsと専用CSS。
- learning_layout: IslandLearningFocus/Panelと専用CSS。
- island_panels: IslandItemsのInventory/Placement、IslandAlbumと専用CSS。
- 他スレッドの3D変更は c8a1801 でmainへ統合済み。引継ぎ後、縦phoneの通常home fitのみ本作業で調整し、他の3D変更を維持。

## Verification

統合候補を固定してdocs/lint/typecheck/unit/build、smoke、navigation、layout、island learning/throughput、PWAを確認する。新旧のlayout画像・実際のbuild/candidateと記録を残す。実機・独立参加者は別判定。

## Progress

- 2026-09-09: 比較資料を採用し、SSOT・目的別の全画面レイアウトを実装。
- 最終v5でcore3,376 tests、home4幅、nav2幅、workspace36画面、背景保存と学習再開2幅、PWA8・実offline、固定80runがPASS。v4の全成長11シナリオ/113画面・全形式20・classic回帰は版を分けて保持。
- [実装画面・検証と範囲](../../design/audits/2026-09-09-display-layout/README.md)。人による理解観察はN=0。学習・保存・成長のデータ契約を保持。
