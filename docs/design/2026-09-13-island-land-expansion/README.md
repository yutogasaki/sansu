# 土地の3段階拡張

2026-09-13。candidate `land-12-24-48-v1`、world `canopy-dots-c3-v1`、DEV 5223 / `VITE_ISLAND_LIFE_PREVIEW=true`。撮影時は `6e26fd014a5ddb083cfdfd447445fa06b0ec4479` 上の未commit差分。source開始/終了 `490780a338a48ab1c11693eceb6585537db9c497b42ba60c3d590f3056a3baf0` 一致。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [HTML](contact-sheet.html)。phone390×844、tablet768×1024（reduced motion）、sound off、fresh DEV context。60件の明示QA creditを初期条件とし、3回の土地購入と2個の植物配置を実UIで操作。実学習による取得や本番SW動作の証明ではない。

phoneは東→西→南、tabletは西→東→南。12/24/48しずくの実支払記録、45→60→96セル、全景で四隅の中心が画面内かつUIに隠されていないことを確認。南西/南東端をcanvas上でタッチし植物を購入配置した。再読込で保存版5、土地、2個体、残高32を保持。家から両個体への正式経路を検査し、学習正本不変・通常入力への復帰・pageerror/console error 0を確認した。住民が全経路を歩き終える映像検査ではない。

保存テストでは既存の片側拡張と12しずくの支払保持、逆側24、南48、旧時刻への再生不変、再送時の二重課金防止、残高不足/違う向き/receipt改変/保存版降格の拒否、owner transaction失敗のrollbackとretryを確認。新しい行にも家具の前側利用位置・家からの通路制約を適用する。新snapshotは追加土地を保持し、旧snapshotに新しいキーを追加しない。拡張前後の思い出を実UIで往復する検証は今回の旅程には含めていない。

`npm run verify:core` PASS: 371 files / 3783 tests、docs/lint/typecheck/build/assets。既存FastRefresh warning 1件。precache98 files /10.80MiB。所有/配置上限は30のまま。120/60候補の実機性能確認、成熟包絡の追加監査、PWA/offline/update/全smokeは未完。

初回の実UI検査は、保存完了直後でReact表示更新前に次の予告セル数を断定して失敗した。診断は `/tmp/sansu-land-runtime-1`。表示の更新を待つharnessへ修正し、アプリを変更せず上記2幅で再実行した。最初の失敗をアプリの保存失敗とは扱わない。

- **視覚:** HOLD。C3と並べると、大きな枝葉・間隔のある水玉・色瓦は継続している。拡張した地面には広い余白があるが、素材の厚み/陰の奥行きはC3に未達。全景では住民が小さくなるため、顔の可読性を全景の技術PASSだけで認定しない。キャラの顔/輪郭/耳/配色/布を変更していない。
- **無文字理解/安全:** Human N=0。予告と購入済み土地の描き分け・実価格・通路制約は確認。子どもの理解/愛着/安全の利用者検証は未実施。
- **runtime:** 上記DEVと自動検査の範囲PASS。全体release認定ではない。C3 production既定値は旧世界のまま。
