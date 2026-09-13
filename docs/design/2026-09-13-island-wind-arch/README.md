# かざぐるまと花のアーチのDEV接続

2026-09-13。candidate `life-v3-wind-arch-v1`、world `canopy-dots-c3-v1`。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`。撮影元 `f5a27a4eb1eb9aafd56726ab573b800e0da99150` 上の差分。app source `5d95d0e921bba19660e50b45c5daab3ba2c8d00cdd24fdda59d2e430708b3880`。実DOMのdelivery candidateはreportに保存。

[report](report.json) / [critical-path contact sheet](contact-sheet.png) / [比較HTML](contact-sheet.html)。phone390×844・tablet768×1024（reduced motion）、fresh DEV context。明示QA credit24件から実UIで各12しずくの2品を購入する。通常学習による実取得や実参加者の証拠ではない。

かざぐるまは通常回転/reduced静止、既存の頭部だけで近くの前方の羽根を見上げる。席・利用報酬・専用発見は持たない。アーチは1マスの占有を保ち、斜め角の2本の支柱で四方向の歩行線を開ける。短い通過では利用ひかりを与えず、同時利用1人と30分の自動再訪間隔を設ける。明示呼び出しは再訪できる。

verify:core PASS（380 files /3824 tests、docs/lint/typecheck/build/assets）。既存Fast Refresh・期限・chunk警告あり。precache98件/10.82MiB。対象テストは価格12・旧receipt保持・欠落/改変/版降格拒否・同意図retry・半額返却6、配置占有と四方向の通行、同時利用1・短時間無報酬・分割再生一致、回転/reduced/記録姿勢、見上げの状態不変を検査。既存3住民の実造形を60msごとに四方向へ通し、アーチ各三角形の包絡との非接触も確認。

- **視覚:** HOLD。C3と実画面を比較。鮮やかな羽根と花のアーチは加わったが、アーチの花が小さく、枝葉の奥行き・柔らかな光・包まれる空間は未達。既存キャラの顔・輪郭・頭身・耳・配色・布・好みは変更しない。
- **無文字理解/安全:** Human N=0。通り抜けの自動検査は子どもの理解・愛着の合格ではない。近くの見上げと羽根の動きの実参加者観察は未実施。
- **runtime:** 新商品UIはDEV限定。全PWA/offline/update/throughput/全smokeは未完。残り3品、R5/R6、魔法/出会い、上限の実機評価は継続対象。

最初の実画面1/2は中央から0.12以内の単一frameを必須にして失敗。2回目のブラウザ内連続記録では、同一アーチ利用でz=-1.00から+0.60への描画間隔があり、中央のframeを取得できなかった。アプリsourceは変えず、実画面は同一利用・同一中心線の入口側/出口側の両姿勢を検査し、60ms間隔の細かな接触検査は上記rendererテストへ分離。初期診断は `/tmp/sansu-wind-arch-runtime-1` と `-2` に保持。中央frameの実描画や実機fpsの合格とは称さない。

最終実画面3は両幅PASS、source開始/終了一致。実購入→呼び出し→同一利用の入口側/出口側表示→収納→再読込で保存版8・残高24・収納状態を保持し、学習正本不変、通常入力へ復帰、pageerror/console error 0。`report.json` のsamplesに実描画姿勢を保存。羽根の回転・見上げはrenderer検査の範囲で、実画面の定量計測は未実施。ログ `/tmp/sansu-wind-arch-core1.log`、`/tmp/sansu-wind-arch-ui3.log`。
