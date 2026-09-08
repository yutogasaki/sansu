# 島の体験全体 — 進行中の実装診断

Date: 2026-09-08

対象は[仕様36](../../../product/36_island_experience_spec.md)、[仕様37](../../../product/37_island_workshop_spec.md)、[仕様38](../../../product/38_island_shared_memories_spec.md)、[部位のきせかえ39](../../../product/39_island_appearance_sets_spec.md)、[家具の暮らし40](../../../product/40_island_life_furniture_spec.md)、[身支度41](../../../product/41_island_expression_collection_spec.md)。[全体タスク](../../../tasks/active/2026-09-08-island-experience.md)はActive。以下は途中のDEV診断と範囲を限定した固定production診断で、全体の完成・公開可否・子どもの意欲を判定した記録ではない。

## 対象と証拠の境界

2026-09-09追記: [固定20](../../../../output/island-experience/snapshot-20-verification.json)は横断目標の保存/UI・試用保持、native時刻での音照合を統合し、lint/型/build/assetsと278suite/3097testsがPASS。新目標の実画面は短い専用QAを準備中で、固定20の視覚・全runtimeは未判定。反復時の短い再現と最終まとめ検証を分ける[運用改善](../../../../output/island-experience/verification-workflow-retrospective.json)を適用し、全Goalの基準は維持する。

2026-09-09追記: 固定19の[資格07](../../../../output/island-experience/qualified-07/report.json)で小鳥の目/嘴/羽が両幅で読める[実観察近景](../../../../output/island-experience/nature-19-review/comparison.html)へ改善。選定画像の作者視覚PASS、全体の視覚HOLD、人N=0。音の試聴/置換は実出力が通過したが長いloopはFAIL、hidden/退出/最終学習復帰は未到達。旧録音の冒頭93.333msを未計測のまま残し、[native時刻の診断](../../../../output/island-experience/audio07-loop-diagnostic/report.json)と新validatorの単体合格を旧run全体のPASSにはしない。

2026-09-09追記: [資格06](../../../../output/island-experience/qualified-06/verification-context.json)は固定18＋QA10で両幅FAIL/sourceStable=true。実2来訪・4資格品の明示取得・写真保持後、試聴の最初の録音境界で停止し、後半の音停止/同予約回答は未到達。[元画像比較](../../../../output/island-experience/nature-18-review/comparison.html)は蝶の両羽と花の分離を親も確認し、小鳥の顔は小さくHOLD。違う実行の原PNGを比べた限定場面の証拠であり、cameraだけの対照実験や全体の魅力の合格ではない。

2026-09-09追記: [固定18の検証](../../../../output/island-experience/snapshot-18-verification.json)は全1021files、revision `workshop-20260909-5fcfa6e8f3e0`、配信`127.0.0.1:5404`。鳥/蝶の観察構図と可視記録gateを含み、lint/型/build/assetsと273files/2993testsがPASS。実画像は未判定。旧[音付き資格05](../../../../output/island-experience/qualified-05/verification-context.json)は計測前の別音源のrender discontinuityにより入口FAILで、rawと旧判定を保持する。新たな音検証は対象outlet/windowと全期間の不正データを分ける独立QAを使い、アプリ18を変更しない。全体の魅力・無説明理解・全GoalはHOLD。

2026-09-09追記: [保存03](../../../../output/island-experience/expression-persistence-03/verification-context.json)で異なる2人分の実写真（A全景/Bウサギ）、元画像/thumbnail、本人gallery/PNG、故障・競合・プロフィール切替・実offline保持が両幅PASS/sourceStable。各45全DB比較、22captures。旧保存02の同bytes画像による識別不能の限界を別実行で補った。ホーム追加発見の許可分岐は今回0件。[音付き資格04](../../../../output/island-experience/qualified-04/verification-context.json)はcallback時刻の連続判定で両幅FAIL。raw PCMの三音一致だけで連続実出力や停止境界の合格にせず、render clock計測への草案を別に準備。詳細と残りは[全体タスク](../../../tasks/active/2026-09-08-island-experience.md)を参照する。

2026-09-09追記: [資格03](../../../../output/island-experience/qualified-03/report.json)は両幅PASS/sourceStable=true、各153通常回答/58全DB比較/31工作差分、52captures/136PNG。蝶/葉鳥とベルの実frameから保存、4資格品の明示取得・装備、写真と同学習予約を確認した。実音と来訪の顔/輪郭は未充足で、fullSpec41Passed=false。別の[PWA17-01](../../../../output/island-experience/pwa-17-01/verification-context.json)では同17 app＋PWA QA02の8保護経路、旧10ほし/予約、実SW offlineの回答・再開がPASS、app/QA/dist前後不変。限定fixture/7storesの証拠を全写真・2build更新・人の理解の合格へ広げない。

2026-09-09追記: [資格02](../../../../output/island-experience/qualified-02/interruption.json)はphoneの実観察/4資格品取得・明示装備/元写真/同予約まで通過後、ユーザーの指示文依頼でtablet途中を中断。全体PASSと終了sourceStableは未認定。明示再開後の資格03は同17 app/QA07で新規実行中。親が03 phoneの蝶・小鳥・旗装備の実画像を確認し、旗の近景では飾りが見える一方、来訪の小鳥は後ろ向きで顔/嘴が読めず、蝶は住民の胴体と重なると判断した。実描画→保存の整合だけで視覚と無説明理解を閉じず、来訪の顔・輪郭の分離を改善対象に残す。子どもN=0。

2026-09-09追記: [身支度06](../../../../output/island-experience/expression-06/report.json)は固定17 app＋別QA bundle06で両幅PASS、各147全DB比較、142captures/322PNG、sourceStable=true/pageerrors0。旗の近景/全景/取消と別商品・退出・学習帰島後の解除、無料cap互換、全景v2と元写真/同予約/reloadを確認。鳥の実観察からの明示取得/装備近景、実音、旧景色等はこのrun外で、fullSpec41Passed=falseを維持する。

2026-09-09追記: [身支度05](../../../../output/island-experience/expression-05/report.json)は固定17で旗の同UUID/同camera近景と全景の往復まで通り、次の商品選択でQAがARIAのeffect反映を待たず両幅FAIL（各38全DB比較、48captures、sourceStable=true/pageerrors0）。後続HTMLと実画像は一般ARIA/focus解除を示す。親はphone/tabletの近景で屋根に埋まらない鳥、旗印、島名札と重ならない試用バナーを確認した。これは旧小さな全景からの比較の改善証拠で、装備後の近景・全経路・全体の魅力/人N=0は未検証。appは不変とし、main/qualifiedの待機だけを直した別QA bundleで続ける。

2026-09-09追記: [家具06](../../../../output/island-experience/furniture-06/report.json)は固定17 `workshop-20260909-d31a1dce912d` で両幅の選定経路PASS、sourceStable=true/pageerrors0。各17実利用/72全DB比較/3取得/6本人による配置復旧、338captures/412PNG。以前止まったphoneの実ウサギが、退避後に望遠鏡・ハンモックを利用し、置場なしから周囲を編集して同じウサギで検索し直す往復も両幅で完走。親はphoneの接触2場面と所有ハンモック着座を確認した。旧05FAILは不変。全衣装×模様×家具の実身体、実参加者の意味理解、全仕様40は別の残りで、fullSpec40Passed=falseを保持する。

2026-09-09追記: [身支度04](../../../../output/island-experience/expression-04/report.json)は固定16 `workshop-20260909-87381994b9b3` で両幅PASS、各140全DB比較・3住民の無料帽子互換、130captures/298PNG、sourceStable=true。改名後の追加衣装保持、同じ無料capの再選択で追加衣装解除、写真の同bytesと同予約回答/reloadを確認。親もphoneのfox実帽子復帰画像を確認した。これは無料衣装互換の残差を満たす限定証拠で、4資格品の実獲得・実音・旧scene・全仕様の合格ではない。

2026-09-09追記: [家具05](../../../../output/island-experience/furniture-05/report.json)は固定16の全体FAILを保持。tabletは17実利用/72DB比較、no-spaceから本人の周辺家具移動・同一ウサギで再検索・取得家具の実利用・同予約への復帰/reloadまで通過した。phoneは成長噴水からの退避を試用入口が中断して止める問題を実traceで確認し、次版で修正中。親が確認したtablet候補画像は、実島と周囲の物を残した借用模型の配置を示すが、全体の魅力や子どもの理解の合格にはしない。

2026-09-09追記: [身支度03](../../../../output/island-experience/expression-03/report.json)は固定14 app `workshop-20260909-9331617ebd23` と旗の実描画待機を1行補ったQA bundleで両幅の選定経路PASS。各87実回答・122全DB比較、計112captures、sourceStable=true、page errors0。6取得品の明示取得/装備/解除/再装備、6試歩、朝昼夕×4季節、全景v2保存/変更/試用/取消/適用/再編集、保存写真の同bytes出力、同予約回答/reloadを確認。固定14の全testは共有構図5件FAILのため全体検証は不合格のまま。親がphoneの旗画像を確認し、小鳥飾りの輪郭は小さく視覚HOLD。4観察資格品の取得、収集音、無料衣装との互換操作、旧scene互換と子どもN=0は別の残差とする。

2026-09-09追記: [家具04](../../../../output/island-experience/furniture-04/report.json)は固定14の両幅FAIL、各99実回答、sourceStable=true、page errors0、86captures。phoneは望遠鏡/カワウソの1利用後、全員共通の試用位置探索が不成立のままウサギへ切り替えてunreachable。選択住民を試用探索へ渡し、現在の試用位置が使える時は保持し、使えない時だけ同じ一時模型の別候補を探す仕様40/runtime差分を追加した。tabletは全9試用のwalking/contact/settledと19全DB比較を通過後、配置候補の通知から実previewへの反映を待たないQA境界でFAIL。実suggestionのrequestId/位置/向きへpreviewが追随するまでの待機を修正中。所有後の同住民利用・no-space周辺編集の往復はこのrunで未到達。これらの修正と尾の共有構図修正は次の固定版で検証する。

2026-09-09追記: [身支度の保存01](../../../../output/island-experience/expression-persistence-01/report.json)は固定13 app `workshop-20260909-d63b3ccf1804`＋新QAだけの別bundleでphone/tabletともPASS。各35全DB比較・計44PNG、実回答54/51、sourceStable=true、page errors0。実native abort、通知欠落retry、2window CAS、真のhiddenと遅延配送、profile分離、実SW offlineの非既定環境保持と同予約回答を検査した。写真storeが空のため旧PNG保持は範囲外。`fullSpec41Passed=false`を保持し、視覚/無説明理解/意欲N=0、離席/画角修正の実画面とは別の保存境界の証拠とする。

2026-09-09追記: 固定13 `workshop-20260909-d63b3ccf1804` の[身支度01](../../../../output/island-experience/expression-01/report.json)は衣装2×3住民/2模様の未所持試用と取消まで通過し、実ベンチ着座からの足跡試歩で両幅FAIL（各16全DB検査、計20captures、実回答90/87）。[家具03](../../../../output/island-experience/furniture-03/report.json)も全体FAIL、sourceStable=true、page errors0、計105captures。phoneの全9試用/所有望遠鏡2利用と本人が配置を探して同住民が使う2回復は通過したが、所有ハンモック/ウサギで探索no-space。tabletは最初のreduced試用のwalkingを実描画で確認できなかった。親が確認した茶卓画像は机/カップが住民の背に隠れ、視覚HOLDとする。固定13は変更せず、離席・構図・探索失敗後の編集導線を次版へ修正する。テスト/診断や他場面の可読性を、この未充足の代用にしない。

2026-09-09追記: [地面・壁の比較](../../../../output/island-experience/appearance-surfaces-03/surface-comparison.html)は、診断版 `appearance-diagnostic-20260909-e5186375fdb5` の両幅で各15全DB検査・計42capturesを記録。親もphoneの地面とtabletの壁を変更前後で目視し、格子状のビスケット地面と広い苺色の壁面を確認した。元reportは購入なしreloadでのposition hash差によりHOLD/exit1のまま保持。[補足の実hash再現](../../../../output/island-experience/appearance-surfaces-03/signature-resolution.json)により、段階成長と起動時生成のFloat32 batch丸め（最大約3e-8）と特定。購入変形ではなく、各操作中の非対象部位と保存状態は保持された。この特定部位の可視差と、全体の魅力/子どもの理解を分ける。現sourceのF04/F05統合は新しい固定13で別に検証する。

2026-09-09 00:30追記: [固定12](../../../../output/island-experience/workshop-snapshot-12/build-source.json)、revision `workshop-20260909-3023b69183f8` の[共有camera03](../../../../output/island-experience/shared-camera-03/report.json)がterminal0で終了。phone/tablet各28全DB検査、計52captures、page errors 0、sourceStable=true。[実画面比較](../../../../output/island-experience/shared-camera-03/work-before-after.html)で親も両viewportの作品板全輪郭と3部品を確認した。住民位置/向きと作品の位置/回転は同じ、評価対象が3部品から板面込み4対象になりcamera角度0→-π/4へ変化。特定の板面遮蔽を解消した証拠で、住民の大きさを含む全体の魅力/子どもの理解は未検証。作品そのものの写真保存はこのrunで未実施（標本写真は画素差0）。固定12は11＋限定camera差分/testの合成版で、F05の統合結果ではない。

2026-09-09追記: [固定10](../../../../output/island-experience/workshop-snapshot-10/build-source.json)は09からF04試用/39地面壁だけを合成した診断版で、全254files/2816testsとbuild PASS、未統合F05を含まない。[家具02](../../../../output/island-experience/furniture-02/report.json)の全体FAILは保持する。全3道具×3住民の試用後、所有望遠鏡の置き直し(-1,2.5),πで実身体が通れず、利用可能な場所を本人が探すUIを実装中。望遠鏡の支持棒v2とハンモックの構図は実画像未検証。

[共有camera02](../../../../output/island-experience/shared-camera-02/report.json)は固定11の実display枝/対象/住民poseまで診断し、各28DB/52captures/source不変で完走した。3部品の接点は見えており、過去の「右2部品が完全に隠れる」は撤回する。見えにくかったのは作品を載せる板の右面と輪郭。同じ実板面も評価対象に加えた限定修正を固定12へ合成し、新camera03で検証中。親がphoneの02/03画像を並べ、板面の全輪郭と3部品が見える構図への変化を確認した。tabletと全経路の終了はまだこの記録に含めない。装飾の魅力や無説明理解、子どもの再遊びN=0は引き続き別の未充足である。

- 実app: `http://127.0.0.1:5372/#/island`。Island/BuildPlay flag有効のDEV。
- 基底commit: `d95dbb9`。今回の変更はworktree。下記の入江は途中段階の固定build/source manifestを作成したが、Goal全体の最終固定版ではない。
- 描画: Three、`moon-garden`。world `mystic-island-living-v5`、learning `mystic-island-learning-v2`、delivery `mystic-island-v1`、追加experience `island-experience-v1`。実行ごとのrevision/version/candidateは各reportに保持する。
- phone:390×844、tablet:768×1024、tablet reduced motion。自動操作の作者診断で実参加者N=0。
- DEV診断でsource不変を確認できても、固定production/実機のcold-cache/速度/実SW offlineを代替しない。HMRで中断したrunはFAILとsource差分を残し、通ったrunへ混ぜない。

## 確認した操作

| 対象 | 現時点の証拠と結果 | 残る確認 |
|---|---|---|
| E1/E4 発見帳・成長予告 | [guide診断02](../../../../output/island-experience/guide-diagnostic-02/report.json)。空DBの実設定/通常回答3区間、未発見→無料ヒント→次の実形状/取消→観察/再演→写真→同じ予約の回答。両viewport PASS。preview/currentのcamera行列と全保存不変も照合 | 最終固定版の再確認。通常蝶の羽が細く見える指摘後の実画面再検証 |
| E2/E3 新反応・来訪 | 明示的な成熟/配置fixtureを使うworld-diagnostic-01〜08以降。保存/再演が通っても、巨大光・住民/家/木の遮蔽・小鳥の位置を実画像で指摘しHOLDにした | 遮蔽を避ける実geometry camera、実水盤の到達点、通常蝶を含む全反応の再撮影。fixtureを実学習の成長証拠にしない |
| E5/E6 個性・景色保存 | [personal最終DEV診断](../../../../output/island-experience/personal-20260908-final-dev/report.json)と[52画面一覧](../../../../output/island-experience/personal-20260908-final-dev/contact-sheet.html)。実学習各6区間/60ほし、3住民×3衣装、全身投影/実frame、名前/旗、3音景の現在出力と停止、3保存/試着取消/適用/後発成長/native abort/retry/reload/写真の画素一致がPASS。約70秒のrun中app source不変 | 固定production、実背景化、実スピーカー音、長い名札自体の全景での判読性。最新fox cap画像は各viewportの`10-three-friends` |
| 保存/通常学習の回帰 | phase-1で全208 suites/2345 tests PASS、lintは既存refresh warning1件のみ。その後のportrait枠外修正は専用6tests PASS | 追加仕様37の実装後、最終同一sourceでverify:core、各PWA/Island/smoke/fixed-ten等の全必須検証 |

guide01の全景previewでは花の変化が微小だったため、guide02では選択した場所を同倍率の近景へ変更した。衣装も全景では小さかったため実住民portraitを追加し、キツネ帽子の投影枠外を実geometryから直した。通常の学習カメラと入力はこれらの任意近景に切り替えない。

## 別々に判定する3条件

| 条件 | 現在の判定 |
|---|---|
| 視覚・動きの魅力 | 全体HOLD。成長の形の差と衣装は作者が実画像で判別できた。自然の因果/蝶/来訪は遮蔽と輪郭を修正中。全景での16文字名札は、それ単独の判読性を合格としていない |
| 意味・学習非阻害 | 作者の操作では任意閲覧/編集/写真後に同じ予約へ戻り、保存・支援・ほし・成長を保持。見学は家具の編集を許可せず暮らしと実発見を続ける。子どもの無説明理解・欲しさ・自発的な再遊びはN=0で未検証 |
| Runtime | 上表の対象操作はPASSの証拠あり。最終固定版・全必須コマンド・実SW offline・実背景化・入力速度の全体判定は未完了 |

## 入江の固定版で確認したこと

- 対象: `http://127.0.0.1:5384/#/island`、revision `workshop-20260908-3384cdae3463`、Island/BuildPlay有効、Three、`island-workshop-v1`。app source 886 filesを開始/終了hashで照合。build/資産予算はPASS。
- [workshop-diagnostic-04](../../../../output/island-experience/workshop-diagnostic-04/report.json): phone/touch/通常motionとtablet/keyboard/reducedの両方で、空DB→実回答1区間→3標本/3道具→4部品組立→A/Bの別接続→2作品保存→undo/reload→同じ予約の回答までPASS。32画面。通常連問の速度、実SW offline、全テーブル、住民利用の合格をこの結果から推定しない。
- [phoneのガラス透過](../../../../output/island-experience/workshop-diagnostic-04/phone-seaglass-transmit-world.png)、[ガラスの沈下](../../../../output/island-experience/workshop-diagnostic-04/phone-seaglass-sink-world.png)、[異なる接続B](../../../../output/island-experience/workshop-diagnostic-04/phone-03-work-B-world.png)を実画像で確認。光の到達色、素材、水位、盤と木部品の分離は改善。子どもの理解/欲しさは未検証。
- [直接操作01](../../../../output/island-experience/workshop-gestures-01/report.json): native touchの長押し非保存、pointercancel、速い6区画なぞり、同じ流木の水→光へのdrag、範囲外復元までPASS。くぼみの中心tapで組立できずFAIL。実穴の底面にsocket判定がなく、外周ringだけが対象だった。全4部品の実camera rayで再現4件FAIL→底面の判定修正→20tests PASS。修正版の実UI再確認待ち。
- 住民01はphoneで3種の歩行→手の接触→実行→注視、本人による操作、選び直し/学習/退出の取消がPASS。背景化を作る手順が実visibilitychangeを起こさず、全体FAILとして保持。実画像ではウサギ/キツネの背中に手が隠れ、視覚HOLD。画角修正と実背景化の再検証中。
- 固定版に残る旧ホーム台詞『すこし よけるね』を入江で隠す修正、secondary pointerがprimary所有を消さない修正をrootへ追加。固定版の画面へ適用済みとは扱わず、次の版で確認する。

## 写真と展示の固定版診断

- snapshot02の[直接操作02](../../../../output/island-experience/workshop-gestures-02/report.json)と[保存04](../../../../output/island-experience/workshop-persistence-04/report.json)はphone/tabletでPASS。後者は実hidden、native abort、応答欠落/再送、実SW offline、別profileを含む。前者のtablet pointercancel注入はnative cancelと区別する。
- snapshot04 / `workshop-20260908-e6ca51bf7c05` / `127.0.0.1:5387` の[写真02](../../../../output/island-experience/photos-02/report.json)と[画像一覧](../../../../output/island-experience/photos-02/contact-sheet.html)はphone/tabletでPASS。全景/住民近景/入江、実frameとの全画素一致、保存PNG同bytes、上限/明示削除、途中学習復帰、実offline、2profileを確認。phoneは552240、tabletは1320960成分を比較し差分0。近景は実camera倍率で確認し、写真hash差だけで認定しない。
- 親がphone/tabletの `02-resident-photo` とphoneの `03-gallery-detail` を目視。本人の顔・体と同じ保存像は読める。展示構図、共同仕事、子どもの理解/愛着/再遊びの合格はこの写真検査に含まない。
- 同04の[写真保存01](../../../../output/island-experience/photos-persistence-01/report.json)はFAILを保持。commit応答とliveQuery通知が失われた後、同receipt再送は成功しても次撮影が旧revisionを使った。同期album snapshot採用/旧query拒否/profile取消を修正し、snapshot05 / `workshop-20260908-c88b68985c4f` / `127.0.0.1:5390` に固定した。
- 同05の[写真保存03](../../../../output/island-experience/photos-persistence-03/report.json)は両viewport各7項目PASS、page errors 0、app/QA source不変。native保存/削除abortの全DB rollback、通知欠落後の同receipt再送→同じ画面の次撮影、別の実visible windowによる削除後の旧再送で非復活、[実背景化](../../../../output/island-experience/photos-persistence-03/background-report.json)中の変換取消→再撮影→同予約の通常入力を確認。12実画像。disk quotaの物理的枯渇や子どもの体験評価を代替しない。
- 同05の[通常写真03](../../../../output/island-experience/photos-03/report.json)はphoneの画素/書出/入江/学習復帰/上限と削除の4項目を通過後、reload時のcanvas待機でFAIL。[通常写真04](../../../../output/island-experience/photos-04/report.json)は実SW offlineまで通過後、元profileへ戻る際の同じ待機誤りでFAIL。現行の学習集中仕様でcanvasがhidden 1×1になる正常画面を親が確認し、両方のQA待ち先を実入力readyへ適応。failed runは残す。
- 修正した[通常写真05](../../../../output/island-experience/photos-05/report.json)は同05上でphone/tablet各6項目PASS、page errors 0、app/QA fingerprint一致。画素/PNG/12枚上限/取消/明示削除に加え、実SW offline再起動→写真閲覧→通常回答、実2profile追加/切替と元の11枚の不変を確認。[18画面](../../../../output/island-experience/photos-05/contact-sheet.html)を保持し、親がphoneの実住民近景とtabletのoffline写真詳細を確認した。撮った時の同じ像を読めるが、未接続の住民仕事・展示構図・子どもの意欲を合格にする証拠ではない。
- 展示/記憶/独立作品再訪UIと静的geometryは接続中。snapshot05は本人/住民の仕事command未接続の境界で、仕様38全体の合格ではない。共有保存hookの13回帰testsは、未通知commit再送、CAS、学習/背景から復帰後の遅い演技開始拒否、他画面で取消済みの古い準備結果からの再開拒否を対象とする。後者のhook修正は05より後のsource。
- snapshot05の全体単体検査は234 files / 2,580 tests PASS、build/資産予算PASS。この結果は05の固定sourceだけを対象とし、以後の仕事controller/Stage接続は別途検証する。

視覚HOLD・実利用者N=0・全体必須検証未完了を維持する。古い固定版で確認した動作を、以降の仕事controller統合版へ自動的に引き継がない。

## 共同作業を接続した固定06

- revision `workshop-20260908-9039d0105c7d`、`127.0.0.1:5391`、938 files。build/資産予算PASS、PWA precache 10.50 MiB / 12.00 MiB。固定sourceの全239 files / 2,632 tests PASS。本文から[固定manifest](../../../../output/island-experience/workshop-snapshot-06/build-source.json)へ対応する。
- 同Object3Dの移動・持上げ・接地、実手接触、3枚の花びら、実ガラス面の照明、未展示snapshotの記憶反応を接続。新しいjob関連の単体検査は物体幅の運搬経路、軸/木を透過しないray、描画後保存、取消復元、reducedの可視段階を含む。実画面で全3仕事や中断を通した証拠とは区別する。
- [shared基本02](../../../../output/island-experience/shared-memories-02/report.json)はphoneの3標本の主島展示、実touch選択、同じ予約への2回の学習復帰まで通過。3回とも画面外のボタン→3RAF→実canvas中心可視→本人配置の新規phaseを記録。全体は「隣の上下左右1stepには必ず合法な移動先がある」というQAの過剰前提でFAIL。占有を緩めず、未確定previewを実UIで斜めへ移動する次runで検証する。
- 親が同02の全3展示とガラス近景を実画像で確認。主島に実物が残り、選択した物を近くで見られる。長い操作面のscrollでpreviewの島が画面外になるため、次のUIでは試用中に景色を見続けられる配置を検討する。全景の魅力/全仕事の身体の読み取り/無説明理解は未合格。

仕様39の部位外見domainはこの固定06の後に実装を開始している。06の結果を39の購入・保存・描画の証拠に転用しない。

## 固定08の部位比較とF04の実装境界

[snapshot08 manifest](../../../../output/island-experience/workshop-snapshot-08/build-source.json)のrevisionは `workshop-20260908-f33f47242b8a`、対象は `127.0.0.1:5393`、島/build-play有効。appearance候補 `island-cosmetics-parts-v2`、旧互換候補 `island-cosmetics-v1`。build/資産予算と、並列4の全245files/2,716testsがPASS。07で記録されたtimeout/写真の失敗は消さず、写真テストの実Promise待機と並列上限の変更を記録する。

- [appearance-02](../../../../output/island-experience/appearance-02/report.json): 実通常回答で西まで成長したphone/tablet各57比較（18部位＋36slot＋3セット）と各64回の全DB差分を通過。source不変、pageerrorなし。全体はQAの学習復帰ボタン名誤りでFAIL。画像があることだけで保存/再学習まで完了としない。
- 親が[phone完成セット](../../../../output/island-experience/appearance-02/phone-candy-complete-world.png)と[屋根単独](../../../../output/island-experience/appearance-02/phone-candy-houseRoof-single-world.png)を目視。完成テーマの空/樹冠/屋根の形と配色は変わる。3土地の全景では屋根が小さいため、部位選択の視覚を全景の差分やmesh signatureで合格にしない。単品を大きく確認する画角が残る。
- QAだけの修正は、08の全app入力と共通helperをhash照合した独立のimmutable bundleで実行する。08のapp入力hashと新QA closure hashを前後で別々に残す。rootのF04途中コードを08の証拠へ混ぜない。
- [appearance-04](../../../../output/island-experience/appearance-04/report.json)は独立QA bundle04でphone/tablet各57比較・78全DB検査、25ほし購入/無料窓変更、正確なslot-1名前/全snapshot/単一event、窓の実物差を伴う保存景色の試用と明示取消、同予約3復帰/実回答/reloadがPASS。146画像の[contact sheet](../../../../output/island-experience/appearance-04/contact-sheet.html)を保持。親がphone保存景色とtablet購入直後の実画像を確認。app/QA/bundleの開始終了hash不変、pageerror 0。単品近景は依然不足し、S02/S05/S06/S07/S09/S11とS03の別購入順・全セット購入は未実行。この選定経路を仕様39全体の合格へ拡張しない。
- [仕様40](../../../product/40_island_life_furniture_spec.md)の新家具は08以後のsource。domainとUI hookの回帰は実施済みだが、家具/住民の接点と演技、購入前後の実画面は未検証。F03の部位近景、自然観察の視覚HOLD、共有全仕事、F05と全体の必須検証を維持する。
- 同じ08の[shared-memories-05](../../../../output/island-experience/shared-memories-05/report.json)も選定経路は両端末PASS（各27全DB検査、48画像、source不変）。親が[標本export](../../../../output/island-experience/shared-memories-05/phone-display-export.png)と[作品A近景](../../../../output/island-experience/shared-memories-05/phone-work-A-main-display-world.png)を比較。標本の幹遮蔽は解消したが、作品は配置後のカワウソに隠れる。工程がsettledかつ保存済みでも旧job画角を優先する統合境界を特定し、currentで修正前4FAIL→後4PASSの回帰を追加。次の固定版の実画像が得られるまで、作品の視覚はHOLD。専用shutter latency/正式速度と全3住民仕事はこのrunの確認範囲外。

子どもN=0。意欲、無説明理解、自発的再遊びをこの作者検証から認定しない。

## 家具・部位近景・展示画角を含む固定09

[snapshot09 manifest](../../../../output/island-experience/workshop-snapshot-09/build-source.json): revision `workshop-20260908-00c12e4ff805`、sourceHash `00c12e4ff8056067e2fb765e373241d96661b5fd98f53840710a166c09582470`、971 files、対象 `127.0.0.1:5394`、島/build-play有効。F04の候補は `island-life-tools-v1`、F03は `island-cosmetics-parts-v2`を保つ。部位の閲覧対象と購入intentを分離し、同対象は現在/試用/取消/購入後で同倍率とする。sharedは工程settledとcommitの両方が揃ってから展示の遮蔽検査へ返す。

[build/資産予算](../../../../output/island-experience/build-snapshot-09.log)と[全253files/2,806tests](../../../../output/island-experience/test-snapshot-09-workers4.log)がPASS（並列4、既存timeoutのまま）。PWA precache 145files/10.58MiB、Explore artwork4.92MiB。ここまでを実画面の顔/手/支持面・遮蔽の合格とせず、immutable09の家具/近景/展示実操作へ進める。F05、自然観察のHOLD、全学習/PWA/速度/実利用者は別の残りとして保持する。

## 次の実装

固定09の[furniture-01](../../../../output/island-experience/furniture-01/report.json)は両viewportでFAIL。実99/96回答から得たほし、実カワウソの望遠鏡利用と全DB比較は限定された通過証拠で、次のウサギの経路拒否により購入前に停止した。試用候補が非利用者の実待機位置を考慮していないことを再現し、全員が使える試用位置へ解決する修正中。18 report captures/24 PNG、sourceStable true。距離/接点検査が通ったカワウソも、既存ブランコとの重なりと支持脚の読み取りを実画像で再確認する。3品×3住民・購入後の配置/利用・保存matrixは未合格。

固定09の[appearance-05](../../../../output/island-experience/appearance-05/report.json)は途中停止で全体未完了（exit130、306 PNG）。phoneの[屋根の現在](../../../../output/island-experience/appearance-05/phone-candy-houseRoof-saved-before-world.png)と[試用](../../../../output/island-experience/appearance-05/phone-candy-houseRoof-single-world.png)を親が同寸で確認し、家を大きく映す固定近景で柄の違いと他部位の保持を読めた。これは限定された画像レビューであり、tablet、全S01〜S11、子どもの欲しさをPASSにする証拠ではない。新規appearance-06で両viewportの選定経路を再開する。

仕様37で本人の道具操作、未知の正体、素材からの部品制作、水/軸の因果、住民の利用、試作undo/別作品を採用済み。domain保存とpureな接続/実演beatは実装され、上記の実UI差分を修正中。これを含む採用項目と、対応表に残る住民関係・報酬分類・再訪/思い出を個別に閉じるまでGoalを維持する。

## 共同展示の遮蔽と仕様39の接続中の証拠

- 固定06の[shared基本04](../../../../output/island-experience/shared-memories-04/report.json)はphone/tabletの選定経路を通過したが、root共通QA helperが実行中に変更され、最終source guardで全体未合格。実行報告を合格へ書き換えない。各27回の全DB比較、写真の全画素一致、同一UUID、A保存元削除後の再演とB履歴保持は限定された観測記録である。
- [phoneの実書出写真](../../../../output/island-experience/shared-memories-04/phone-display-export.png)では、(.20,-.60)、回転π/2の標本が木幹/樹冠に隠れる。tabletも同じ視覚問題があり、作品近景には住民の一部遮蔽がある。原画素が正しく保存できることと、被写体が読めることを分けてFAIL/HOLDを保持する。
- `sharedDisplayFraming` は実物を移動/消去せず、実三角形の遮蔽判定で標本本体/作品各部品を見せる構図へ修正。実sceneryによるphone/tabletの独立raycast回帰と写真/通常camera等の37 tests、型/lint PASS。修正後の実画像、動く住民がいる時の描画負荷、子どもの読み取りは次の固定版で未検証。
- [仕様39](../../../product/39_island_appearance_sets_spec.md)のdomain/storageに18単品/3セット/旧権利/差額交換/12slot/全景保存を接続。UIの部位試用、選択部位だけの交換、未知結果の明示retry、元景色の試用取消、全景への入口と衣装/旗/音previewを追加。sourceの存在と担当テストは実画面の視覚/意味/学習非阻害の合格を証明しない。S01〜S11の実受入は未実行のまま。

今後のQAは固定snapshot内のtools/helperから実行し、実行中の共有tree変更を混ぜない。app/QA両方の開始終了hashを引き続き照合する。全体Goal、F04/F05、自然観察の視覚と実利用者N=0は未完了/未検証を維持する。
