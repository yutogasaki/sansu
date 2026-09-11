# 家庭内本番用のmain統合候補

ユーザーのcommit/main push指示を受け、リモートmain `f4930b4` へ新島の実装だけを統合。既存の小数入力・配置操作・家/写真導線の7commitを保持する。共有checkoutの素材整理や別UI変更は含めない。

[入力manifest](source.json)のsource hashは `f529e95f58741bcb97651e620445c142ad410091cf70f3696d74e1eba2196896`。新島の実装は前回と同一で、Island.tsxの接続はリモートの最新版に適用した。[前回の家庭内準備](../household-production/README.md)とコミット予定の版の検証を分ける。

- [core](core.txt): 338 files / 3,607 tests PASS。接続時の旧ホーム非表示条件を最新版の条件へ組み合わせた後、Island.tsxのlint/typecheckとproductionの実一周も確認。
- [本番2幅](report.json): 実3問で6しずく、花を購入しreload、実SWのoffline回答/reloadで学習と所有保持。DEV時間送りなし。[phone](phone-offline.png) / [tablet](tablet-offline.png)。
- [速度](throughput.json): 80run、eligible=true/pass=true、正答/誤答/区間境界・追加操作0の全gate PASS。測定中の全入力hashを照合。DEVの固定問題測定で、実参加者やproduction速度とは区別。
- [旧島PWA](island-pwa.txt): 新flag=falseで旧予約の更新8件と実SW offline PASS。
- [smoke](smoke.txt): 31 PASS。[PWA](pwa.txt): 4 PASS。[実2build更新](two-build.json): 保護フォーム・保存・1回reload・旧SW復旧・offline保持PASS。

production targetは `http://127.0.0.1:5270`、VITE_ISLAND_ENABLED=true / VITE_ISLAND_LIFE_ENABLED=true / DEV=false。[version](version.json)のrevision自己申告はdevelopment-localで、source manifestがmainへの差分を識別する。画像のvisual candidateはisland-life-garden-v5。アートは前回のHOLDを継承し、子どもN=0。家庭内で所有物を空から始める承認に基づくリリースで、学習記録を削除しない。

## 旧島ハーネスの切り分け

リモートmainの旧島ハーネスは、ホーム上の成長ボタンを押す直前にメニューを開き裏に隠していた。また既に変更された「アルバムを とじる」などの名称を使用していた。[メニュー遮蔽](diagnostics/legacy-menu-failure.txt) / [実画面](diagnostics/legacy-menu-failure.png) / [旧ラベル](diagnostics/legacy-label-failure.txt)。アプリは変更せず、現行メニュー・戻り先・整数になる分数と筆算の入力順を認識する[QA overlay](diagnostics/legacy-qa-overlay.patch)で別検証する。[補正した検査結果](legacy-qa.json)はPASS（phone47/tablet50区間の実成長、WebGL障害からの学習復帰、初回導線、8入力構成）。overlayは別ディレクトリで実行し、本コミットで既存の旧島ハーネスを置換しない。通常の実学習からの獲得・native保存の照合を維持する。
