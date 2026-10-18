# 紹介ページの入り江画像 — 公開前の残検証

- Review By: 2026-10-25

## Docs To Touch

- `docs/design/2026-10-18-promotion-cove/README.md`：全体unitの完走結果。

## Verification

- `npm run test:run` の全体完走。実行時の版と入力を記録する。

## 現在地

2026-10-18。画像のローカル反映と紹介サイトの専用検証は完了。公開・pushは未承認、未実施。

[成果物・証拠・検証の詳細](../../design/2026-10-18-promotion-cove/README.md)。

- 必要な残確認：負荷の低い環境で全体 `npm run test:run` を完走する。今回の `verify:core` は141ファイルの通過後に停止し、全体unitの合格ではない。
- 通過済み：docs、入口guard、全体lint、typecheck、アプリbuild/assets、紹介サイトbuild、4幅の紹介サイト検証。関連入力を変更しない限りこれらを反復する必要はない。
- 独立した子どもの理解・再訪、実機、公開版の確認は未実施。静的紹介画像をゲームの完成・配布合格に読み替えない。
- 次工程を自動で開始しない。公開は人の明示承認を要する。
