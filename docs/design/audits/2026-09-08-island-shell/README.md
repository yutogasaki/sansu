# 島を中心にした共通画面

ユーザーの「しまとの整合がない、れんしゅうに行くとポッコになる、しまをメインに据えたい」に対応したローカル実装。親01・島28・UI07を先に更新した。

[変更前後と画面のつながり](review.html) / [全22画面](runtime/contact-sheet.html) / [実操作の報告](runtime/report.json)

## 実装

- Island有効時の共通ナビを「きろく／しま／せってい」の3項目にし、島に見える文字ラベルと黄色の主操作を付けた。
- 通常の `/study`・`/study?session=normal` は既存の `/island?start=learn` へ接続する。復習・苦手・テスト・教科指定・開発確認・未知のクエリは用途を捨てず、Studyで扱う。
- 設定・記録・別の遊びの一覧・専用Studyは島のクリーム地、青い輪郭と印、黄色の操作を共有する。ポッコのアイコン、空色〜金色の背景、赤い無記名FABを共通画面から除いた。
- phoneからtabletまで同じ構造。設定と記録の本文は最大600px、外枠は760pxとし、navにはsafe areaを含む専用領域を確保した。
- 別ゲームは島の「ほかの あそび」から選ぶ。Island無効時の従来導線と、明示した探索・遊園地・2人遊びは維持する。

学習・支援・配置・SRS・報酬計算の変更はこの作業に含まない。同じ作業ツリーで進んでいた連問・初回学習の変更を含む固定コピーで検証しており、その成果を本変更の実装として数えない。

## 対象の識別

| 項目 | 値 |
|---|---|
| 実画面の対象 | `http://127.0.0.1:5296`、固定production build |
| Build revision | `island-shell-local-20260908` |
| Build version | [version.json](version.json) |
| Flag / Island delivery | `VITE_ISLAND_ENABLED=true` / `mystic-island-v1` |
| 世界 / 学習 / 共通画面 | `mystic-island-procedural-v2` / `mystic-island-learning-v2` / `mystic-island-shell-v1` |
| 配色 | `moon-garden` |
| 画面 | 390×844、768×1024。音off、tablet reduced motion |
| キャッシュ | 実画面テストは新しい隔離browser context。SW offline/updateは別の実SW検査 |
| ソース | [build-source.json](build-source.json)。未commitの固定コピー。原本archiveは `output/island-shell/source.tar.gz` |

manifestのトップレベル `delivery` / `visualLineage` は既存Exploreの設定で、`snap-root-v1` / `pokko-field-v1` が残る。これをIslandの実候補と偽装せず、nested `island`、実世界と共通画面の属性を個別に記録する。公開URLへの反映や公開済み版の証拠ではない。

## 検証

| 検査 | 結果 |
|---|---|
| `verify:core` | PASS。146ファイル・1,702テスト、lint/typecheck/build/asset/docs |
| `e2e:smoke`（classic flag） | PASS、31シナリオ |
| `e2e:pwa-update`（classic build） | PASS、4経路 |
| `e2e:island-pwa`（固定production） | PASS、5保護経路と実SW offlineで回答・再開 |
| `e2e:island`（固定コピーのDEV） | PASS。新規登録、全学習形式、keyboard/touch、成長、配置、支援、WebGL復旧 |
| `e2e-island-shell.mjs`（固定production） | PASS。phone/tabletで各10回の保存状態照合、通常練習転送、専用学習保持、空profile、navの44px・hit検査、横溢れなし |
| `benchmark:island-fixed-ten` | 80 lanes完走、script PASS。phone/tablet各10反復・誤答各20。別作業との負荷重複があるため正式な公開速度認定には用いない |

通常の未送信の数字は従来から画面内の一時stateであり、退出後の保持を認定していない。保存済みの問題・cursor・筆算段・支援状態・ログ・報酬を照合した。PWAの保存hold検査の遷移先は、通常練習の新しい転送と混同しないよう `/stats` とした。遷移中の更新保留と保存解除後の更新を引き続き実際に確認する。

初回の作業ツリーsmokeは、他agentが新しいCSSファイルを書く途中に起動してimport未解決で失敗した。完成した固定コピーの全31ケースを再実行してPASS。これはアプリ動作の失敗や速度結果として流用しない。core開始時のコピー不足とtask見出し形式も修正し、最終coreを通している。

## 独立した判定

- **視覚的一貫性: 作者レビューPASS。** 添付の旧設定写真と、既存の[島runtime](../2026-09-07-island-loop/screens/critical-path-phone-home.png)を比較。設定・記録は情報を読む紙面、学習は同じ住民のいる島としてつながる。世界の新しい美術案ではなく、既存島への共通画面の統一。世界の魅力点を再採点して承認を水増ししない。
- **無説明理解・安全・再遊び: 未検証。** 子ども5人の独立観察と実機iOS操作は実施していない。作者のレビューや自動入力速度をその証拠としない。
- **Runtime: ローカル回帰PASS、公開用速度認定は保留。** 80 lanesの自動判定はPASSだが、別作業のブラウザ検証が一部重複した。独占条件を満たす正式な公開速度証拠としては扱わない。

公開・commit・pushはこの作業では実施していない。確認対象は保存した固定buildであり、並行作業で後から変わる作業ツリー全体の無条件な認定ではない。

## 反復測定の結果と限界

[全計測](checks/throughput.json) / [集計と作者の判定](checks/throughput-summary.json)。phoneの正解P95 194.4ms・誤答P95 195.1ms、tabletの正解P95 195.3ms・誤答P95 195.0ms。通常問と区間境界の追加操作0、全キー・空入力・原子的receipt・実候補・固定ソースの整合を確認した。Study比の処理量はphone 2.23、tablet 2.18。

scriptの `eligible=true / pass=true` はそのまま残すが、同時に別作業の学習/支援E2Eが走ったことを[プロセス観測](checks/timing-processes.txt)へ保存した。人が読む判定では競合負荷下の診断測定とし、独占環境での公開速度認定や子どもの解答速度・学力向上に変換しない。今回のローカルUI変更は、別途の固定productionでの往復・保存・PWA検証と作者の実画面確認をもって完了する。
