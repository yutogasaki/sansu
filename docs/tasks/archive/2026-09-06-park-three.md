# Small Park Three.js candidate

## Goal
既存の制作・配置・試遊を使う3位置の卓上玩具候補を実装し、実画面で検証する。本番公開は行わない。

## Scope and SSOT
22仕様と2026-09-06のユーザー依頼本文。指定の26添付ファイルはworkspace/Downloadsで未発見。simulation、planner、保存schema、付与条件は維持。既存未コミット変更は保持。

## Plan
1. Three.jsモデルと時間ベースの演技を追加。
2. 既存stageにflag付きで統合、未対応・失敗時は旧表示。
3. phone/tabletの実画面を見て修正、A/B撮影・録画。
4. core、smoke、park、PWA回帰と監査記録。

## Progress
2026-09-06、ローカル候補として実装・検証完了。既存の制作・配置・試遊・学習復帰へ接続した。参照画像は art/park/reference/ref-01.png。今回の候補は参照未承認。公開反映・実機・子ども観察・最終美術承認は行っていない。

- 起動・変更範囲: [Three.js runtime](../../design/park-three-runtime.md)
- 実画面、A/B録画、測定条件・結果: [監査](../../design/audits/2026-09-06-park-three/README.md)
- 既存未コミット変更を保持。元の作業ツリーにコミットやpushは行わず、固定10問だけdetached worktreeの一致する検証用snapshotで実行。

- Review By: 2026-09-13

## Docs To Touch
22仕様、01親仕様、Three.js候補の実装記録、実画面監査、完了記録。

## Verification
verify:core PASS（104ファイル / 1,106テスト）、smoke 31、PWA update 4、park 6、park-PWA 3 PASS。Three.js両サイズ・A/B・lifecycle・失敗fallback・offline PASS。固定10問全4条件×10反復でevidence.eligible=true / pass=true。

Apple M4 Metal / Chromium / viewport emulationでBを各3回測定、約75fpsの描画更新。実機モバイルの30fps達成とはしない。詳細は上記監査のJSONと実画面へ集約。
