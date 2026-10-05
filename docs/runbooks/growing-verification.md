# 育つ島の検証入口

## Purpose

`npm run verify:growing` は、現在の作業ツリーから隔離した候補に対して、core、classic回帰smoke、Growing本番形式の学習/購入/本/保存/実SW offline旅程を順に実行する。各検査のログ、候補の入力hash、実version、runtime identity、画面、結果を一つの新規出力へ保存する。

## Contract

- Git管理対象と未ignoreの新規ファイルを一時ディレクトリへコピーする（rootの`.env*`は除外）。未コミットの変更も含む。開始/コピー完了時に入力hashを照合し、コピー中の変更は失敗とする。全入力のhashと、root設定/src/public/toolsおよび参照されるassets内JSONのbuild入力の圧縮コピーを保存し、終了時に隔離候補の入力とdistが不変であることを確認する。
- `node_modules` は既存のローカル依存を使う。`npm ci` 済みであることが前提。lock hashとNode版を記録する。rootの環境ファイルは取り込まず、継承したVITE/SANSU変数を除去し、Growing/Island/Life/FantasyをON、DEV preview/Nature Town/DiscoveryをOFFに固定する。
- 開発サーバーや共有distを使用せず、隔離候補をbuildし、空きloopback portでpreviewする。URLのversionと候補distのversionを一致させる。新規ブラウザーcontextのみを使い、実利用者の保存や本番URLへ触れない。
- 子検査は順次実行する。最初の失敗で後続を止め、失敗ログとreportを残し、サーバーと一時コピーを片付ける。既存の出力を上書きしない。
- `checks: PASS` / exit 0 は組み込まれた自動検査の合格だけを表す。公開判定は常に `PARTIAL` とし、実Growing two-build更新、中断復旧、旧writer/rollback、既存利用者の実保存、本人切替の故障診断、実機、視覚/無説明理解/翌日の再訪は未検証項目として残す。旧Life/classic更新のPASSをGrowingへ流用しない。

## Usage

```bash
npm run verify:growing
npm run verify:growing -- --output-dir /absolute/path/to/new-output
```

既定出力は `output/verify-growing/<時刻とUUID>`。`report.json` と `summary.md` が入口で、各stepの `*.log` と子旅程の `report.json`/画像を参照する。出力には隔離プロフィールの診断保存とソースが含まれるため、公開成果物にしない。

## Verification

runnerの回帰テストは、環境の混入防止、コピー中/検証中の変更検出、子reportの偽合格拒否、失敗時の停止を検査する。入口自身の確認は本コマンドを実行して、実buildと本番形式のGrowing旅程を確認する。公開時は[検証マトリクス](../ai/verification_matrix.md)と[公開チェックリスト](release-checklist.md)の追加項目を適用する。
