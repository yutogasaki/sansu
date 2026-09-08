# 初回の短い達成と通常の連続学習

- Date: 2026-09-08
- Status: 学習導線の実装・runtime検証完了。作者の視覚留保と子ども観察N=0は継続
- Source: [親仕様](../../../product/01_app_spec.md)、[島仕様](../../../product/28_mystic_island_spec.md)
- Task: [学習と島の楽しさをつなぐ体験改善](../../../tasks/active/2026-09-07-experience-improvements.md)

初回の必要設定後は直接最初の問題を開く。新しい島の最初の予約は3問とし、最初のおくりものは受取・配置を後に回せる。その後は通常の3/6問の区切りをまたいでも追加操作を要求せず、自動で次の問題を開く。任意に島へ戻って、保存されたおくりものを選べる。

今回の到達範囲は、この基本の強弱である。初回報酬は1回で、選択肢の花・灯りは初期所有と同種のため、新しい遊びが必ず連続して生まれる導入にはまだなっていない。住民ごとの好みで置いた家具を使う案、異なる発見が続く導入、長期の変化は次の課題として残す。

## 固定候補

| 項目 | 値 |
|---|---|
| HEAD | `0ea5c56` |
| revision | `0ea5c56-learning-rhythm-eb5f5a06103d` |
| version | `0ea5c56-learning-rhythm-eb5f5a06103d:10ddbbd7-5b85-414d-a3e4-cab5a7167c8f` |
| 実target | `http://127.0.0.1:5430/` |
| flag | `VITE_ISLAND_ENABLED=true`、`VITE_BUILD_PLAY_ENABLED=true` |
| Island delivery / world / learning | `mystic-island-v1` / `mystic-island-procedural-v2` / `mystic-island-learning-v2` |
| 共通shell | `mystic-island-shell-v1`。並行作業のナビゲーション・ホーム説明整理を含む固定入力 |
| 配色 | `moon-garden` |
| 固定入力 | app 632、原QA 62。追補後QA 63。全app入力をcore後・最終検査後にも照合 |
| 原manifest | `output/playwright/0ea5c56-learning-rhythm-eb5f5a06103d/build-source.json` |

原reportと実行ログは同じ出力ディレクトリに保存する。ソースの展開コピーは `/tmp`、入力archiveと固定artifactは `output/builds/experience/` に置く。各実行の外側runnerでapp/QA入力の開始・終了と、productionの実versionを照合する。失敗したreportを上書きせず、QAだけを直す場合も変更した入力を別に記録する。

## 検証状況

- `verify:core`: PASS。147 files / 1,720 tests、docs、lint、typecheck、build、assets。
- Domainの重点検査: 初回3問、既存の初回6問予約維持、通常3/6問の自動予約、最終回答の再送、古い非最終receiptの再送、次予約だけの実DB失敗と再試行、回答保存のrollback、支援完了、transaction間のactive profile変更。
- 実画面の主経路と保存検査は以下のとおり。同じapp 632入力・同じproduction versionを各runnerの開始/終了で照合した。配置・共有遊びを含む回帰まで完了。旧3ddのPASSをこの候補へ転記していない。

| 検査 | 結果 |
|---|---|
| 実設定→初回3問→通常の自動継続→任意帰島/再開 | 2経路 / 14画面 PASS |
| 初回予約・次予約のnative transaction abort / retry | 2経路 / 6画面 PASS |
| 初回設定・全教科分岐・保存失敗/再送・追加プロフィール | 6経路 / 49画面 PASS |
| 数字・選択・分数・筆算・英語・表示復旧 | 23経路 / 139画面 PASS |
| 段階支援と支援完了 | 9経路 / 45画面 PASS |
| 誤答後の独力再確認・英語Due巡回 | 4経路 / 24画面 PASS |
| 実DOMと学習観測eventの整合 | 2経路 / 11画面 PASS |
| 実獲得・受取・配置・住民利用・再学習の主経路 | 2経路 / 16画面 PASS |
| 6家具の獲得・drag/回転/取消・保存/reload・再学習 | 2経路 / 60画面 PASS |
| 自由遊び・住民別の反応・学習復帰 | 2経路 / 44画面 PASS |
| 家具の実獲得から再学習まで | 2経路 / 20画面 PASS |
| 東土地の住民移動と学習復帰 | 2経路 / 18画面 PASS |
| 歩行/着座直前の編集・別画面変更・最新招待・移動中の学習 | 5条件×2画面幅 / 20画面 PASS |
| 花・星・水玉の共有遊びと再演・取消・表示復旧・再学習 | 2経路 / 88画面 PASS |
| 共通shell・記録/設定・通常練習リンク・保存と再読込 | 2画面幅×10条件 / 22画面 PASS |
| Island PWA | 更新保護5条件と実service workerでのoffline回答/再開 PASS。通常の区切りではreloadを保留し、任意帰島の後に回答・報酬・次予約を復元 |

障害回復の最初の試行は、検査コードが最後の問題を数値入力と仮定していたため、実際に出た選択問題で停止した。raw FAILは `rhythm-recovery/` に残し、実予約の正しい選択肢を押す対応だけを加えた `rhythm-recovery-v2/` がPASS。appは変更せず、QA追補manifestは `output/experience-integrations/eb5f-rhythm-recovery-qa-v2/build-source-with-qa.json` に保存した。

ホーム回帰の最初の試行は旧ラベル「ふしぎな しま」を探して停止した。この固定候補には並行作業の共通shellが入り、実ラベルは「しま」である。app全632入力の一致を再確認し、検査側だけを「メインメニュー」内の「しま」へ限定した。raw FAILは `home/` に保持、`home-v2/` は2経路 / 10画面PASS。追補manifestは `output/experience-integrations/eb5f-home-navigation-qa/build-source-with-qa.json`。以前の回復・区切り計測QA追補も連鎖して記録し、appは変更していない。

共通回帰は同じapp入力から対応flagで別buildを作り、Island DEV 11経路 / 53画面、Park DEV 6経路、Park PWA 3条件と実offline、筆算13経路 / 24画面、smoke 31、classic PWA 4がPASS。各variantのversionは `park-build/`、`classic-build/` と各runnerに保存した。DEV実配信定数は `regression-dev-targets-start.json` / `regression-dev-targets-end.json` が一致。classic/Parkの結果をIslandの見た目の合格には使わない。

固定10問は「初回を終えた島」という明示的な隔離fixtureを使う。通常6問目の回答から次予約1問目の入力までを計時し、650ms基準の分母へ含める。区切りだけも各画面幅20件以上でP95≤650msを判定する。phone/tablet各10反復、同問誤答の550ms、追加操作0、自動報酬面0、実receipt照合を必須とする。旧測定は6問後に続行操作1回があり、新基準へのPASSではない。

区切り専用P95条件は正式測定を始める前に追加した。実行するQAの追補manifestは `output/experience-integrations/eb5f-formal-boundary-qa/build-source-with-qa.json`。DEVは同じapp入力の `http://127.0.0.1:5431/`、実version `0ea5c56-learning-rhythm-eb5f5a06103d-island-dev:cc4d9116-36a8-4a05-a5f6-18eaa656f39a`。実配信されたDEV定数とflagを記録し、productionの `/version.json` と混同しない。

正式測定は80 runすべてPASS、`evidence.eligible=true`。原reportは同じ出力先の `island-throughput.json`。app/QAソース、実DEV定数、報告versionが開始/終了で一致した。全体の正答200件、同問誤答20件、区切り20件を各画面幅で集計した。

| Chromium viewport | 正答→入力 P95 | 同問誤答→入力 P95 | 区切りだけのP95 | Study比の自動操作throughput |
|---|---:|---:|---:|---:|
| phone 390×844 | 194.9ms | 194.3ms | 195.4ms | 2.343 |
| tablet 768×1024 | 195.9ms | 195.2ms | 196.4ms | 2.234 |

区切りを含む追加操作0、自動報酬面0、前問入力の持ち越し0、ブラウザ例外0。従来の全体650/550msに加えて区切り専用650msも通過した。Study比は固定問題を自動キー操作した速度であり、子どもの思考速度や学習効果の倍率ではない。初回は別の実設定検査、通常plannerの問題真正性は全入力・支援・再確認の検査に分ける。

## 学習の入口・再開の補測

phone/tablet各10回、毎回新しいbrowser contextで実際に小学1年・算数・足し算までを設定し、本物の初回予約から1問を解いて、中断・同じ予約の再開・新文書reloadまで確認した。計20プロフィール / 60測定すべて操作・保存・識別検査PASS。通常のplannerを使い、問題・回答履歴・時計は注入していない。原reportは `entry-timing/report.json`、追補manifestは `output/experience-integrations/eb5f-entry-timing-qa/build-source-with-qa.json`。

| 起点→入力可能 | phone P50 / P95 | tablet P50 / P95 |
|---|---:|---:|
| 設定の最後の範囲選択 | 353.8 / 426.8ms | 353.4 / 356.1ms |
| ホームの再開操作 | 41.2 / 53.1ms | 52.4 / 65.6ms |
| 新文書reloadのnavigation start | 350.2 / 360.3ms | 355.1 / 383.1ms |

設定・ホームは実trusted clickから、同じbrowser clockで実問題の有効な入力controlとinput-readyを最初に描画frameで観測するまでを計測した。Playwrightの事前待ち、DB照合、撮影は計時へ含めない。設定前の説明・選択にかかる本人の時間を含む値ではない。ホームは開始1操作、その他の追加操作は0。reloadは追加操作なしで同じ問題・cursor・実回答ログを復元した。

新文書reloadは同一contextの通常cache・service worker無効の条件であり、端末cold launchやインストールPWAとは異なる。後者の保存/更新は別のPWA検査で扱った。各frame間隔と観測導入時刻をrawに残す。初回へ650msの問題間閾値を転用せず、時間は分布として報告する。合否は保存・操作・測定手順・同一ソースに対する判定である。

最終的に `current-workspace-source-end.json` で現在のapp632入力・追補後QA63入力の全バイトと新規/欠落pathを照合し、26本の成功runner、正式測定eligible、入口60測定を集約した。原失敗2件を残したまま、現在の固定候補の成功証拠を区別している。

## 別々に判定する項目

最新の実画面は[画面比較](contact-sheet.html)にまとめた。原SHAと複製SHAが一致する41枚を使い、rhythm 14枚、別プロフィールの初回設定15枚、別の実獲得経路8枚、承認benchmark 4枚を分ける。実獲得経路の先頭は受取確定前の報酬選択面であり、最初の3問と同一プロフィールの連続記録にはしない。onboarding原captureにないviewport/learningCandidate等は欠測とし、scenario寸法・別添build値を個別captureの実測値として補わない。

静止画比較では、数字・筆算・テンキーのはみ出し、住民の耳/足の見切れ、報酬数と帰島操作の重なりは見つからなかった。初回報酬の3選択と「つづけて とく」、帰島後の再開・報酬が同じ世界と配色で読める。拡張後のphoneホームでは全島を収めるため島が小さくなる。これは作者の画面評価であり、魅力の最終GOや無説明理解のPASSではない。

6家具が密集したphoneの再学習画面では、後方ウサギの下半身と座面が前方のブランコ・灯りに重なり、中央手前のカワウソも背面向きで、体と表情を読む力が弱い。今回と旧 `84d3ddf-experience2-3ddcac1103f0` の `3d/phone-six-earned-return-learning.png` を実画像で比較すると同じ弱さがあり、今回増えた遮蔽は見つからなかった。入力領域への侵入や画角外での切断とは別の、既存の視覚課題として残す。

子どもの無説明理解・自発的再遊び・学習の定着は人の観察へ分け、作者や自動操作から推定しない。現時点の実参加者はN=0。人数を多く集めることを前提とせず、[1人用の観察](../2026-09-07-single-child-study/README.md)で進める。

実行端末はChromiumの390×844・768×1024 viewportであり、実機の速度・インストール・翌日の利用を測ったという意味ではない。エラー注入は明示した診断だけに使い、通常速度の測定へ混ぜない。
