# 読書中の本の向き X3 — DEVの実装・検証用場面

**全体判定はPARTIAL。自然なX3の初回出現は未検証、C3視覚はHOLD、Human N=0。**

対象は `http://127.0.0.1:5223`、`DEV VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true`。世界は `canopy-dots-c3-v1`、今回の表示候補は `reading-book-v1`。実アプリのbuild revision/version/deliveryは [delivery-probe.json](delivery-probe.json)。Git親commitとDEVのbuild revisionを混同しない。

既存の自然な行動で図書室から本を持ち、ベンチに到着したカワウソだけを対象にする。通常R5を実提示した後、実際に持つ本を逆さから持ち直す。新しい住民操作・抽選・訪問期限の延長・追加報酬はない。本に上下が分かる木と太陽を追加するが、住民の顔・輪郭・頭身・耳・配色・布・既存の手や頭の姿勢は変えない。旧表示の本と園芸道具は維持する。

## 独立した判定

| 判定 | 結果 | 根拠と限界 |
| --- | --- | --- |
| 視覚・愛着 | HOLD | 本の絵と向きの差は実画面で確認。携帯幅では絵が小さく、C3の柔らかい光、局所陰、奥行き、包まれる空間には届いていない。キャラをC3の生成差分へ置き換えていない |
| 無文字理解・安全 | PARTIAL / Human N=0 | reduced motionは瞬時の向き変更。活動中断/古い訪問/別の住民/無料試行の除外は自動検査。子どもが上下の違いに気づくか、繰り返し見たいかは未検証 |
| runtime整合 | 対象範囲PASS / 全体PARTIAL | coreと明示した検証用場面の実描画・アプリ内保存/再生/再読込を確認。自然初回、全配置、学習入力復帰、PWA/offline/update、throughput、全releaseはこの旅程の範囲外 |

[C3と実画面の比較](contact-sheet.png) / [拡大用HTML](contact-sheet.html)。C3は世界の参考であり、実装済み・配信素材・本番・利用者検証済みを意味しない。

## 検証と出所

固定source `74514aaad4483288a65ec4e85e8c576a832fcf64d813fad4e2762c37fea6bfec`。core1 `/tmp/sansu-reading-core1.log` はdocs/lint/typecheck、402 files /3928 tests、build/assetsがPASS。precache98件/10.88MiB。既存のdocs期限警告あり。

最終UI2はcore後、phone390×844通常motionとtablet768×1024 reduced motionで実行。[report.json](report.json) は開始/終了source、実提示の証拠、元のsnapshot/hash、両幅の描画情報を保持する。検証用snapshotを実コンポーネントで描画し、**実際に両方の向きを表示した証拠を `simulated` として保存**。その後はアプリのおもいで一覧・本人保存・過去の再生・再読込を実UIで確認する。行動履歴・通貨・学習正本と元の記録を保持。UI1は同じapp sourceの事前確認、最終UI2ではdelivery情報も取得する。

自然行動の別診断ではQA購入で図書室と3ベンチを用意したが、ぽこもこが本を運び、カワウソは通常休憩だった。[natural-diagnostic.json](natural-diagnostic.json) はこの不成立を残す。本人や時刻を再抽選せず、X3の自然出現成功とは扱わない。この診断は編集中のもので、最終sourceのE2E合格には算入しない。最初の配置案は家の出口を塞いで拒否されたため、合法配置へ修正してから確認した。

単体検査では、到着/訪問期限、無料試行・別の住民・運搬中・古い表示の除外、snapshotの本人/訪問一致、本以外の形状/姿勢保持、通常R5実提示の前提、両向きの可視性、非同期取消、活動終了/移設取消、mesh再作成時の向き保持を確認。初回の形状比較テストはThree.jsのEuler内部callbackまで比較したテスト側の失敗で、回転値の配列比較へ直して再検証した。

次は自然な初回と現在の同じ本人への再訪を確認する。M3の島全景での直接操作、全配置/混合配置、所有120/配置60候補の性能、世界の視覚品質、全体smoke/PWA/throughputは引き続き未完。
