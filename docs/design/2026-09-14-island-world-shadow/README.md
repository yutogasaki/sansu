# 島全景の影を触る M3

## 実装と対象

DEVのLife島で、実際にベンチへ到着済みの住民の影を直接触れる。本人を呼び直さず、既存の席・位置・姿勢を保って影のコピーだけが約4秒挨拶する。現物の遮蔽を含むray hitで選び、別の影、歩行、編集、非表示、描画喪失、退出、滞在終了を優先する。

投影した影が44px四方未満、または挨拶の腕が見えない場合は、同じ本人の観察画面へ引き継ぐ。この寸法判定は画角の予測であり、見た証拠ではない。提示記録には別途、実描画の本人・影・腕が連続1秒以上見えた証拠を要求する。全景内の提示は `live`、拡大観察は `current-context-test`。保存時はownerを含む成立条件を再評価する。

拡大時は島で触れた瞬間の表示時刻を引き継ぐ。15秒間隔の保存読込へ戻って着座や退席が巻き戻らない。引継ぎ入力は5秒で失効し、対象変更・非表示・手動入力でも消費する。入力が失効しても時計の基点は保持する。永続action・通貨・学習・snapshotの保存形式を追加していない。既存キャラクターの顔・輪郭・頭身・耳・色・布・本人のポーズは変更していない。

## 最終候補の検証

アプリsource SHA-256: `468b00716a58793ca754a7f5b008871c2a0c61158b6f5b0e5b31908f0b8d8f2f`。開始時の親revisionは `917327886e5d7df04280543f377d9dae830f302b`、未コミットの対象アプリ入力を含む固定hash。`src`・`public`・package・lock・Vite設定の開始終了を照合する。

対象は `http://127.0.0.1:5233`、DEV `VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true` / `VITE_CANOPY_MATERIAL_STUDY=false`。実画面のbuild revision/version/delivery/world/candidateは[最終UI report](runtime/report.json)の各caseに記録。樹皮素材の別候補を今回の画面へ混ぜない。新品の隔離ブラウザcontextを使用。production配信・実機・PWA更新の証拠ではない。

- core3: 405 files /3938 tests、docs・lint・型・build・assets PASS。[log](core3-output.txt)。precache 98 files /10.88 MiB。production buildの版は[version](core3-build-version.json)。この版はDEV撮影とは別。
- UI6: phone 390×844 /tablet 768×1024、実タップ、3住民、連打統合、約4秒後の通常影、別対象、履歴から保存、再読込、編集中断、収納、再読込後の元snapshot保持、通貨/学習不変、学習入力への復帰 PASS。phoneは3人とも拡大、tabletはぽこもこ/ウサギが全景内、カワウソが拡大。観察のDOM時刻・位置列も記録し、拡大後に着座が巻き戻らないことを確認。[導線シート](contact-sheet.png)。

- zoom2: phoneの実カメラ拡大4段階から全景内の `live` 挨拶、保存・収納・学習復帰 PASS。[report](zoom/report.json)。
- 読書回帰: 同じ最終sourceで、phone/tabletの明示simulated X3表示・正立/逆さ・保存/再演/再読込・元snapshot/学習/通貨不変 PASS。[report](reading/report.json)。`SANSU_READING_URL` で対象を指定可能にした。自然なX3出現の証拠ではない。

- 既存導線のsmoke 31/31 PASS（4173 DEV classic、Island/Life/BuildPlay無効）。[report](smoke-report.json)、[log](smoke-output.txt)。撮影素材の文書整理に伴うCSS HMRがlogに残る。アプリsourceは同一、全シナリオ完走を確認。
- 既存PWA更新保護 4/4 PASS（4273、core3のproduction build、Island/Life無効）。初回/保護中復旧/同じ問題/実SW制御下の版ずれ。[log](pwa-update-output.txt)。新LifeのPWAや実two-build、実機iOSまでの証拠ではない。

[固定record](fixed-record.json)は初回の実購入診断から保存したQA record。本人の割当・action・論理時刻を保持し、実時間の基点 `realAt` だけ検証起動時へ合わせる。新規の獲得や自然発生の証拠ではない。新規購入モードでは本当に着座している住民だけを検査する。カワウソが散歩中でも着座へ変更・再抽選しない。

## 最初に失敗したこと

1. 全景のcontrollerがprofileなしで評価した成立条件を保存側へ渡し、owner署名が合わず挨拶を開始できなかった。保存前に実ownerでM3を再評価した。[最初のreport](diagnostics/1-report.json)、[trace](diagnostics/neutral-signature-trace.txt)。
2. 次の新規購入ではカワウソが散歩中だった。全員が座るという検査の仮定が誤り。本人の自然行動は変えず、明示固定fixtureと実際の着座者のみの新規旅程を分けた。[report](diagnostics/2-report.json)。
3. 全景のカワウソの腕の影がベンチに隠れ、実可視性の1秒条件を満たさなかった。条件を緩めず、同じ本人の拡大画角への引継ぎを追加した。[report](diagnostics/3-report.json)。
4. 保存前の履歴を「のこした おもいで」から探し、さらに繰返しで最新へ集約された古いIDを探していた。検査を「みえた ばめん」の最新履歴へ修正した。[report](diagnostics/4-report.json)。

時計引継ぎ前のcore1/UI5/zoom1/既存観察回帰は `97c625e627d262eb6e1498e32736031a4619f6573eaaa7ca42b5006d3fac0326` の診断資料として別に保持する。最終sourceの証拠へ混ぜない。core2後にも入力取消と時計基点の分離を修正したため、最終coreはcore3。

## 別々の受入判定

- **視覚: HOLD。** [C3](../references/2026-09-13-canopy-dots/reference-c3.png)と実画面を並べて確認。著者評価31/60（入りたさ6・愛着7・素材4・構図/奥行き4・色7・出来事3）。大粒の水玉と色瓦、住民の顔は読めるが、海と地面が平坦、根元の局所陰と前後の重なりが弱い。影の挨拶は静止画だけでは通常影との差が小さい。樹皮study OFFの今回の点数を、別素材候補の評価と混ぜない。
- **無文字理解/安全: HOLD、Human N=0。** 本人の身体を動かさず、影のコピーだけが動くことはコードと実画面で確認。影を触る入口と挨拶の意味を子どもが説明なしで理解するか、違和感や恐怖がないかは未検証。自動の実可視性は利用者理解の代用ではない。
- **Runtime: 対象旅程PASS、全体受入PARTIAL。** 上記の固定QA場面での実操作と保存整合は確認。全混合配置・全割込みの優先順・最大数性能・新LifeのPWA/offline/update・固定10問10反復・自然初回と全releaseは未完。以前の旧島smoke/PWA結果を新Life全体へ流用しない。

最初の性能診断は他の自然観察プロセスがCPUを占有していた環境。[trace](diagnostics/frame-diagnostic.txt)のframe P95 81.8msを端末性能保証や30fps合格とは扱わない。RPC読み取り間隔もFPSへ換算しない。
