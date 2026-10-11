# 育つ場所v1 · 本体の実装と実画面

目標は、採用した[全島実3D native-05](../2026-10-10-island-final-3d/README.md)。現在の本体v3は、その方向へ進むローカル実装です。中空の大樹と回廊、広い浅水、厚い貝屋根、一体の花の天蓋を本人の配置から描きます。**native05の完成像への到達はまだです。** 森と庭の密度、深い入り江、段差と滝の構成は現在もかなり単純です。

**美術はHOLD。利用者から「全く届いてない」と差し戻し。** 作者の方向GOは撤回した。記録した技術検証の範囲は成立するが、全島の美術合格を意味しない。[再制作方針](art-recovery.md)へ。以前の作者レビューとローカル完了記録は[差し戻し前の履歴](history/runtime-v3-before-user-rejection/gate-review.json)に原byteで保全する。 差し戻し前の判定では、作者と別UI担当が640×787の[DEV全景](whole-dev-art-v3-final.png)を目標と比較していました。その方向判断は現在の合格基準から撤回しています。

6つの自由な目標、同じ材料で変わる15配置、4つの場所の関係を一続きの島として実装しました。[場所の契約](../../product/island-place-goals.md)と[保存ADR](../../adr/2026-10-10-growing-place-runtime.md)が正本です。

制作順を完成全島→地形と実床→同じ美術から成長段階→場所同士と暮らしへ変更。[新しい本体内の美術確認](../2026-10-10-native-art-transfer/README.md)は、原本を実アプリ内で表示する開発用工程です。このv3の所有島を完成扱いにしません。

## 確認した範囲

[集約記録](places-evidence/combined-summary.json)は、通常取得3旅程と、390/768幅の成熟診断40件を複数の原runから集めた結果です。**単一コマンドで全行程がPASSした記録ではありません。** [重要経路の実画面](places-evidence/critical-path-contact-sheet.html)と原reportを併せて確認できます。

- [通常取得3旅程](places-evidence/native-v3-autonomous-use-failed/report.json)：320/390/768幅で各21回答、若い木の通常購入、6目標の選択/解除/保存、接続・分離・同じ木の再接続、同じ学習への復帰が完了。fixture書込み・時刻操作はありません。後続P01で指定したぽこもこの利用が90秒以内に届かず、この原run全体はFAILのままです。
- [成熟390幅の19件](places-evidence/native-v3-whole-observation-failed/report.json)：15配置と4関係が完了。後続の全島利用待機で止まった原run全体はFAILのままです。
- [全島390幅の1件](places-evidence/native-v3-whole390/report.json)と[成熟768幅の20件](places-evidence/native-v3-tablet/report.json)：明示した選択範囲がそれぞれPASS。上の19件と合わせ、重複しない配置ID×幅の40件です。

成熟診断は固定Dateと明示的な成熟fixtureを使い、自然取得や実時間18時間/7日の成長とは分けます。代表配置ではP01〜P05の指定したactor/target/完全revisionの実利用、全島ではP06の3系列以上・現在の本人/実在住人の利用を保存から確認します。productionの観察は自律行動を待ったもので、画像名のphysical-useをpointer操作の証明には使いません。初回成功の保証もありません。

自律行動の観察は単独場所と全島とも最大3回×90秒、間に通常reload/readyを行います。各失敗窓の時間と実保存を残し、最終窓が不一致ならFAILです。実pointer経路は1窓のまま。actor/target/revisionやP06の成立条件を変えず、状態・時計・random・利用受領を注入しません。

配置確認は最大4回の可視・enabledな通常tapと保存読取で、元ID/全owner/残高/目的座標を保持します。15秒は再試行を始める期限です。通常取得のgrowthだけは保存された自然時間×既存最大係数以内の前進を許し、他の個体情報は完全一致。収納からの成熟復元はgrowthも完全一致です。

## 実アプリと原証拠

固定NEWは`native-05-place-runtime-v3-new-c3ea0771d8e6:631708c0-ffb5-476e-bf4f-864977d70cfb`、対象は`http://127.0.0.1:5289`。実候補は`native-05-place-runtime-v3`、Island/Growing ON、Nature Town OFFです。完成模型のGLBを固定背景として配信せず、本人の所有・接続・成熟・到達からThree.jsで造形します。[NEW入力の原manifest](places-evidence/native-v3-whole390/new-manifest.json)、[全島用QA差分](places-evidence/native-v3-whole390/qa-byte-audit.json)、[768幅用QA差分](places-evidence/native-v3-tablet/qa-byte-audit.json)、[本体の最終対応監査](places-evidence/final-runtime-correspondence-v6.json)で、本体と修正QAのSHAを分けています。

v3の[coreと既存旅程](verification-evidence/native-v3/index.json)は564 files / 4,966 tests、classic32経路、案内24画面、balance12画面がPASS。coreは独立したbuild UUIDです。[元verifierアーカイブ対immutable NEWの共通範囲](verification-evidence/native-v3/source-correspondence.json)としてsrc/public/tools/prototypes/package/目標の1,837ファイルをbyte照合しました。全入力・dist・build UUIDの同一性や、後から修正したQA driverの同一性は主張しません。外部の美術/子ども評価を含む元の検証ラッパーのrelease判定PARTIALは保持し、core checksのPASSと区別します。

v3の[保存・実SW更新証拠](storage-evidence/native-v3/index.json)では、実source writerを使った隔離fake-IDBで旧writer隔離がPASS。生成プロフィールの実ブラウザでは390/768幅の通常/中断4ケース・14画面がPASSです。固定NEW/ROLLBACKで学習・予約・所有・住人を保ち、offline継続と互換writerへの復旧を確認しました。14画面はOLD/NEW/ROLLBACKのoriginal-fallbackを含む保存の証拠で、成熟v3の美術証拠には使いません。元の利用者や既存の個人プロフィールは使っていません。

[DEV全景のmetadata](whole-dev-art-v3-final-metadata.json)は固定版の操作検証と別です。4系列、既存stage4の8軒と8住人を明示した成熟診断を実際の640×787で撮影しました。1280幅や自然7日成長として扱いません。元の本人プロフィールの選択は診断後に復元しています。

## 実装した範囲と残る差

- 木陰の庭、大樹と実回廊、水庭、家と遊び場をまとめる共同屋根、花の門や中庭を、現在の所有から導きます。
- 本、配置予告、実3D、住人の歩行と利用は同じ場所・高さ・対象を読みます。実際の前景描画と利用で受領し、屋根を付けるだけで利用済みにはしません。
- 木/花/家のID、支払い、育成時計、家のstyleと住人、学習を保持します。分離で現在の形は戻り、初回の記念は残ります。
- record4/専用`placedIslands`へ移行し、旧writerが新しい正本を編集できない境界を持ちます。

[美術ゲート](gate-review.json)はHOLD_USER_REJECTED_NATIVE05_GAPです。native05より所有床は規則的で、主大樹と高床の中心性、森/庭の密度、深い入り江や複雑な海岸、段泉と滝の迫力は控えめです。歩ける水路は地面+3cmの浅水と+4cmの渡り石・actorの足に合わせ、元の個体座標・通水・到達・所有を模型へ合わせて変更しません。

## 失敗と途中版の保全

原FAILは上書きせず、[旧座標呼出し](places-evidence/native-v3-harness-failed/report.json)、[配置確定の待機](places-evidence/native-v3-move-confirmation-failed/report.json)、[目標確定の待機](places-evidence/native-v3-goal-confirmation-failed/report.json)、[自然成長の厳しすぎた比較](places-evidence/native-v3-natural-growth-check-failed/report.json)、[単独場所の観察待ち](places-evidence/native-v3-mature-observation-failed/report.json)も残しています。[v2美術/検証](history/runtime-v2/gate-review.json)も別の履歴です。`whole-dev-first.png`、`whole-dev-round.png`、`whole-dev-before-shallow-water.png`、v2画像は途中版のまま保全し、最終候補へ昇格させません。

## 独立したゲート

| ゲート | 現在の範囲 |
|---|---|
| 視覚 | HOLD_USER_REJECTED_NATIVE05_GAP。作者の方向GOは撤回。native05完成像の再現は未達 |
| 理解/安全 | 44px操作、通常学習往復、取り消し/分離・記念の読み取りを検査。子どもの無説明理解・再訪は未観察 |
| Runtime | 固定本体のcore、通常取得3旅程、複数runからの成熟40件、保存4・旧writer隔離・実SW更新/中断/互換復旧 |

公開、実機、独立した子ども/利用者の無説明理解と再訪、実時間18時間/7日の自然成熟は未実施です。ローカルproduction buildの技術PASSで代用しません。
