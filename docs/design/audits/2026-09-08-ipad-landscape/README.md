# iPad横向きの問題画面

横向きで問題・支援を左、解答欄・テンキー／選択肢を右に置く。進捗と回答表示を上段、ヒント／次へ進む操作を下段に確保し、残りの高さを問題へ割り当てる。数字キーの44px以上のタップ領域を保つ。

- [実画面一覧](contact-sheet.html)
- [20ケースの測定](report.json)
- [固定build・画像のSHA-256](artifact.json)

## Scope

今回の実装は `IslandLearningPanel.css` と `IslandAnswerForm.css` の横向き配置。画面全体を縮小したり、はみ出した入力を切り取ったりせず、利用できる横幅と高さで配置する。出題・採点・保存のロジックは変更していない。

最終画面には、並行作業の学習集中表示（学習中は島を非表示）と筆算の方式切替を含む。これらを撤去せず統合して確認した。修正前の画像は初期のCSSによる再現例で、現在の検証用プロフィールとは問題が異なる。

## Target

- ローカルのproduction preview: `http://127.0.0.1:5591`
- Build version: `development-local:a07bca9a-ac1f-42e9-926e-5400b5a2900a`
- Revision: `development-local`。Gitコミット同一性の証拠には使わず、固定配布物の全ファイルSHA-256を `artifact.json` に保持する。
- Flag: `VITE_ISLAND_ENABLED=true`
- Delivery: `mystic-island-v1`
- Visual candidate: `mystic-island-living-v5`
- Learning candidate: `mystic-island-learning-v2`
- 新しい隔離プロフィール／memory fixture。実plannerの予約・実入力・実writerを使用。
- Service workerはblock。公開先・iPad実機Safari・インストール済みPWAの確認ではない。

## Verification

`node tools/e2e-island-landscape.mjs` を上記固定buildへ実行し、ChromiumとWebKitの各10ケース、合計20ケースがPASS。WebKitはreduced motion、両方ともsound offとtouchを使用。

- 1024×640で整数・数図・十進図・小数・分数・従来の筆算・掛け算筆算・割り算筆算・大小比較・英語を確認。
- 同じ出題のヒント、実回答、誤答からの再入力、お手本、次問への続行を確認。
- 1024×600、1024×768、1180×820、1366×1024、768×1024、390×844へ回転・resize。下書きと予約Problemの保持を確認。
- 横向きのページ／問題のはみ出し、全数字・訂正・決定・カーソル・入力欄・支援操作の表示領域内の実hitと44px以上を検査。お手本では入力キーを隠す既存契約に従い、続行操作の可視性を確認。
- 118枚を生成し、代表12枚と修正前1枚をこの監査に保存。全raw captureは `output/playwright/ipad-landscape/final/`。

品質検査:

| 検査 | 結果 |
|---|---|
| `npm run docs:check` | PASS。既存の見直し期限のWARNあり |
| `npm run lint` | PASS。既存 `IslandMilestone.tsx` のFast Refresh警告1件 |
| `npm run typecheck` | PASS |
| `npm run test:run -- --maxWorkers=2 --minWorkers=2` | 234ファイル、2,580テストPASS |
| `VITE_ISLAND_ENABLED=true npm run build` | PASS。assets:checkもPASS |
| `git diff --check` | PASS |

共有workspaceの初期検査中は別作業の編集途中の型／lintエラーがあったが、最終検査では解消。通常並列の全体テストでは既存の学習進行integrationが15秒timeoutとなった。assertionとtimeoutを変えず、並列数2で全2,580件を再検査して通過した。初回と最終のログを `output/playwright/ipad-landscape/` に保持する。

## Separate gates

- **見た目:** 作者による実画像確認で、問題と入力の区別、キーの欠け・重なりの解消を確認。世界の美術や継続意欲の新しい承認は扱わない。
- **理解・安全:** 操作の可視性、44px以上、音off、reduced motion、回転時の下書き保持を確認。独立した子どもの観察は未実施。
- **Runtime:** このレイアウトの20ケースと品質検査はPASS。実機・PWA更新・速度測定・他の並行機能全体の公開認定は含めない。

ローカル修正として完了。commit・push・deployは行っていない。
