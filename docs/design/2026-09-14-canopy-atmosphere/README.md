# C3の構図と光 — DEV比較

既存buttress mesh・turf・lagoonを保持し、普通の近景の構図と照明を3案比較した。C3は世界表現の参考で、生成キャラや固定カメラの実装契約ではない。[転用範囲](transfer.md)を先に固定した。ぽこもこの顔・輪郭・頭身・耳・配色・布、住民の好み/行動、歩行/配置/学習/保存は変更しない。木の高さ・葉・地形のgeometryも今回は変更しない。

## 比較と選定

[C3と同じ条件の3案](comparison.png)。[garden](comparison/garden/report.json)は構図のみ、[shelter](comparison/shelter/report.json)は低い視点と暖かい方向光/弱い寒色補光、[sunroom](comparison/sunroom/report.json)は少し広く柔らかな光。すべて390×844と768×1024、reduced motion、同じ明示QA記録の元profile/活動割当/論理時刻を保持し、realAtだけ撮影開始へ再接続した。自然取得や利用者観察ではない。

shelterを次の試作基準に選ぶ。tabletで葉と幹の接続が読みやすく、家の後ろに局所的な陰ができる。sunroomは住民が小さくなる割に奥行きの改善が乏しい。比較時sourceは `9ef79bb956a5531ed4f10f49e1480eb177cd9d3dc38dbd2d39b8d0a8db4279d7`。その後、実際の照明値を記録する観測属性を追加したため、比較時と最終検証のsourceを分ける。照明presetと描画構図は同じ。

## 配信範囲

`VITE_CANOPY_ATMOSPHERE_STUDY=garden|shelter|sunroom` は既存DEV木肌study、turf、lagoon、buttressの全条件を満たすときだけ有効。外側deliveryは `snap-root-v1`、島deliveryは `mystic-island-v1`、worldは `canopy-dots-c3-v1`。実対象 `http://127.0.0.1:5247`、build `development-local:d2aa3577-47e1-45b4-8793-746b937609f5`、候補 `canopy-atmosphere-shelter-study-v1`。基底revision `1695d901c87ce728f0c0d72f5501875bf95eee95`＋この差分。

production buildのIslandLife JSには候補名のテンプレートが残るが、対応変数は `const Qn=void 0` に固定され、追加照明の関数/preset色は除去されている。候補名が完全に消えたとは報告しない。候補限定CSSも残るがproductionでは候補が発生しない。docs素材のpublic/precache追加はない。通常のproduction既定を変更しない。

## 固定sourceの検証

最終app source `ccbea5190f46bb1a2c0cd450c35c04aeb927db4d40fc2b12f500944baafcc868`。core後にアプリ入力を固定し、UI開始終了で一致。atlasとmeshはapp hash外なのでreport内で別途SHA-256を照合する。

- [core](runtime/core-output.txt): docs/lint/typecheck、410ファイル・3,955テスト、build/assets PASS。precache98件・10.88 MiB。既存期限/Browserslist/fast-refresh警告あり。
- [最終UI](runtime/report.json): phone通常motion/tablet reduced motion、両幅PASS、console/page errorなし。simulated旧memoryの旧照明を実属性で照合し、現在観察は現在の島と同じ照明へ戻る。旧snapshot・actions・credits・native学習正本を保持し、reload・拡大/リセット・全景・配置プレビュー取消・学習入力復帰を確認。
- 試作なしの5244を同じQA記録で起動し、全景/配置中のprojectionとview行列が完全一致。実地面の4,4をタッチし選択を確認、保存前に取消した。全配置や全カメラ中断の網羅ではない。
- [導線シート](contact-sheet.png): 両幅の現在→旧memory→現在観察→拡大→全景→配置取消前→学習。観察カメラ自体は変更していない。

初回の[UI1](diagnostics/ui1/report.json)は近景で花列の一部が画面外となり、live発見の表示証拠が成立せず待機期限で終了した。全景を実操作で開いて対象を見せる検査へ修正し、露出していない対象を提示済みとみなすアプリ変更はしない。[UI2](diagnostics/ui2/report.json)はリセット後の行列が一致していても手動操作履歴フラグまで同一と要求した検査の誤り。UI3ではprojection/viewを比較する。最初の失敗記録は保持する。

## 独立した判定

- 視覚: **HOLD、36/60**。入ってみたい6、愛着7、素材6、構図/奥行き7、色7、出来事3。C3と最終両幅画面を見た作者評価、確信度中。幹と家の陰は改善したが、岸の板状感、海だけの背景、低い樹冠、近景での周辺cropが残る。52/60・各8以上には未達。新しい動作を足して静止画の不足を補わない。
- 無文字理解/安全: **HOLD、Human N=0**。作者の確認は利用者の理解/危険解釈/継続意欲の結果ではない。
- Runtime: 上記の限定導線は **PASS**、全releaseは **HOLD**。最大配置性能、自然X3、固定10問10反復、実機やこのDEV候補のPWA更新は今回の証拠に含まない。

次はC3の地面から樹冠までの空間と、島の奥に見える背景の層を検討する。今回の照明微調整だけで完成とはしない。元の仕様全体の未完項目も継続する。
