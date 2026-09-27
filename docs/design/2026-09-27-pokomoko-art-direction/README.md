# ぽこもこ・星の玩具盤面 v4

2026-09-27。画像から作り直したローカル候補 `pokomoko-star-arcade-v4`。生成画像の採用をユーザーが確定したものではなく、Switch作品との同等品質を認定したものでもない。v3はユーザーの視覚評価で不採用とし、公開していない。

## 参考と方向

対象は[grmchn4aiの投稿](https://x.com/grmchn4ai/status/2103807453406388538)1件（2026-09-26 11:22:38 UTC）。x-readで本文と動画を取得し、53.366秒の動画を実再生。約2/6/17/27/44/52秒の構図を確認した。音の実聴、投稿者の「勉強中毒」という学習効果の主張、他作品との網羅比較は調査範囲外。

| 移す設計 | 移さないもの |
| --- | --- |
| 入力位置から相棒まで届く動き、接触と反動 | 伸びる身体、キャラの模倣 |
| 大きく短い数字、通常と節目の明確な差 | 桁を無制限に膨らませる報酬、時間制限 |
| 連続成功で盤面・キーの見た目が持続的に変わる | 問題の回転、次の入力を覆う全面演出 |
| 柔らかいキャラと硬い玩具の素材差 | 同じ質感を全要素に掛けた装飾 |

[3方向の生成と初期レビュー](prompts.md)から、実装者が「星の玩具」を先行選択。紙工作、ゼンマイ列車も比較した。ユーザーへ選択肢を提示済みであり、未回答を承認とは扱わない。

## 実装した一本の動き

答えを押す → 受理の青い光が手元へ届く → 正解保存後に金の星を受け取る → くぼみに投げ入れる → 3連続で跳ねる → 5連続で星に乗る。

生成した全身6ポーズと立体レールをWebP化して使用。布、縫い目、木製の縁、キーの段差を揃えた。数式・進捗・キー・文字はDOM。盤面の中へ演出を重ね、独立したマスコット用ダッシュボードを撤去。足の接地、レールのくぼみ、押したキーの沈み込みを残す。5連続では星の乗り物・虹レール・数字キーの配色が変わる。C/戻すキーは機能色を保つ。

保存済みの連続正解・光・ほしのりの規則、採点、SRS、通貨、問題の生成、音の設定は変更しない。すべての演出は入力と並行し、クリックを取らず、非表示時に破棄。reduced motionでは飛翔を止め、取得状態を静止表示する。

[動きの契約と時間](motion-contract.md)。画像プロンプトは[こちら](prompts.md)。

## 実画像から残す批評

- 材料と足の存在感はv3から変更できた。静止画でも通常とほしのりの差が見える。
- 生成した概念図の余白や小さな文字をそのまま採用していない。実DOMの問題・全キーを優先した。
- 概念図ほどの大きなカメラ移動・広い飛行は実装していない。顔と手足の微細な縫い目には生成ポーズ間の差がある。既存3Dモデル自体の変更ではない。
- 動画の面白さと同等、子どもが遊びたがる、という判定はまだできない。自動検査の合格とは分ける。

## 検証の区分

最終targetは `http://127.0.0.1:5357/#/island` のproduction preview。親revision `4af6d892`、build revision `4af6d892-pokomoko-star-arcade-v4`、delivery `snap-root-v1`、候補 `pokomoko-star-arcade-v4`。Island/Life/Fantasy ON、Life preview OFF。[全app入力hash](source.json)、[全dist・version・flag](production-manifest.json)で未コミット候補を特定する。`5230` の共有チェックアウトには所有する6ファイル/変更箇所と2素材だけを反映し、実ブラウザーの候補IDと画面を確認。他の変更とindexは触っていない。

| 判定 | 状態 |
| --- | --- |
| 視覚 | 3方向から実装者が選んだ候補。材質・足の接地・通常とピークの区別を実画像で確認。ユーザー採用と参考作品への同等到達は未認定 |
| 無説明理解・安全 | 実装者の画面レビューのみ。独立した5名の観察、子どもの楽しさ・継続意欲は未観測 |
| Runtime | 下記範囲を確認。実機、実スピーカー、今回の新旧2build間のSW更新、公開URLは別範囲 |

[生成案と実画面の比較・一周のcontact sheet](contact-sheet.html) / [6秒の実動画](runtime-preview.mp4) / [全動画](runtime-full.webm)。短編は全動画の16.1–22.1秒を等速で抜き出し、音声なし。自動入力の速度であり、子どもの操作速度ではない。

| 検査 | 結果・範囲 |
| --- | --- |
| [core](core.txt) | docs・入口guard・lint・typecheck・475ファイル/4,251 tests・build・asset予算PASS。タブレットの絵の最大幅を制限する直前のsource。最初の個別typecheckで未対応のreplaceAllを発見し、正規表現へ直してからcoreを実行 |
| [最終build](build.txt) | 幅の制限後、typecheck/build/assets PASS。precache 161件・8.68MiB / 12MiB |
| [classic smoke](smoke.txt) | 既存画面31ケースPASS。Islandの美術の合格とは別の回帰検査 |
| [最終production UI](runtime.json) | 390×844、768×1024、844×390 ×通常/reduced motionの6条件PASS。各21独力正解、光30・3スタンプ、誤答で取得保持、支援/再開/同じ次問。全数字キー44px以上・画面内、演出中も入力可能 |
| 同上のSW | 実cacheへ全身259,594bytesと盤面136,790bytesが入り、両画像のoffline decode、再読込・同じparty保存と回答まで確認 |
| [入力14条件](inputs-before-socket-flight.json) | 全身・盤面・新キーの組込後、筆算/複数段筆算/分数/英語を含めPASS。最後の星のくぼみへの投擲とtablet最大幅の追加前であり、その2差分は最終productionに帰属 |

最初の[横画面診断](layout-diagnostic-first.json)は「キャラがキーより上」という縦配置の期待で失敗。実画面ではキーの左に全身があり重なっていなかったため、「上または左、盤面内」の幾何検査に修正。失敗記録を上書きしていない。[幅の制限前](production-before-tablet-cap.json)も6条件PASSだったが、tabletの横伸びを実画像から修正し、最終6条件を再実行した。


速度計測の初回は25 run後、phone・7反復目の9問目で計測待ちがタイムアウト。保存後の画面は10問目・9連続で入力可能だった。window上の計測変数だけが消え、DEVログの22:47:15の `page reload docs/design/2026-09-27-pokomoko-art-direction/contact-sheet.html` と一致。実装者による比較HTML保存が全ページの再読み込みを誘発した環境中断であり、採点失敗ではない。[中断report](throughput-interrupted-by-doc-reload.json)と[次問の画面](throughput-reload-diagnostic.png)を保持。以後はdocsを含む全ファイル更新を止めて測り直す。


## 最終固定10問の反復

[再計測report](throughput.json) / [実行log](throughput-log.txt)。80 run、`eligible=true / pass=true`。各幅・各scenario・Study/Islandを交互に10反復。全app入力の開始/終了hash一致、誤答20件/幅、通常の追加操作0、全遷移で旧入力漏れ0。DEV・reduced motion・自動キーボードの固定問題であり、実機/本番planner/子どもの速度の証明ではない。通常motionの実操作とofflineは別のproduction UI検査に帰属する。

| 幅 | 正答→次入力 P95 | 誤答→再入力 P95 | 区間境界 P95 | 追加操作 |
| --- | ---: | ---: | ---: | ---: |
| 390×844 | 219.5ms | 209.5ms | 199.0ms | 0 |
| 768×1024 | 219.2ms | 208.9ms | 219.2ms | 0 |

通常Studyに対する全正答の問題速度比は2.30/2.29。旧版の測定はreportのbaselineとして分けて保持し、Studyとの比較と混同しない。初回実装時点ではローカルへの反映までで、commit/pushは行っていなかった。


## 2026-09-28 main統合

ユーザーのcommit・main push依頼により、最新main `65bfc95c` に本候補を統合。[統合後のverify:core](main-integration-core.txt)はdocs・入口guard・lint・typecheck・474ファイル/4,233 tests・build・assetsすべてPASS。先行mainの試作撤去を保持しているため、初回候補のテスト件数とは異なる。上記の画面・速度検証は記載した候補buildへの証拠として保持し、公開URLの確認へ読み替えない。
