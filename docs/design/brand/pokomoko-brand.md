# ぽこもこ — 名前とアイコン

2026-09-08、ユーザーが「ぽこもこ」を採用し、名前とアプリアイコンだけのmainコミット・pushを依頼した。

## 変更範囲

- ブラウザーtitle、Appleホーム画面名、manifestのname/short_name、初回画面、印刷物のアプリ名を「ぽこもこ」にする。
- 採用画像は[パッチワークのくま](pokomoko-icon-master.png)。built-in image_genで生成した1254px正方形の元画像を保存し、sipsで32/180/192/512pxを出力。くまの造形や色は編集していない。
- 生成指示の要点: 既存住民のクリームと青の顔、左右で違う水玉の丸耳、黄色い手縫い、つやのある黒い目鼻を維持し、顔中心・淡い紫の背景・文字なしの正方形アイコンにする。
- any/maskableは同じ採用画像を使用。中心80%の円形切抜きでも目・鼻・口を保持。耳や肩の外側はOSのmaskで切れることがある。
- HTMLタイトルに依存する4検査の対象判別文字列を更新する。判定条件は緩めない。
- 島・学習・保存・ルーティング・PWA更新処理は変更しない。旧探索のキャラクター「ポッコ」とゲーム名は保持する。

## 確認

固定作業場所 `/tmp/sansu-pokomoko-brand`、基準 `d95dbb96e50844d684f11998f73438880bd47d9e`。並行作業を含めず確認する。phone 390×844 / tablet 768×1024の実初回画面、タイトル、全6アイコンの寸法、32/64px表示、円形maskを確認する。変更後のインストール名がOSに反映される時期やiOS/Android実機は未評価。

- `verify:release` PASS: docs/lint/typecheck、194ファイル・2,232テスト、build/assets、smoke31、実Service Workerの更新を含むPWA4。
- 最後に島の初回見出しだけを同名へ揃えた後、lint・typecheckを含むbuild/assetsと島初回のphone/tablet表示を再確認。PWA容量は10.21MiB / 12MiB。
- 全6アイコンの実デコード寸法、HTML title・Apple title・manifest名、通常/島初回の表示を確認。画像は既存の採用マスターと一致するデザインで、32/64pxと円形切抜きでも顔を識別できる。
- 検査ログ: `/tmp/sansu-pokomoko-verify.log`、`/tmp/sansu-pokomoko-final.log`。表示記録: `/tmp/sansu-pokomoko-ui/`。OS実機のインストール名の更新時期は未確認。
