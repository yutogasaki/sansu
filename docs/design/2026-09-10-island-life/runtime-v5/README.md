# 庭と海岸の視覚試作 v5

海岸・花壇・影・画角を更新し、家と住人が同じ地面で暮らしていることを伝えるDEV試作。[実画面](review.html) / [一周の画像](contact-sheet.jpg) / [仕様48](../../../product/48_island_life_spec.md)。

## 変わった見え方

- 単色の海から、青い海・明るい浅瀬・薄い砂浜へ。周囲の低い植生は配置するセルの外に置く。
- 家と住人、花、遊具が地面に影を落とす。正面だけの画角から少し横へ回り、家の側面と遊具の奥行きを見せる。
- 花は葉、つぼみ、開いた花びらで育ちを分ける。成熟した花が既存条件でつながると、土と低い縁も連続した花壇になる。離したり収納したりすると、現在のまとまりに描き直す。
- 遊具が集まった場所は、花壇とは異なる踏み固めた地面で示す。仮配置で所有物や地区は増えない。

家・布のぽこもこ・住人の造形、物の座標、歩行と座席、配置条件、経済・成長・学習・保存は維持。[差分の境界](source-boundary.json)は描画3ファイル、候補ID、単体検査、実カメラを使うQAの6ファイル。学習へ移ると世界を外す既存動作も保持する。

## 参照と試行

基準は既存の初期キービジュアル。海から庭へ続く層、素材差、接地、まとまりと余白を継承する。既存の自由配置を固定の風景画像に置き換えない。方向はこの基準に固定し、今回別の世界観を生成していない。制作契約とTRANSFER表は[タスク記録](../../../tasks/archive/2026-09-10-island-life-garden.md)。

最初の実画面では、海岸の左右が切れ、花壇の土が芝生に隠れ、波が規則的な点に見えた。高さと余白を直し、波を控えめな曲線にした。正面の二回の試行でも平坦さが残ったため、構図を変えて家の側面が見える最終の斜め視点にした。[最初](diagnostics/first-phone-grown.png) / [正面の調整](diagnostics/flat-phone-grown.png) / [角度の比較](diagnostics/angle-phone-grown.png)。これらは50creditと配置履歴を明示投入した視覚診断で、通常獲得の証拠とは別。

細部を追加し続けて最終承認とはしない。海・木・家・花の素材の厚みと、ぽこもこの顔の読み取りやすさは基準にまだ届かない。次の本格的な美術制作では、素材・造形・主役の見せ方を改めて設計する。

## 対象と入力版

最終のDEV対象は `http://127.0.0.1:5253/`、固定コピー `/tmp/sansu-island-life-v5`。`DEV && VITE_ISLAND_ENABLED=true && VITE_ISLAND_LIFE_PREVIEW=true`、画面の候補IDは `island-life-garden-v5`。[source.json](source.json)のhashは `2fb2c93bf7b3be9d11e29c3ced14d7eef32429b408ca3ccfdf34dffca21aa9ab`。元HEAD `70ad92c15a976ae9be2c9513cd4825ea961e4dc0` と共有作業内容の固定コピーで、単独コミットではない。

通常一周は空のブラウザプロフィール、phone 390×844 / tablet 768×1024 reduced motionから実学習を行う。成長のみ明示DEV6時間送り。実時間の一晩や、子どもの意欲の観察とは分ける。[実UI結果](report.json)。

既存島と固定10問の対象は同入力の試作OFF `http://127.0.0.1:5254/`。[別flagのmanifest](legacy-source.json)。島PWA・production guardは両flag trueのproduction `http://127.0.0.1:5255/`。[島production版](island-production-version.json)。classic PWAはcoreの別flagのbuild。[classic版](classic-production-version.json)。これらを一つの配布buildとして扱わない。DEVの変更であり、本番公開はしていない。

## 検証

[検証の集約](verification.json)。[最終docs検査](docs.txt)もPASS。coreは328 files / 3,481 testsがPASS。海岸内の全セル、地区と保存の不変性、動きを減らす設定での海の静止を追加し、仮配置・住人の着座と接触も検査した。[core](core.txt) / [focused](focused.txt)。外部画像やフォントの追加はなく、precacheは10.59MiB / 12MiB。lintは既存fast-refresh警告1、エラー0。

通常一周は学習→購入・拡張→仮配置・取消→成熟した地区→発見と喜び→実着座/ブランコ→外観→収納/撤去→同じ学習の再開。配置のクリック診断では、更新待ち合わせ・連打・退出取消・失敗後の取消保持・再試行後の配置終了を確認する。[一周](life.txt) / [操作診断](interactions.json)。既存7storeの不変性とcanvasの再利用を確認し、描画変更を保存の成果とは混同しない。

描画資源の診断は、独立した試作DBの明示credit/actionsから3回の仮配置・取消を行い、geometry/texture数を比べ、206geometry・5textureのまま増えないことを確認した（338draw calls / 271,400triangles）。最初は検査が選んだマスが既存の花への経路をふさぐため、正しく無効化されて待機した。検査だけを実際に置けるマス選択に修正した。[最初の診断](diagnostics/visual-illegal-cell.txt) / [修正版の診断結果](visual-report.json) / [実行コード](visual-harness.mjs)。

既存smokeの初回は30件PASS、1080×1920の旧Root Tangleで次問までの1,500ms待ちがtimeout。今回の新しい島はそのflag構成では起動しない。アプリを変えず、そのRoot Tangleの5幅だけを同じ時間制限で再検査し、5幅がすべてPASS。初回と再検査を分けて残す。初回は失敗画面の保存先を指定しておらず、具体的な遅延要因は確定していない。再検査の合格を、この失敗の原因修正とは扱わない。[初回](smoke.txt) / [再検査](smoke-retry.txt)。

既存島11、classic PWA4、島PWA8と実SW offline、production guard、固定10問80走行がPASS。throughputはeligible=true。正答/誤答/区間境界P95はphone 212.6/210.6/215.5ms、tablet 212.2/221.9/214.2ms。自動キーボード操作の計時で、子どもの速度ではない。[既存島](island-report.json) / [classic PWA](classic-pwa.txt) / [島PWA](island-pwa-report.json) / [production guard](production-guard.json) / [throughput](throughput.json)。

## 三つの判定

- **視覚：HOLD。** 最終実画面の作者評価33/60（入りたい場所6、愛着5、素材5、構図/奥行き6、色の焦点6、出来事5）。候補 `island-life-garden-v5`、390×844 / 768×1024、2026-09-10、実画面による暫定評価。基準との比較を併記し、技術検査の合格で不足を埋めない。
- **無説明理解・安全・再訪意欲：HOLD、子どもN=0。** 接地、花のまとまり、操作と結果の対応は作者と自動検査の確認。無説明で理解できるか、もっと学びたくなるかは未観察。
- **runtime：今回のDEV描画・操作はPASS。** DEVの描画・操作の確認と、旧モードの時間制限失敗を分ける。全公開の承認ではない。

本番のデータ移行、価格・閾値・減衰の実時間での調整、子どもの操作観察、最終美術は後続。
