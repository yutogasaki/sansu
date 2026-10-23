# 監査指摘の修正

2026-10-21、利用者の「修正」依頼で、[チャッピー監査](../chatgpt-audit.md)の小画面2点を修正。

- 島名を空白で区切られた語の単位で折り返す。320pxでは「ふしぎな／しま」となり、末尾の「ま」だけを次行に残さない。長い語は枠内で折り返し、操作は従来どおりwrapする。
- 高さ660px以下の通常Island筆算では、既存の現在段の指示を商・被除数と一緒に固定する。用紙だけをスクロールし、指示と37・36・現在入力を同時に残す。指示の文言・採点・保存は変更しない。
- 固定表示用の指示は読み上げから除外し、元のlive領域で一度だけ伝える。通常高さや他モードでは元の指示表示を保つ。

愛着を保った小さい相棒と既存の入力反応を維持し、計算中に案内を探して戻る負担を減らす。新しい演出や入力待機は足さない。指示が残ることによる児童の独立理解・再訪効果は未評価。

## 実画面

- [320×568の余り入力](ready-320x568.png)：語の折返し、指示、37・36・入力、全キーを同時表示。
- [短い横画面](ready-568x320.png)：左の指示と筆算、右の全キー・支援を維持。
- [390×844](ready-390x844.png)：通常高さは従来の指示位置。
- [320×568の商入力](quotient-320x568.png)：指示、商入力、おろした37。
- [誤答訂正](retry.png)、[次の通常数値問題のヒント](hint.png)、[同じ問題の再開・reduced motion](resume-reduced.png)。後者2枚は筆算支援の証拠ではない。

DEV `/#/island`、Island=true / NatureTown=false、delivery `snap-root-v1`、candidate `pokomoko-pop-live-v8`、layout `header-companion-v1`。157÷6は隔離IndexedDBの明示fixtureであり、通常plannerによる選択や本番プロフィールの変更ではない。ローカルChromiumの証拠であり、公開版・実iPhone/WebKit・OS zoom・PWA更新・児童理解の合格にはしない。

検証の日時・対象ソースSHA・viewport・指示座標・44px操作とhit・入力前後は[browser-verification.json](browser-verification.json)、商の段階は[商の表示検査](quotient-verification.json)。raw実行ログとprobeは `output/learning-header-fix-20261021/`。実行開始と終了の対象ソースSHA一致を確認済み。固定指示が37を覆わないhit検査と「しま」の語の途中で改行しない検査もPASS。

全体コマンドの最終結果は[検証記録](verification.json)へ記す。共有dirty checkoutの結果であり、他作業を含むコミットや公開版の合格ではない。portalの別件は元の記録と分離する。

## 検証結果と残件

型・lint（既存警告4件）・Node22 build/assets・docsはPASS。Node22の対象5ファイル105件（初回タイムアウト2件を含む）と5 viewport検査もPASS。全体検証は651ファイル5,527件のPASS報告まで確認したが、別件の `authoredCoreGrowthIntegration.test.ts` が未報告のまま、共有手順の既定30分上限に合わせて停止した。全体suiteはPARTIAL、合格扱いにしない。残件はこの地形テストのNode22単独実行。

初回はNode24で全体検証を起動し、保存と学習進行の2件でtimeoutが発生したため中断。Node22の単独実行では双方PASSした。runtimeが原因だったと断定せず、両実行のrawログを保持する。指定Node22の全体再実行では停止時点まで失敗報告なし。製品コードは実画面検証時から変化していない。
