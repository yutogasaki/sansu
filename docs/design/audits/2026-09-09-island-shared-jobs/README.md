# 共有仕事: phone 復元診断09の限定監査

**3仕事・本人配置3回・運搬の記憶再訪1件は限定PASS。真正新規fullとGoal全体は未完了。** `diagnosticPass=true`、`report.pass=false` をそのまま保持する。後者は新規獲得・両幅fullの合格へ拡張しないための値である。

[原PNGのコンタクトシート](contact-sheet.html) / [検証・SHA記録](verification.json)

## 実対象とデータの由来

- 実target: `http://127.0.0.1:5292`、revision `nav-v17-main-candidate`、candidate `mystic-island-shore-garden-v17`、Island delivery `mystic-island-v1`。保持元Gitは `8e366127e6c07105972fe1410386af4eb883105b`。
- 元アプリ963入力、配信dist151ファイル、QA09の4入力を開始・終了時に照合し不変。source SHAは `d2b44e9f066784d5547d792a9d6a377981e5d1962f1b94341e836e465c5714ba`。配信設定は Island enabled、Park enabled / renderer `three`。今回触ったのはIslandであり、Park実画面やclassic版の検証ではない。後発のheader39とは別対象。
- 元03は空DBから実63回答・15区間、東解放、3標本の実洗浄・観察まで進んだが、最初の住民selectorで全体FAIL。その原native 17storeを今回の隔離contextへ完全復元した。**復元後の選択・移動・仕事・保存は実UI。今回新たに63回答した証拠ではない。**
- Phone 390×844、touch、通常motion。SWはallow、入口でcontrolledを確認したが、offline/updateの試験はしていない。セッション45258はterminal 0、context/browser終了。並行タスクが保持する5292サーバは変更・停止していない。

原データ: `output/island-experience/shared-jobs-nav38-03/phone-failure-native.json`。実行正本: `output/island-experience/shared-jobs-nav38-diagnostic09/report.json`、`local-verification.json`。QA凍結: `output/island-experience/shared-jobs-nav38-qa09/build-source.json`。

## 通過した実操作

| 操作 | 本人が選んだ配置・向き | 実証 |
|---|---|---|
| カワウソの運搬 | (-3.05, 0.65)、0 | 同じ物を両手で持ち上げ、運び、台へ置いて手を離す。115実frame、表示後の結果・記憶保存 |
| ウサギの花並べ | 本人が手前へ2回 → 明示配置、(-3.05, 1.15)、0 | 3枚の異なる花の接触・配置、お返し。322実frame、表示後の保存 |
| キツネの照射 | 本人が奥へ2回・回転2回 → 明示配置、(-3.05, 0.65)、π | 灯り取得、実光源→表面→受け面のshadow。373実frame、表示後の保存 |
| 運搬記憶の再訪 | 本人が回転2回 → 明示配置、向き0へ戻す | 今回実保存した同じ運搬記憶を選び、同じながれぎと休む。firstAt/orderを含め全store不変 |

全17storeの比較11回を通過した。試用と記憶再訪は全体不変。仕事の保存は既存sharedの状態・receipt/event・revision/timeに限り、学習計画・回答・記憶学習・profile・家具等は不変。本人配置はさらに、選択した台のposition/rotation/placedAt以外のshared状態、過去記憶、他の台、依頼を全比較した。写真3storeは空の維持であり、非空の写真bytes保護を新たに実証したものではない。

実actor/target UUID、物理接触、画角内の点、実canvasの可視性、結果描画がnative保存に先行する順序は元の条件を維持。新しいPNG取得は、新描画timestamp・新action IDに限定し、actionごとにphaseを識別する。全PNGとmetadataを判定前に保存し、実browserの結果画面も先に保存する。10000 byte、接触、画角、保存前可視の条件は緩めていない。

## 旧FAILの保持

| 元run | 保持する結果・原因 |
|---|---|
| 03 | 実63回答後、`カワウソ`と`カワウソにたのむ`の両方にselectorが一致。住民チップを`aria-pressed`で限定して訂正。原全体FAIL保持 |
| 診断07 | 運搬1件PASS後、ウサギの元配置で安全な拾得経路なし。仕様38は配置し直しを許すため、安全拒否自体をアプリ不具合としない。原全体FAIL保持 |
| 診断08 | 運搬と本人配置PASS、ウサギの結果保存・終了まで到達後、QAのPNG検査で停止。arm直後に前の本人配置の207ms古い描画を採取し、375×287 / 3318B / 全透明PNGが混入。phase名だけの重複除去で後の実phase画像も抑止した。原traceから問題の原bytesを回収済み、原全体FAIL保持 |
| 診断09 | 以上のQA訂正と実UI配置選択を経て、今回の有限な復元phone経路のみPASS |

旧正本は `output/island-experience/shared-jobs-nav38-03/report.json`、`output/island-experience/shared-jobs-nav38-diagnostic07/report.json`、`output/island-experience/shared-jobs-nav38-diagnostic08/report.json`。透明PNGの原trace抽出は `output/island-experience/shared-jobs-nav38-diagnostic08/png-diagnostic/report.json`。09を旧結果へ遡って適用しない。

## 非補償の判定

| 観点 | 判定 | 根拠と限界 |
|---|---|---|
| 動作・保存 | **限定PASS** | 上記実3仕事、本人配置、記憶1件、接触・可視・保存・全store比較。全spec38の合格ではない |
| 視覚的魅力・行為の読みやすさ | **HOLD** | 実原画では対象と結果を確認できる。一方、運搬時の両手が身体の奥に入り、灯りと影の差は台の模様に近い。背面中心の画角もあり、接触点が数値上成立するだけで明瞭としない。承認benchmarkとの全体比較・点数は未実施 |
| 無説明理解・安全・再遊び意欲 | **HOLD / Human N=0** | 実装を知る担当者の画像確認のみ。第三者が主動詞と結果を理解した、続きを望んだという証拠はない。物理安全検査を心理的安全へ換算しない |
| 学習非阻害 | **部分確認** | 任意操作中の学習データ不変のみ。この短いrunでは同予約1回答、連問速度、hidden/学習退出を実施していない |
| 全画面の連続性・公開 | **HOLD** | phoneの短い任意体験に限定。起動→学習までの全導線やsource-A全体同等、公開承認を与えない |

口調に能力評価や罰を追加した証拠はない。操作の結果と別の本人配置が実際に変化することは確認したが、所見は画像を知る担当者による確認であり、silent理解の合格ではない。

## 未実施

空DBからの真正新規両幅full、他標本・制作物との全組合せ、残る2住民の記憶、名前変更・収納・reload後再訪、中断/hidden/退出/明示再開、12/13件の記憶棚、同予約への実回答復帰、tablet/reduced motion、実音、非空写真、CAS/unknown retry、offline/update、正式速度、人による理解・意欲。既存別runの証拠があってもこのrunのPASSへ混ぜない。

## 選定原画

65原PNGから8枚だけを**加工せずbyte copy**した。元path・SHA・frame/action対応は[verification.json](verification.json)に記録。HTMLの縮小表示は閲覧用で、リンク先は原寸原bytes。

- [運搬の両手接触](screens/carry-contact.png) / [運搬結果](screens/carry-result.png)
- [花の取得](screens/gather-contact.png) / [3枚の配置後](screens/gather-result.png)
- [灯りの取得](screens/light-pickup.png) / [実表面と受け面](screens/light-result.png)
- [運搬記憶の再訪](screens/carry-memory.png) / [再訪後の実UI](screens/carry-memory-ui.png)
