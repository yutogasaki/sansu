# 差分から検証を選ぶ

## Purpose

`npm run verify:plan` はGit差分を読み、[検証マトリクス](../ai/verification_matrix.md)の必要コマンド、手動確認、注意事項と関連する仕様を表示する。毎回の検証選びの手間を減らし、保存・ルーティング・PWAの確認漏れを見つける。

## Contract

- 既定はHEADに対するステージ済み/未ステージ差分と未ignoreの新規ファイル。`--staged` はコミット対象のみで、マトリクス/package/関連仕様もindexの内容を参照する。`--base REF` は解決したcommitに対する作業ツリー差分と新規ファイル。削除も含め、renameは旧/新パスの両方で分類する。ignore対象は含めない。
- パスは分類の手掛かり。複数の分類が一致したらすべてを適用し、必要コマンド・手動確認・注意事項を検証マトリクスから読む。分類理由と対象ファイルも表示する。本文や実行時の影響は判定できないため、挙動を変える仕様変更、画像主体の体験、実リリースにはマトリクスの追加行を担当者が適用する。
- 保存・PWA・ルーティングを高リスクとして表示する。既存のclassic/Life専用コマンドは対象/flag注意事項と一緒に表示し、Growing検証へ置き換えない。画像/3Dの変更は実画面の独立ゲートを案内する。
- 未分類は `verify:core` と担当者による分類確認へ倒す。必要なマトリクス行、npm script、関連仕様がなくなった場合は失敗する。空差分はチェックを提案しない。
- 重複コマンドをまとめる。package scriptの明示的な `&&` 列内の独立した `npm run` 呼出だけを追跡し、`verify:core` 等に含まれるチェックは「内包」と表示する。任意のshell構文や条件式を同等と推定しない。対象限定テストと手動確認は省略しない。
- Git、マトリクス、package、仕様の読取のみ。検査・build・保存の書込・外部操作はしない。出力はADVISORYであり、検査合格/公開可能を意味しない。共有ツリーの案内をコミット対象の案内と混同しない。

## Usage

```bash
npm run verify:plan
npm run verify:plan -- --staged
npm run verify:plan -- --base origin/main
node tools/verification-plan.mjs --staged --json
```

`--staged` と `--base` は同時に使えない。`--json` は機械可読形式。npmのbannerを含めずJSONだけを使う場合は上記のnode直接呼出を使う。必要なチェックは別途実行して結果を記録する。

## Verification

削除・rename・新規/ignore・stage境界・基準refを実Git fixtureで確認する。混合差分、高リスクの重なり、未分類、重複/内包の整理、マトリクスの変更追従/欠落拒否を回帰テストで検査する。このコマンド自身の変更は「Verification tooling / test harness」行を適用する。
