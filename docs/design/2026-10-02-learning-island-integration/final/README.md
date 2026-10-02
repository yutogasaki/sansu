# main統合の最終確認

2026-10-02。学習の見通し/仕上げ後の進級、島のバランス、家/共有メニュー、ポケットメニューを統合し、main反映に向けて固定indexを確認した。最終対象の機能チェックはPASS。実機・子どもの理解/定着・公開URLの確認とは分ける。

## 対象を固定し直した理由

最初の候補は基点 `5987adee`、index `0cf5deeb4688`。[9検査の結果](../latest/README.md)はcore4,593 tests、仕上げ14、メニュー4サイズ、家2・バランス4・案内6・本番保存両幅・navigation両幅・classic31件がPASS。途中のbalance中断は元記録を保持して再開した。

最終照合前に、別作業で通知→記念と本の主操作を修正した `5defcb1c58f763a638f6562f970d2edcbc4f2eb0` がmainへ到着。古い候補を新commitのPASSとして扱わず、基点5defcb1cと残っていたreviewed indexを `/tmp/sansu-final-main.1n0u2l8f` へ再exportした。最終app treeは `806d1dc17f5629f8a4ee84195ca7a02c6828c204`。[candidate](candidate.json)。

[前候補から変わった入力](verification.json)はIslandの案内の表示/入口とそのQA。出題/仕上げ・バランス/保存規則・shared route/layout・classicは変更なし。そのため仕上げ/バランス/navigation/classicの結果は入力範囲を確認して保持し、全coreと影響する家/案内/メニュー/本番保存を再検査した。後続の2模型メニューなど未ステージの変更は含めず保持。

## 最終候補の検査

| 検査 | 結果・証拠 |
|---|---|
| docs・入口guard・lint・typecheck・全test・build/assets | 518ファイル/4,599 tests PASS。[core](../final-core.log) |
| ポケットメニューの全旅程 | 4サイズPASS。各入口/トレイ/詳細/設定/記録/家/学習、全数字、44px/overflow、Escape/focus、0/8人。[report](pocket/report.json)、[log](../final-pocket.log) |
| 家の本の直接入口/任意目標/live記念/学習への復帰 | 両幅PASS。実別タブの保存反映と実3回答。[report](house/report.json)、[log](../final-house.log) |
| 案内S1〜S5/A1〜A6/通知→記念 | 両幅6ケースPASS。初回実操作、保守的な旧保存、豊かな資源のfixtureを分ける。[report](guidance/report.json)、[log](../final-guidance.log) |
| 本番形式の実SW offline/reload | 両幅PASS。注入なしの実初回/5回答/有料種/本、同じ予約/所有/残高/記念を保持。[report](production-guidance/report.json)、[log](../final-production-guidance.log) |

[接触シート](screens.html)は実target/revision/delivery/candidate/flagを各reportに結び、DEVのfixtureと本番形式の本人の列を分けた。[前候補の仕上げの実20問→保存済みLv17→次の学習](../latest/screens.html)は変更のない学習部分の証拠として保持。

育つ島DEVは5283、production previewは5284。revisionは `main-integration-806d1dc17f56`。本番形式のflagsはvercel.jsonと一致。[versionと判定/入力照合](verification.json)。app/build/QAの開始終了SHAとdist SHAが全て一致し、持ち出した最終commitの入力とも照合する。[app](app-inputs.json)、[dist](dist-inputs.json)。DEVは専用cacheDirだけを上書きした[wrapper](vite-wrapper.txt)。[順次実行](sequential-runner.txt)。

## 修正と判定

今回のQA修正は「しまの そうさ」を開く実UI拡張helperと、旧正本から現行guidedIslandsへ読む場所の更新。学習条件・価格・保存schemaの新しい変更はない。初回候補からの検査履歴と既存警告はそのまま残す。

- **実装整合**：対象の機能/保存/routeの範囲PASS。最終indexの持ち出しdocs checkとapp/QA入力一致をcloseoutで記録する。
- **見た目**：作者が実menu・本・仕上げの現在/次Lvと進級結果を確認。新美術の公開認定や世界最高の評価はしていない。
- **子どもの理解/安全・学習効果**：実参加者N=0。無説明理解・戻りたくなるか・定着への効果は未確認。
- **実機/配信**：実iPhone Safari/PWA・公開URLの既存の子の引き継ぎ・実音/GPU・実two-build更新は別確認。main pushだけで本番動作PASSとはしない。

仕様の追加変更は不要。既存実装の統合とQAの現行化・検証証拠の持ち出し保証が目的。検証中の別作業の未ステージ変更は今回の内容へ帰属させない。

最終closeout：持ち出したindexのdocs checkはPASS、テストしたapp/build/QA1,770入力との差分0、検査中のindex変更0。[照合](commit-input-check.json)、[文書検査log](../final-docs-portable.log)。その後に加えた内容はこのcloseoutと照合記録のみ。
