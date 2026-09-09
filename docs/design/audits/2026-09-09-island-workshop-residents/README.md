# 固定39：工作を住民と試し、途中で戻る

2026-09-09。**限定した実行・保存保持はPASS、視覚と無説明理解はHOLD／未検証**。[実画像6枚](contact-sheet.html)と[検証値・原SHA](verification.json)を保存した。仕様[37](../../../product/37_island_workshop_spec.md)の残る実経路を切り分けた診断で、全体の受入ではない。

## 実際に確認した範囲

固定39 production `http://127.0.0.1:5433`、revision `workshop-20260909-b3f96489e126`、source `b3f96489e126f2ed3f4465ae9beb4d28b4a5b32d8b5ad14bb2d09fccc432c33d`（1089入力）。実version末尾は `4f47503e-33f0-4488-aa48-4b335131c04d`、島候補 `mystic-island-shore-garden-v17`、島delivery `mystic-island-v1`、Island/BuildPlay両flag=true、Park renderer=legacy。version.json全体のdeliveryは `snap-root-v1` で、島deliveryと区別する。両幅とも実SW制御下だが、offlineや更新試験はしていない。

旧 `workshop-residents-02/phone-native.json` の保存7storeを元ID・A配置・予約のまま隔離環境へ明示復元した。旧profileは保存されていないためQA用profileを作成した。66問・16区間は旧記録の値で、今回の獲得や回答ではない。旧artifactを完全な旧DBと呼ばない。

phone 390×844通常motion／tablet 768×1024 reduced、音offで、カワウソのA実行→同じ選択の維持→明示停止→歩行中の住民変更・学習・退出による取消→実工房への復帰→reload→同予約の入力readyを確認した。新しい回答は0。

| 実描画の記録 | phone | tablet reduced |
|---|---:|---:|
| A実行の歩行frame数 | 49 | 6 |
| 最初の水流時の手とハンドル距離（scene座標） | 0.026764 | 約0 |
| resident phase | walking→contact→operating→watching | 同左 |
| しかけphase | flow→wheel→bell→end | 同左 |

初回の水流は同UUIDの住民がoperatingになった後で、元QAの距離上限0.045を維持した。これは描画後のactual診断であり、接点が何pixelに見えるかの証明ではない。同じカワウソを再選択してもwatchingを維持し、「とめる」でwaitingへ戻る現在の契約を実確認した。3種の全利用やB配置には拡張しない。

## 画像から残ること

終了像では住民と盤面の全体、みぞ・水車・貝が見える。一方、両幅の住民変更後と学習復帰後では、待機住民の足元が砂面から離れて青背景上に浮いて見える。接地が読める場面としてはHOLD。

**手が触れた瞬間とflow/wheel/bellの途中PNGは今回未撮影**。そのframeの実手座標・target・距離はverificationに分けて残す。終了姿を手接点や動く因果の画像として扱わず、旧版の接点PNGも固定39へ混ぜない。無説明の理解・安全感・再遊び意欲はHuman N=0。Source Aとの全体一致、全GoalはHOLD／ACTIVEのまま。

## 保存と終了

明示fixture投入後の全current17storeを22checkpointで厳密比較した。質問予約は元ID・revision0・cursor0を維持。**新しい作品保存・初観察/制作receipt・質問回答・実hidden停止は未実施**。写真storeは空で、非空画像bytesの互換検査ではない。正式速度検査やproductionの新規取得経路にも拡張しない。

session57176は終了コード0、05:11:49Z〜05:12:18Z。1089 source、QA/fixture closure、実served versionの開始終了一致、両contextとbrowserのawait終了、pageErrors0を確認した。サーバーを開始・終了していない。プロセス個別PIDの残存0まではこのrunnerで計測していない。

## 元FAILの保持

- 旧 `output/island-experience/workshop-residents-02/report.json`：同じ住民の再選択でwatchingからwaitingへ戻るというQA待機でFAIL。旧phoneの部分的な取得・利用と、今回の隔離復元を分ける。
- `output/island-experience/workshop-residents-nav39-01/report.json`：両幅とも正常な初期appData1行を空DB guardが拒否。fixture投入・controller開始前のQA不整合。原FAILを保持。
- nav39-02は `{id:'app',schemaVersion:1,activeProfileId:null,profiles:{}}` の1行だけをexact許可し、他store全空必須を維持した別QA。元ファイル・アプリは変更していない。

原出力は `output/island-experience/workshop-residents-nav39-02/`、実行QAは `output/playwright/island-renewal/workshop-residents-nav39-02.mjs`。各原SHAはverificationを参照。今後必要な接点の実画像・待機時の接地・残る有限matrixを、この限定PASSで閉じない。
