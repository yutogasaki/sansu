# S-002 検証と残課題

日時: 2026-10-15T17:04:29.989563+00:00。対象: ローカル内部ポータル。HEAD `8f8641d1bcfce98b9454288d8a848e3925e98a6e` ＋既存のdirty入力。アプリ配布・公開の合格ではない。

現在の統合候補: `3b4eae9feea96513203febd71230ae6d33128b577f1915ae5b458e6c318fa1d2`。入力hash・各コマンドの取得日時・期待/実結果・原log SHAは checks.json。

| コマンド | 結果 | 秒 | 原log |
| --- | --- | --- | --- |
| `npm run docs:check` | PASS | 0.65 | [log](logs/docs-delivery.txt) |
| `npm run lint` | PASS | 27.35 | [log](logs/lint-closeout.txt) |
| `npm run typecheck` | PASS | 0.96 | [log](logs/typecheck.txt) |
| `npm run test:run` | PASS | 811.09 | [log](logs/tests.txt) |
| `npm run build` | PASS | 30.64 | [log](logs/build.txt) |
| `npm run portal:verify` | PASS | 6.15 | [log](logs/portal-closeout.txt) |
| `npm run agent:index:check` | PASS | 7.08 | [log](logs/agent-closeout.txt) |
| `npm run check:current-ui-entry` | PASS | 0.31 | [log](logs/current-ui.txt) |
| `node tools/check-internal-portal.mjs` | PASS | 4.0 | [log](logs/internal.txt) |

test:runは622ファイル・5,379テストPASS（約811秒）。アプリ・S-001のテストは変更していない。lintは既存のFast Refresh警告3件、エラー0。buildは成功し、PWA precache 8.51MiB / 12MiB。アプリ変更がないため別のPWA受入を主張しない。

旧7ページの15,488要素（順序・全文・非URL属性）と、17,967内部リンク/アンカーを機械照合。資料の到達性、両層の入力一致、表面の生ID/パス/hash禁止、候補不一致、全CSS保持、欠損/余分/素材SHA/symlinkの検査を維持。

旧5,328構造項目＋150 CSS規則＋9 responsive条件＋8操作仕様＝5,495項目を静的に充足。操作仕様の移行コードは保持したが、実表示・操作は未受入。旧HTML全7枚は凍結baselineと完全一致。保全87ファイルのSHAは不変、vendor変更なし、stagingなし。

## 未確認とブロッカー

- 独立したheadless ChromiumがMachPortRendezvousのPermission deniedでページ起動前に停止。Playwright WebKitもAbort終了。4幅、検索/Enter操作、実画像の見た目・横溢れは未確認。browser.jsonに記録。スクショ生成0、本作業の残存0。個人Chromeは利用していない。
- hubの固定standard verifierは拡張版を拒否する（2置換・2,152追加）。集約は初期コピー以外のHTMLを追うが、script/CSS/ダウンロード素材を同じまま配布できる受入仕様ではない。hubは読み取りだけ。公開前にPM側で、検査を弱めない拡張の受入・全ファイル保持を整える必要がある。
- sipsのready.webp→WebP書出しは終了13を再現。元画像の破損ではなく、WebP writer非対応のエラー。ローカルbuildは元バイトのコピーなので不要。hubは他allowlist repoのsharp fallbackも持つため、公開時の実選択は別検証。
- 約1.61GiB（論理容量）の元素材・記録を自己完結して保持した。アプリ配布容量や公開予算の受入ではない。

## 文書の整理

内部ポータルの正本 docs/portal/README.md とadapter入力だけを更新。製品仕様・保存・学習・ルーティングは変更なし。保全対象の共有キュー・runbook・検証matrixは編集しない。タスクの完了記録は本証拠と指定inboxメモ。
