# 島の体験全体とベンチマークの対応表

2026-09-09追加: [固定39の新ヘッダー監査](../../design/audits/2026-09-09-island-learning-milestones/README.md)で7ケース・21正答＋追加誤答1/ヒント2、寸法不変・可視/消失・同予約復帰を限定確認した。正式80runとIsland PWAは別の同版証拠としてPASS。過去20/41区間の取得、4地区全巡回、子どもの意欲をこの結果に含めない。

- Date: 2026-09-08
- Owner: Codex / island experience goal
- Status: Active — 採用済み体験と残る実経路検証を照合、造形全体・Human N=0・全Goal未完了
- Review By: 2026-09-15
- Related ADR / Runbooks: [検証方針](../../ai/verification_matrix.md)

## Purpose and authority

このセッションの分析全体を、学習を阻害せず「触りたい・育てたい・集めたい・また学びたい」へつなぐための対応表。104個の別システムを作る計画ではなく、重なる機能を同じ体験へ束ね、元の項目と検証責任を失わないための監査である。

[7作品・104項目](../../wiki/game-experience-benchmark.md)と[追加12作品の報酬調査](../../wiki/reward-customization-benchmark.md)を全対象とする。ここは作業中の判断表で、採用済みの製品仕様ではない。[仕様28](../../product/28_mystic_island_spec.md)、[仕様30](../../product/30_living_island_growth_spec.md)、[仕様35](../../product/35_island_customization_spec.md)、[仕様36](../../product/36_island_experience_spec.md)と2026-09-08の共有作業treeを初回照合し、関連行を以下の採用仕様37〜42・版別証拠へ更新した。全104行に読んだsourceと残る採用候補を示す。これは固定release buildの実画面監査ではなく、全行の実画面/3ゲート/参加者確認は未判定。[残る体験の監査](2026-09-08-island-experience-remaining-audit.md)に6作業群の限界、再利用できる別モード、追加候補と受入場面をまとめる。doneログや過去テスト合格を現状の完成証拠には使わない。

仕様35のほし・きせかえと仕様36のE1〜E6はそれぞれ全体の一部であり、このGoal全体の完了条件ではない。「学ぶ → 同じ世界が育つ → 暮らしが変わる → 気づく → 自分で試す → また育てたくなる」の全体を扱う。

## Docs To Touch

- この段階の変更: 本対応表と[残る体験の監査](2026-09-08-island-experience-remaining-audit.md)。親タスク登録・共有queueは親担当が管理する。
- 実装採用前に更新: 親仕様01、島28、成長30、外見35、および責務に応じた追加子仕様。UI基準07と検証方針も差分に応じて更新する。
- この段階では変更しない: 学習判定29/31/34、既存code、保存schema、doneログ。新しい遊びが学習実績へ影響しないことを実装時に検証する。

## Classification and evidence

2026-09-09再照合: U/Fの採用状況は `569d1c0` の実装と仕様37〜42へ更新した。編集時のHEAD/origin/mainは別navigation変更を含む `8e36612`。`569d1c0` のVerify Core（run `34308069057`）とDocs Check（run `34308069053`）はsuccessだが、その結果を新navigation全体へ転用しない。固定37の[正式80run](../../design/2026-09-09-island-renewal/connected-v17/throughput-verification.json)は全15gate PASS・eligible/pass true。正答入力P95はphone/tablet 199.3/200.2ms、誤答retry 198.2/198.2ms、区間境界197.7/197.7ms、追加操作0。固定問題/自動keyboardによる専用DEVの計測で、通常planner・初解放・実機/子どもの速度や新navigationの証明ではない。

[固定36→37の接続岸・床の記録](../../design/2026-09-09-island-renewal/connected-v17/README.md)は、旧座標と床y=0を保つ3.35接続楕円・外向きの丸み、拡張0/1/2で既定homeの32camera値を維持し、明示allだけ実床へ合わせる構図を確認した。診断fixtureの8視覚contextと、東のランタン1点を実UIで移動/取消/保存/reload/同予約へ戻す4contextの限定PASSで、実回答による初解放・自然な成長過程の証明ではない。app37の1081入力は `569d1c0` の保存地点に対応し、元3test FAILを保持したtest-only検証37-02は299 files/3297 tests PASS、classicは別flag構成で31/31 PASS。Source A全面・Human N=0・全Goal未完了を保持する。

通知の判定を訂正する（2026-09-09）。前記録の「不可視は既存不具合」はSSOT照合不足だった。`d4d157f` の仕様30:34は「学習中は島とその通知を非表示」と明記し、固定37の4件のDOMあり/visible=falseは当時契約と一致する。[navigation検証の原FAIL](../../design/audits/2026-09-09-island-navigation/verification.md#別に残る範囲)はQAの可視期待と当時契約の不一致として保持する。新たな[仕様30](../../product/30_living_island_growth_spec.md)では、大きな節目のみ既存ヘッダー領域に最大6秒、ヘッダー/問題/キー寸法不変・誤答支援優先で示す。U7/F06はこの仕様変更を固定39・7実経路で限定確認し、原測定・画像・入力/成長PASSを変えず、新コードの証拠へ転用しない。

その後の[初解放4経路](../../design/2026-09-09-island-renewal/connected-v17/first-unlock/README.md)は、各幅の東/西解放直前の明示IslandRecord fixtureから、固定37の通常plannerが実生成した3問へ本人UIで正答した限定診断（計12回答/12answer receipts）。最後の答えで成熟と東0→1/西1→2を原子的に保存し、次予約へ追加操作0で進んだ。最後の正答→次入力はphone東/西187.9/187.2ms、tablet東/西187.1/186.9msの各単発で、正式P95ではない。初回からの20/41区間分の育成実績は証明しない。節目通知は4件ともDOMあり・visible=falseを実確認し、保存成功/帰島後の表示と、当時仕様どおりの学習中不可視を分ける。新ヘッダー通知は別の固定39・7実経路で限定PASS（最新監査参照）。

2026-09-09追加: W01/W08の素材差は、[固定33の芝v13](../../design/2026-09-09-island-renewal/grass-v13/README.md)で局所改善。既定groundだけの短葉bump面をphone/tabletの同画角で比較し、足元・道の読みやすさと全storeを保持した。実取得ではない明示成熟fixtureの4比較経路、295 suites/3264 testsの範囲であり、全104行・視覚全体・動機の実証へ拡張しない。旧29〜32の見た目HOLDとHuman N=0を保持する。

2026-09-09追加: 固定24の[衣装・模様と家具利用の有限確認](../../design/audits/2026-09-09-island-expression-matrix/README.md)は、両幅それぞれ残25組のportrait・選定9場面の利用が通過した。復元と明示注入を含む診断fixtureの項目単位の合成で、実取得・単一連続run・全直積・固定26の合格ではない。到達不可の元FAILと、実収納/再配置から同じ住民が再開する操作を保持。画面の重なりは[固定28](../../design/audits/2026-09-09-island-panel-layout/README.md)で解消。W01/W07/W08/W10とR13の音は、同app20の主音QA05＋停止/同予約回答QA06を[限定記録](../../design/audits/2026-09-09-island-audio/README.md)に集約した。元のFAIL、未収録onset・実聴、造形全体とHuman N=0を分けて保持する。

2026-09-09追加採用: [仕様42](../../product/42_island_learning_keepsakes_spec.md)は、本人の完了区間を根拠にした賞状3点/トロフィー13点を暮らす家の一角へ飾る。島の実家の玄関から同じSceneの家内へ入り、生活空間のoverviewから実アルバム/かざりと記憶・お知らせ・学習の棚を選ぶ。外側のopen cutawayは採用しない。これは元の報酬16分類を16品へ縮める変更ではなく、本人の成果・収集・愛着への追加接続である。固定23 app（`../../../output/island-experience/workshop-snapshot-23/build-source.json`）＋QAのみの修正版（`../../../output/island-experience/keepsakes-qa-23-02/qa-source.json`）のgenuine検証23-02（`../../../output/island-experience/keepsakes-23-02/report.json`）は両幅PASS。実5区間から得る最初の2品の展示/収納/再読込、実写真、0件掲示板、同予約の非最終回答後の全islands保持を確認した。元01のQA FAIL（`../../../output/island-experience/keepsakes-23-01/report.json`）は保持する。全16品の実取得や全機能の受入へ拡張せず、固定23の正式80runは合格（自動keyboard固定問題、通常plannerや子どもの実速度とは区別）、art parity HOLD、Human N=0、元Goal進行中/全Goal未完了を維持する。2枠/専用記念室の案を現在の正本として扱わない。

2026-09-09追記: 固定16の身支度04（`../../../output/island-experience/expression-04/report.json`）は無料cap/追加衣装の同住民互換と改名保持、写真・同予約復帰を両幅で確認。家具05（`../../../output/island-experience/furniture-05/report.json`）ではtabletの置場なし→周辺編集→同住民の利用が通過し、phoneの退避中断はFAILを保持する。これはR08/R09および取消/試しやすさの部分証拠であり、全104行・報酬16分類・交換24項目の実画面完了ではない。現在の追加修正・検証は[全体タスク](2026-09-08-island-experience.md)で追う。

2026-09-09採用履歴: F05/R09/R10/R12/R13/R14/R15と期間/季節は[仕様41](../../product/41_island_expression_collection_spec.md)を採用し、domain/storage・取得/装備UI・無料試用・音・写真外装・成長履歴へ接続済み。R10の全面体色、R11の同種内の新個体、R15の自由看板制作など既存の残差は消さない。固定10の家具試用は全3道具×3住民を通過したが、所有後の狭い置き直しは正当な到達不可で全体FAILを保持し、本人が使える配置を探す導線をその後実装した。共有作品の「部品全体が隠れる」という旧説明は実接点rayとの照合で撤回し、台の載せ面/作品全体の構図不足として追跡する。現在の詳細と限定証拠は[全体タスク](2026-09-08-island-experience.md)に記録し、F05統合前の固定10/11/12を現在のF05や全Goalの合格へ転用しない。

仕様37/38の現在差分はPA05/PA07/PA08/AC05/AC11/AC15/PK11へ追記した。その他の行の「コード照合済」は採用前の照合時点であり、以降の実装を未実装へ巻き戻す根拠にしない。現在の受入状況は[全体タスク](2026-09-08-island-experience.md)と[実画面の監査](../../design/audits/2026-09-08-island-experience/README.md)を併用し、順次各行へ反映する。写真はR14/R15とE20/E24の一部、展示/共同記憶はW03/W05/W09へ接続済みで、3仕事から記憶再訪までの実経路は未完。F03〜F05・16報酬全体・24比較全体の未充足を保持する。

F03/U6は[仕様39](../../product/39_island_appearance_sets_spec.md)へ追加採用した。R01〜R07/R16、E01〜E04/E09〜E18/E21〜E24の個別外見・セット・全景保存に対応し、R09/R13/R15は既存の装い/音/旗を保存する部分だけを含む。3シリーズ×6取得部位と12装備箇所はdomain/storage・UI・rendererへ実装済みで、実画面の確認範囲は次段落と各行へ記す。旧テーマ権と単品の重複なし交換、取得した後の利用、成長を保つmixを採用理由とする。R08の新家具、R10/R12/R14や季節/新しい音等の残りはこの仕様で完了としない。

2026-09-08の追加検証では、固定08のF03 rendererまで接続済み。appearance-04（`../../../output/island-experience/appearance-04/report.json`）でphone/tablet各54部位/slot＋3完成セット、実25ほし購入、slot-1の名前/全snapshot保存、試用取消、同予約復帰/reloadの選定経路がPASS（各78全DB検査）。仕様39全体の保存障害/旧権利/後続成長/profile/offline等は未実施。主島3土地の全景では屋根単品が小さいため、部位の見つけやすさも未充足として残す。F04/U3/U6は[仕様40](../../product/40_island_life_furniture_spec.md)へ追加採用し、R08/R11/R16とE01〜E03/E10〜E15/E19/E24を、選択取得→配置→住民利用→別配置へつなぐ。domain/storage・UI・rendererの接点/演技は実装済み。固定17/24の有限証拠をR08へ記録し、全利用/全保存境界の未確認を残す。新家具の永続目標登録はその後仕様35へ実装し、固定20の限定実UI経路をE04へ記録した。価格/不足表示だけで目標登録を代替しない。

- **既実装で十分（候補）**: 現行仕様と読んだコードで狙いを満たせそうという仮判定。実画面・回帰を照合した後にのみ「十分」へ確定できる。
- **既実装を改善（候補）**: 現行仕様に土台があり、差分の見せ方、用途、操作、連携を補う。存在する契約を再実装する決定ではない。
- **新規実装（候補）**: 読んだ現行仕様/島コードには目的を満たす具体的な体験がない、または一部のみ。別Park/Exploreの土台は記載し、再利用で島へ接続する候補も含む。
- **見送り**: 学習の損失・強制待ち・有料/オンライン等、現行Goalやlocal-firstとの明示的な衝突だけ。手間を理由に主要観点を落とさない。翻案できる価値は別の採用候補へ残す。
- P1/P2は実装順の候補で、P2はGoal対象外・見送りを意味しない。各候補は採用/非採用の理由と実装証拠を揃えて閉じる。

完了欄は今後、`code path / 仕様節 / 同一buildの実UI証拠 / 視覚 / 意味・学習非阻害 / runtime / 実参加者の確認範囲`で更新する。コードがあるだけ、全テストが通るだけ、画面一枚がきれいなだけでは全体完了にしない。

## Experience workpackages

| ID | 狙う体験・具体的な実装単位 | 主な現行土台 | 未充足を確認する内容・受入場面 |
|---|---|---|---|
| W01 感覚と緩急 | 押す/置く/洗う/受け渡す時の短い手応え、材質ごとの反応、日常・完成・大発見の強弱 | 28 入力音/正誤/局所反応、30 成熟案内 | 材質差と接地、洗って現れる変化、短い大発見。音off/reducedで同じ意味、学習の追加0操作とP95を保持 |
| W02 成長と見通し | 同じ物の輪郭・大きさ・用途が育ち、次の完成姿と住民の使い方が見える | 30 4地区・1/3/6段階・成熟拡張、36の次段階preview | 自分の現在の島で未来を試し見る。実際の完成/橋往来へ接続。全成熟後を架空の次章で埋めない |
| W03 暮らしと仲間 | 住民別の好み/仕事、任意の頼み事、散歩/おやつ/道具運搬、作った物の利用 | 28/30 3住民・興味・共有遊び・自発行動 | 同じ対象に違う住民、作る→住民が来る→役立つ。視線/手/物/接地/返事が一続きで読め、途中学習復帰可能 |
| W04 実験と仕掛け | 運ぶ/洗う/照らす/水へ置く道具、対象×場所×仲間、道/水/灯りの連鎖 | 28/30の3共有と36の2条件反応。別Parkの順序連鎖は島未接続 | 同一対象を別条件で試して差が分かる。水路→水車→開花等の因果が再現可能で、抽選で発見を代替しない |
| W05 発見と収集 | 発見順の棚、環境の手掛かり、段階ヒント、未知物の正体、展示と現地再演 | 30/36 実表示記録・保存順一覧・15案内・現地再演 | 初表示/未発見/記録済みを分ける。好きな発見を展示し、再演は同条件で即試せる。全部記録後も使う理由が残る |
| W06 創作と計画 | 題材付き/自由なおためし庭、部品制作、複数解の道や仕掛け、配置案保存、undo/範囲片付け | 28/30 無料単品編集・収納・取消、36の3配置保存/読取preview | 素材→制作→実利用。少なくとも異なる2構成、試作中の元島不変、一括反映/取消/前案復元。通常学習は制作条件に置き換えない |
| W07 来訪と再訪 | 環境で傾向が変わる来訪、能力差のない珍しい外見、漂着物、季節/朝夕、短い寄り道 | 30 蝶/舟/段階別自然反応、36の有限周期3来訪と既知再会 | 基本成長と独立し、未発見へ近づく手掛かりと再会経路。見逃し/休み/時計変更で損失なし。正体不明と抽選を分離 |
| W08 自分の世界と報酬 | 実景で好みを選ぶ。島全体に加え、空/水/家/植物/橋/家具/衣装/模様/仕草/足跡/音/図鑑/名札/セットを扱う | 35 3テーマ・3飾り・財布・確定交換・無料再着替え、36の名前/服/音 | 16報酬表で個々の採用と用途を決定。独立部品とまとまり、少額でも嬉しい形、完成後の住民利用。価格だけ増やして代替しない |
| W09 思い出と見せる | 同倍率の昔今、任意の写真構成、発見展示、命名、同端末見学 | 30 immutable3D比較、36の実framePNG/同端末見学 | 作った場面と住民の瞬間を残す。家族へ見せる時に学習情報や編集を前面へ出さず、外部送信を必須にしない |
| W10 学習と安心 | 既存入力/予約/支援/復習/独力判定、保存原子性、旧データ、profile分離、offline、任意性 | 28/30/35 と検証matrix | 新しい遊びのすべてから同じ学習へ復帰。支援同報酬、誤答/休みの損失0、通常連問追加0操作、完了と習得を混同しない |

W01/W02だけ、W08だけの完了で止めず、W03→W04→W05→W06を暮らしと試行の循環としてつなぐ。W07/W08/W09が再訪、自己表現、見せる理由を広げ、W10は全段階で守る。

## 104 items — current code audit

各行の「不足・具体案」は現コード照合後の採用候補。同じ目的を満たす現コードの土台を活かす。各行はコードの有無と狙う体験の充足を分け、U1〜U7は残る採用候補への対応を示す。原作の説明と公式出典は元の調査資料の同IDを参照する。

### PA — ぽこ あ ポケモン

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| PA01 生息地づくり | 数・位置・組合せが景色になる | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[visitors.ts](../../../src/domain/island/visitors.ts): 配置した物の距離・成長を条件に反応と来訪が成立。**コード照合済・実画面未照合** | 到達範囲の予告と本人が水/灯りをつなぐ生息環境制作は残る。採用候補 [U2/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W07へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W04/W07 | 環境の成立/不成立/置き直しで反応を比較。全件V0/V1/V2を併用 |
| PA02 環境から出会いへ | 自分の整備が誰かを招く | [visitors.ts](../../../src/domain/island/visitors.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 3来訪の環境条件・記録・発見後再会がある。**コード照合済・実画面未照合** | 来訪者を暮らしの仲間として迎える利用/持帰りと環境の種類を広げる。採用候補 [U3/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W07へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03/W07 | 同成長で環境を変え、訪問と再訪を確認。全件V0/V1/V2を併用 |
| PA03 世界へ作用する技 | 操作した場所がよくなる | [workshopScene.ts](../../../src/components/island/three/workshopScene.ts)と[workshop.ts](../../../src/domain/island/workshop.ts)に、回答の局所成長と別責務の洗浄/光/水を実装。gestures02で触れた区画・取消・同予約復帰を限定確認。 | 世界への作用を未実装へ戻さない。材質別の手応え、結果が先に読める緩急と全実経路の無説明理解はU1/U4に残る。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W01/W02 | 変更前後の到達点・入力位置・P95を比較。全件V0/V1/V2を併用 |
| PA04 移動能力の拡張 | 成長で行ける場所が増える | [landGeometry.ts](../../../src/domain/island/landGeometry.ts)・[navigation.ts](../../../src/components/island/three/navigation.ts)で東西解放と接続床を共有。固定36/37の診断成長0/1/2、東の実配置・同予約復帰を[限定確認](../../design/2026-09-09-island-renewal/connected-v17/README.md)。 | 旧床/橋と既定home画角の連続を保持。追加の初解放4経路は直前fixture→通常plannerの実3正答から保存/次予約まで限定PASS。初回からの全育成は証拠外、学習中不可視は当時仕様どおり。新ヘッダー通知は固定39・7実経路で限定PASS。本人のいかだ/短い観察先への移動操作は未採用候補U2/U5として残す。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W02/W04 | 成熟前後に実際の往来と新しい操作を確認。全件V0/V1/V2を併用 |
| PA05 クラフト | 集めた物が役に立つ | [workshop.ts](../../../src/domain/island/workshop.ts)・[workshopScene.ts](../../../src/components/island/three/workshopScene.ts)に3標本/4部品/2作品/水と軸、別draftを実装。workshop-diagnostic-04は両幅のA/B・undo・同予約復帰、shared-memories-06はA展示をBの上書き/削除から独立して再演する範囲がPASS。 | 主島展示/再訪は接続済み。残るのは修正後の住民による水源操作→結果の実画面と、仕様38の3仕事/共同記憶の実経路。別題材や自由な積み上げは採用範囲外の候補として区別する。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W06 | 部品選択→完成→利用→やり直しを実操作。全件V0/V1/V2を併用 |
| PA06 用事のない交流 | 一緒に過ごすこと自体が楽しい | [runtime.ts](../../../src/components/island/three/runtime.ts)、[residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts): 単独利用・二人共有・種類別の好み優先がある。**コード照合済・実画面未照合** | 好きな住民を確実に選ぶ交流、散歩/おやつと返事を広げる。採用候補 [U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03 | 同じ対象を違う住民と試し、返しの差を確認。全件V0/V1/V2を併用 |
| PA07 仲間ごとの仕事 | 仲間の個性が暮らしに必要になる | [sharedJobController.ts](../../../src/components/island/three/sharedJobController.ts)・[sharedMemories.ts](../../../src/domain/island/sharedMemories.ts)・[IslandSharedMemories.tsx](../../../src/components/island/IslandSharedMemories.tsx)に3仕事、同一物、実接触、描画後確定と任意お返しを接続済み。 | 未統合ではなく仕様38 M01〜M04/M12の実経路検証残。shared-memories-06/shared-camera-03はjobs.status=not-runで、展示のPASSを仕事のPASSへ転用しない。新navigationのmain8e・5292のQA03は入口selector FAIL、QA04は明示した完全復元後の実prepared保存を確認したが、controller開始前の経路拒否で未完。元失敗を保持し、実仕事の新PASSはまだない。物→手→結果→記憶再訪を確認する。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W03/W04 | 得意な仕事の開始→接触→結果が全身で読める。全件V0/V1/V2を併用 |
| PA08 小さなお願い | 誰かのために動く納得感 | [sharedMemoriesRepository.ts](../../../src/domain/island/sharedMemoriesRepository.ts)・[useIslandSharedMemories.ts](../../../src/components/island/useIslandSharedMemories.ts)にprepared/result-seen、明示再開/取消、同receipt再送を実装しruntimeへ接続。 | 仕事の途中停止/学習/実hidden→明示再開→可視結果とnative保存を同じ依頼で検証する。住民から任意題材を提案する遊びは現在の本人発注と別の未採用候補。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W03/W06 | 受ける/後回し/再開、未達損失なしを確認。全件V0/V1/V2を併用 |
| PA09 大きな共同目標 | 日常の積み重ねが大きな変化になる | [growth.ts](../../../src/domain/island/growth.ts)、[islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts): 4居場所の成熟・拡張と次の姿previewがある。**コード照合済・実画面未照合** | 複数の整備/制作が共同広場の実用途へ結ばれる長期目標を追加。採用候補 [U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W03 | 異なる育成順で完成と住民利用を比較。全件V0/V1/V2を併用 |
| PA10 家内外の模様替え | 同じ進行でも自分らしさが残る | [appearance.ts](../../../src/domain/island/appearance.ts)、[IslandCustomization.tsx](../../../src/components/island/IslandCustomization.tsx)、[experience.ts](../../../src/domain/island/experience.ts): 仕様39の12slot・個別試用/交換・3つの全景保存にsourceあり。**実装/担当回帰あり・実画面未合格** | 空/家/庭のmix、取得権と今回適用の分離、音/衣装/旗を含む保存を接続。成長途中/成熟/異テーマmixの実画面、S01〜S11の全体受入は残る。 | 採用・実装/検証中：仕様39へ接続し残る受入を保持 | P1 / W08/W06 | 家/庭の組合せ、元へ戻す、reload保存。全件V0/V1/V2を併用 |
| PA11 好みに合わせる料理 | 知った好みを行動に生かせる | [runtime.ts](../../../src/components/island/three/runtime.ts)、[types.ts](../../../src/domain/island/types.ts): 既存共有は花/光/水で食材・料理状態はない。**コード照合済・実画面未照合** | 住民の好みに合わせた任意おやつ作り→手渡し→返しを追加、空腹罰なし。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W03/W06 | 好き/別の好みの反応、何度でも再制作。全件V0/V1/V2を併用 |
| PA12 集めた音楽を使う | 収集が日々の感覚を変える | [experience.ts](../../../src/domain/island/experience.ts)、[useIslandAmbience.ts](../../../src/components/island/useIslandAmbience.ts): 3音景は無料選択/保存できるが収集した音ではない。**コード照合済・実画面未照合** | 見つけた自然音/短い演奏を棚へ残し試聴・適用する取得後の用途を追加。採用候補 [U6/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W08/W05へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W08/W05 | 試聴/停止/適用/音off、英語音声との分離。全件V0/V1/V2を併用 |
| PA13 落とし物の鑑定 | 拾う時と分かる時に期待がある | [types.ts](../../../src/domain/island/types.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 固定の発見IDと条件案内はあるが未知の現物・観察途中状態はない。**コード照合済・実画面未照合** | 拾う→洗う/照らす→同じ現物の正体と性質が分かる→展示を追加。採用候補 [U1/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W05/W07へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W05/W07 | 途中保存/再開、同じ物の正体が変わらない。全件V0/V1/V2を併用 |

### YO — ヨッシーとフカシギの図鑑

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| YO01 触って特徴を知る | 説明より先に自分で分かる | [runtime.ts](../../../src/components/island/three/runtime.ts)、[IslandItems.tsx](../../../src/components/island/IslandItems.tsx): 家具tapで住民利用、編集で物の位置を変えられる。**コード照合済・実画面未照合** | 本人が対象を運び、洗う/照らす/浮かべる道具で性質を調べる操作を追加。採用候補 [U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W04 | 同じ対象の複数操作と結果を実画面比較。全件V0/V1/V2を併用 |
| YO02 感覚も発見になる | 強さ以外の違いが面白い | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[audio.ts](../../../src/utils/audio.ts): 花びらの波紋/灯りの水面反射はあるが道具別性質・材質SEはない。**コード照合済・実画面未照合** | 同じ対象の透け方/浮沈/鳴り方を比較し、音offでも分かる反応へ。採用候補 [U1/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W04へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W04 | 音offでも形と動きで性質を区別できる。全件V0/V1/V2を併用 |
| YO03 運んで試す | 対象を別の場所へ連れていける | [runtime.ts](../../../src/components/island/three/runtime.ts)、[types.ts](../../../src/domain/island/types.ts): 住民が共有物を運ぶ演技はあるが本人の運搬actionはない。**コード照合済・実画面未照合** | 本人が対象と行き先を選び同じ物を別場所へ運ぶ。途中取消/保存を設ける。採用候補 [U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04 | 運ぶ/途中中止/別の行き先、元物の保持。全件V0/V1/V2を併用 |
| YO04 生き物と環境の相互作用 | 別々だった物がつながる発見 | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts): 花×水・灯り×水と住民の好み優先がある。**コード照合済・実画面未照合** | 2つの固定反応に加え、対象×道具×環境×仲間の性質を別条件へ使う。採用候補 [U1/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W04/W03 | 同一条件の再現と1条件変更時の差を検査。全件V0/V1/V2を併用 |
| YO05 条件を変える実験 | 知ったことを別条件で試したくなる | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は固定ペアの条件反応、別Parkは部品順で結果が変わる。**コード照合済・実画面未照合** | 同一道具/対象を水辺と木陰で比べる対照実験へつなぐ。採用候補 [U1/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04 | 場所だけを変えた対照操作を記録。全件V0/V1/V2を併用 |
| YO06 発見の意味がすぐ分かる | 自分の行動の意味が確定する | [runtime.ts](../../../src/components/island/three/runtime.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 実表示後の記録と反応に対応する説明/案内がある。**コード照合済・実画面未照合** | 新道具の実結果と『ういた/すけた』を同期し、未来予告と観察事実を分ける。採用候補 [U1/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W05へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W04/W05 | 実表示と『ういた』等の記録が一致。全件V0/V1/V2を併用 |
| YO07 自分の順番で図鑑が育つ | 自分だけの調査の道筋が残る | [IslandAlbum.tsx](../../../src/components/island/IslandAlbum.tsx): 発見記録は追加順で保存されアルバムもその順で表示する。**コード照合済・実画面未照合** | 順序の土台は充足。初観察時点/実物の棚/本人が選ぶ展示を追加。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W05へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W05 | 異なる発見順、重複再演、reloadで順保持。全件V0/V1/V2を併用 |
| YO08 命名 | 発見者になれる | [experience.ts](../../../src/domain/island/experience.ts): 島・住民・保存配置へ名前を付けられる。**コード照合済・実画面未照合** | 発見物そのものへの名付けと棚の名札は残る。空欄でも既定名で遊べる。採用候補 [U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W08/W09へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W08/W09 | 長名/空名/取消/再命名/同端末表示。全件V0/V1/V2を併用 |
| YO09 大発見で一区切り | 日常の観察に見せ場と終点がある | [runtime.ts](../../../src/components/island/three/runtime.ts)、[discoveryPage.ts](../../../src/domain/explore/discoveryPage.ts): 島は発見記録、別Exploreは特徴→大発見の順序を持つ。**コード照合済・実画面未照合** | 島の小実験が一つの正体へつながる短い山場と自然な一区切りへ統合。採用候補 [U1/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W05へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W05 | 日常/発見/成熟の強弱、待ち条件0を確認。全件V0/V1/V2を併用 |
| YO10 終わった後の余白とヒント | 一区切りの後にも試したいことが残る | [IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx)、[visitors.ts](../../../src/domain/island/visitors.ts): 未発見の条件別案内・育成/配置入口・記録後の即再演がある。**コード照合済・実画面未照合** | 環境の実手掛かりと複数段階ヒントを新しい観察へ広げ、無料支援を保持。採用候補 [U1/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W05/W10へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W05/W10 | 未発見ヒント→発見→任意再演、支援無料。全件V0/V1/V2を併用 |
| YO11 知識から世界が広がる | 知ったことが次の好奇心を開く | [discoveryPage.ts](../../../src/domain/explore/discoveryPage.ts)、[types.ts](../../../src/domain/island/types.ts): 別Exploreに手掛かりの連鎖はあるが島に観察道具/次題材はない。**コード照合済・実画面未照合** | 一つの性質を知ると別の対象へ同じ道具を試せる次テーマを実体験化。採用候補 [U1/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W05へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W05 | 発見前後で増える具体操作、架空の解放なし。全件V0/V1/V2を併用 |

### MC — Minecraft

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| MC01 壊す・置く | 一手が世界に残る | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[runtime.ts](../../../src/components/island/three/runtime.ts): 単品をdrag/tap/方向ボタンで置き、収納・取消できる。**コード照合済・実画面未照合** | 配置成立の接地/短い反発/材質音を磨く。部品の接続は別途追加。採用候補 [U4/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W06 | touch/keyboardの置く→戻す、接地を確認。全件V0/V1/V2を併用 |
| MC02 採集から制作へ | 欲しい物から行動の目的が生まれる | [types.ts](../../../src/domain/island/types.ts)、[simulation.ts](../../../src/domain/park/simulation.ts): 島に材料→制作はなく、別Parkは学習後部品と並べる工房がある。**コード照合済・実画面未照合** | 観察で得る部品を工房で組み、住民が利用する作品へ保存。採用候補 [U1/U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06/W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06/W04 | 発見→部品→制作→実利用→再制作。全件V0/V1/V2を併用 |
| MC03 不足が見えるレシピ | あとどれだけか分かる | [islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts)、[customization.ts](../../../src/domain/island/customization.ts): 次成長の実景previewと不足ほし表示がある。**コード照合済・実画面未照合** | 未制作の形/用途/不足部品を同構図で見せるレシピpreviewは残る。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W06 | 未完成/中間/完成を同構図、用途と一致。全件V0/V1/V2を併用 |
| MC04 道具で行為が増える | 成長が新しい動詞になる | [types.ts](../../../src/domain/island/types.ts)、[experience.ts](../../../src/domain/island/experience.ts): 島のactionには道具利用がなく、成長は既定の利用解放。**コード照合済・実画面未照合** | 運ぶ/洗う/照らす/浮かべる道具から本人の新しい動詞を増やす。採用候補 [U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04 | 新道具で新しい行動、学習DB不変。全件V0/V1/V2を併用 |
| MC05 制約の少ない創作 | 失う心配なく試せる | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[experience.ts](../../../src/domain/island/experience.ts): 単品取消と保存済み3配置の読取preview/一括適用がある。**コード照合済・実画面未照合** | preview中に自由編集できる別draft、複数操作undo、まとめて取消は残る。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06 | 試作中DB不変、取消/反映/元配置復元。全件V0/V1/V2を併用 |
| MC06 遊び方の選択 | 気分に合う遊び方を選べる | [Island.tsx](../../../src/pages/Island.tsx): 学習/自由遊び/配置/成長/図鑑/外見/見学を選べる。**コード照合済・実画面未照合** | 観察道具・工房・手伝いの任意入口を同じ島へ接続、開始前必須操作は増やさない。採用候補 [U1/U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W04/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03/W04/W06 | 各遊びを中断して同じ学習予約へ戻る。全件V0/V1/V2を併用 |
| MC07 環境ごとの個性 | 遠くの景色が次の期待になる | [growth.ts](../../../src/domain/island/growth.ts)、[livingSettings.ts](../../../src/domain/island/livingSettings.ts): 4居場所・成長外形・場所固有の反応がある。**コード照合済・実画面未照合** | 同じ道具の環境差、地区に合う生物/音景と本人が選ぶ用途を広げる。採用候補 [U1/U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W04/W08へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W04/W08 | 同画角で地区識別、同一道具の条件差。全件V0/V1/V2を併用 |
| MC08 開始地点を選べる | 偶然の全部を受け身にしない | [Island.tsx](../../../src/pages/Island.tsx)、[experience.ts](../../../src/domain/island/experience.ts): 表示地区/育成先/保存配置を選べるが遠征/試作題材はない。**コード照合済・実画面未照合** | 観察先と工房題材を本人が選ぶ。既存島の再生成や成果の破棄はしない。採用候補 [U2/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W06/W07へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W04/W06/W07 | 選択前後に既存島の所有/配置不変。全件V0/V1/V2を併用 |
| MC09 宝の地図 | 見えていない目的地を追いたい | [IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx)、[discoveryPage.ts](../../../src/domain/explore/discoveryPage.ts): 島は一覧の条件ヒント、別Exploreに段階的手掛かりがある。**コード照合済・実画面未照合** | 足跡/波紋/遠い灯りを現地で追い、未知の対象へ近づく短い探索にする。採用候補 [U1/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W05/W07へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W05/W07 | 手掛かり→現地→発見、文字だけで代替しない。全件V0/V1/V2を併用 |
| MC10 施設が行動範囲を変える | 作った物が新しい遊びを開く | [growth.ts](../../../src/domain/island/growth.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 成熟による橋/地区と既定家具の利用がある。**コード照合済・実画面未照合** | 作った水路/灯り/橋で実際に渡る・照らす・動かす用途を増やす。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W04/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W04/W06 | 見た目の完成と新操作を同時に検証。全件V0/V1/V2を併用 |
| MC11 複数の入手経路 | 好きな方法で目標へ近づける | [customization.ts](../../../src/domain/island/customization.ts)、[visitors.ts](../../../src/domain/island/visitors.ts): 確定交換と来訪の有限周期・記録後再会を分けている。**コード照合済・実画面未照合** | 必須部品も確定解放/自由試作とし、珍しい見た目は用途の唯一条件にしない。採用候補 [U2/U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07/W10へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W07/W10 | 抽選不発でも必須機能完遂、再演即利用。全件V0/V1/V2を併用 |
| MC12 準備できる運 | 準備が偶然の期待につながる | [visitors.ts](../../../src/domain/island/visitors.ts)、[livingSettings.ts](../../../src/domain/island/livingSettings.ts): 物/環境/成長と4区間周期で3来訪、既知なら周期外も再会できる。**コード照合済・実画面未照合** | 原作の準備で候補が変わる価値は土台あり。環境の実手掛かりと来訪種類を広げる。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W07 | 固定乱数/条件差/保証経路、学習同報酬。全件V0/V1/V2を併用 |
| MC13 経験を道具へ使う | 経験が愛用の物へ宿る | [types.ts](../../../src/domain/island/types.ts)、[experience.ts](../../../src/domain/island/experience.ts): 外見設定はあるが道具・愛用品の使用記録はない。**コード照合済・実画面未照合** | 観察道具に無料の模様/使用記念と新用途を結び、学習性能を優遇しない。採用候補 [U1/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W08へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W04/W08 | 性能で学習を優遇せず、外観復元と用途再演。全件V0/V1/V2を併用 |
| MC14 仕掛けの連鎖 | 一つの操作が離れた場所へ届く | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は2物の固定反応。別Parkは複数部品の因果連鎖を実行する。**コード照合済・実画面未照合** | 水路→水車→ベル/開花の3段以上を本人が接続し、切断/向きで結果を変える。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W06 | 接続/非接続/向き変更で因果が変わる。全件V0/V1/V2を併用 |
| MC15 周期とタイミング | 規則を予測する楽しさ | [simulation.ts](../../../src/domain/park/simulation.ts)、[audio.ts](../../../src/utils/audio.ts): 別Parkにはベルを含む順序実行、島に音/灯りの並べる仕掛けはない。**コード照合済・実画面未照合** | 工房で停止/再演/並替え可能な音と灯りの周期を作る。音offは点灯で伝える。採用候補 [U2/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06/W08へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W06/W08 | 並び通りの時系列、音off/reducedでも読める。全件V0/V1/V2を併用 |
| MC16 自動化 | 自分の発明が働き続ける | [runtime.ts](../../../src/components/island/three/runtime.ts)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は自発の既定行動、別Parkは手動再演するコース。**コード照合済・実画面未照合** | 作った装置をホームで穏やかに動かす。放置報酬なしで背景化は停止。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W06 | 背景化停止/再開、長時間でも学習DB不変。全件V0/V1/V2を併用 |
| MC17 複数の作り方 | 工夫の余地が残る | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は単品自由配置、別Parkは順序により複数結果が出る。**コード照合済・実画面未照合** | 同じ用途を2つ以上の部品配置で実現し、唯一解にしない工房へ統合。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06 | 少なくとも異なる2構成で利用成立。全件V0/V1/V2を併用 |
| MC18 材質の音 | 触れた物の違いを耳でも感じる | [audio.ts](../../../src/utils/audio.ts)、[useIslandAmbience.ts](../../../src/components/island/useIslandAmbience.ts): 回答/tap音と3環境音はあるが木/石/草/水の触覚SEはない。**コード照合済・実画面未照合** | 触れた材質に対応する短音/局所変形/接地反応を追加し声を優先。採用候補 [U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W08へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W08 | 素材別差、音off、英語音声と重ならない。全件V0/V1/V2を併用 |

### SC — SimCity / BuildIt

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| SC01 育つ条件を作る | 全部を自分で置かなくても街が育つ | [growth.ts](../../../src/domain/island/growth.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 確定成長による自動設置と到達可能な住民利用がある。**コード照合済・実画面未照合** | 現実画面で無編集/編集後の用途を確認し、工房作品にも同じ利用契約を広げる。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W03 | 無編集/編集済の両方で住民が実利用。全件V0/V1/V2を併用 |
| SC02 小さな経済の循環 | 個別の物に全体の意味が生まれる | [runtime.ts](../../../src/components/island/three/runtime.ts)、[types.ts](../../../src/domain/island/types.ts): 共有の運搬演技はあるが採集/納品/再利用の循環状態はない。**コード照合済・実画面未照合** | 花/実→住民の運搬→おやつ/工房へ一続きにする。維持費や空腹は除く。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W03/W06 | 各物の出所/運搬/利用が連続して見える。全件V0/V1/V2を併用 |
| SC03 同じ建物の拡張 | 愛用の建物が育つ | [growthVisuals.ts](../../../src/components/island/three/growthVisuals.ts)、[islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts): 家の成長geometryと次段階previewがある。**コード照合済・実画面未照合** | 姿の予告を実際の新しい利用と結ぶ。現画面で初期/途中/成熟を同倍率確認。採用候補 [U3/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02 | 初期/途中/成熟を同画角で比較。全件V0/V1/V2を併用 |
| SC04 効果範囲の予告 | 置いた後の結果を予測できる | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[livingSettings.ts](../../../src/domain/island/livingSettings.ts): 単品の配置可否と距離条件があるが反応範囲のoverlayはない。**コード照合済・実画面未照合** | 編集中だけ水/光/接続の届く範囲と仮結果を見せる。採用候補 [U2/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W04/W06 | 範囲内外・境界・回転を視覚と判定で照合。全件V0/V1/V2を併用 |
| SC05 因果を見える化 | うまくいかない理由が分かる | [livingSettings.ts](../../../src/domain/island/livingSettings.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 実距離/経路で不成立になるが『つながりをみる』表示はない。**コード照合済・実画面未照合** | 水/光/道の原因を重ね、1変更で成立する箇所を示す。採用候補 [U2/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W06 | 不成立理由→一変更→成立を確認。全件V0/V1/V2を併用 |
| SC06 節目で選択肢が増える | 蓄積が次の可能性になる | [growth.ts](../../../src/domain/island/growth.ts)、[islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts): 成熟の土地/利用解放と次の姿previewがある。**コード照合済・実画面未照合** | 解放直後の実操作が予告と一致するか実画面確認、新道具にも同じ契約。採用候補 [U1/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02 | 成熟前の予告と後の操作が一致。全件V0/V1/V2を併用 |
| SC07 条件と変化を待つ | 整えた後に変化を見届けたい | [visitors.ts](../../../src/domain/island/visitors.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 3来訪の周期と自発行動がある。恒久成長は完了区間だけ。**コード照合済・実画面未照合** | 待ち時間の強制なしに環境変化や漂着物の次の気配を追加。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W07 | 長短中断で成長不変、訪問候補のみ変化。全件V0/V1/V2を併用 |
| SC08 公園が使われる | 置いた物が誰かの喜びになる | [runtime.ts](../../../src/components/island/three/runtime.ts)、[residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts): 既定家具を到達可能な住民が使い、好み優先がある。**コード照合済・実画面未照合** | 同じ家具への住民別の返しと、制作した新しい物の実利用を追加。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03 | 初利用と再利用を全身/接触面で確認。全件V0/V1/V2を併用 |
| SC09 接続の達成 | 別々の場所がつながる | [growth.ts](../../../src/domain/island/growth.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 既定の東西橋と住民経路がある。**コード照合済・実画面未照合** | 本人がつないだ場所を人/運ぶ物/舟が往来する因果へ広げる。採用候補 [U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W03 | 開通後の往来と配置変更後の経路。全件V0/V1/V2を併用 |
| SC10 街の専門化 | 全部盛り以外の個性がある | [experience.ts](../../../src/domain/island/experience.ts)、[customization.ts](../../../src/domain/island/customization.ts): 同じ成長で3配置案とテーマを使い分けられる。**コード照合済・実画面未照合** | 花/水/工作の用途まで変える題材と部品を加え、見た目以上の選択へ。採用候補 [U2/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06/W08へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P2 / W06/W08 | 同じ進行で異なる2つの暮らしを作れる。全件V0/V1/V2を併用 |
| SC11 予定外の事件 | 安定した日常に新しい行動理由ができる | [visitors.ts](../../../src/domain/island/visitors.ts): 成果破壊なしで3来訪がある。**コード照合済・実画面未照合** | 破壊災害の代わりに風/漂着物/旅人の短い出来事へ広げ、見逃しても再会。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W07 | 発生/見逃し/再会で成果を失わない。全件V0/V1/V2を併用 |
| SC12 成果を回収する | 出来上がりを手で受け取る | [commit.ts](../../../src/domain/island/commit.ts)、[IslandItems.tsx](../../../src/components/island/IslandItems.tsx): 成長の確定に受取ボタンは不要、任意の収穫操作はない。**コード照合済・実画面未照合** | 強制回収は採用せず、任意の果実を取る/部品をはめる操作に手応えを実装。採用候補 [U1/U2/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W06/W10へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W01/W06/W10 | 収穫を無視して連問可能、任意操作の短い反応。全件V0/V1/V2を併用 |
| SC13 材料の納品で完成 | 大きな目標が小さな手順になる | [types.ts](../../../src/domain/island/types.ts)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は段階成長で部品納品なし、別Parkは所有部品の配置がある。**コード照合済・実画面未照合** | 部品が完成物の対応位置にはまる制作と途中保存を追加。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06 | 途中保存/取消、部品と完成物の対応。全件V0/V1/V2を併用 |
| SC14 置き直しの支援 | 配置をやり直せる安心感 | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[experience.ts](../../../src/domain/island/experience.ts): 単品移動/取消と3保存配置の復元がある。**コード照合済・実画面未照合** | 接地方向の手応えに加え、編集中の複数操作undoと全体draft取消を追加。採用候補 [U4/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W06 | touch/keyboard、影/向き/取消とDB比較。全件V0/V1/V2を併用 |

### FO — Forest

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| FO01 努力が育つ姿になる | 見えにくい積み重ねが見える | [growth.ts](../../../src/domain/island/growth.ts)、[growthVisuals.ts](../../../src/components/island/three/growthVisuals.ts): 同じ対象の1/3/6区間と中間geometryがある。**コード照合済・実画面未照合** | 数字なしで育った場所を指せる輪郭・途中の魅力を実画面で確認。採用候補 [U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02 | 初期/1/3/6区間を同倍率で比較。全件V0/V1/V2を併用 |
| FO02 育てる対象を選ぶ | 自分で選んだから見届けたい | [islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts)、[repository.ts](../../../src/domain/island/repository.ts): 任意の育成先・次段階previewと予約時の対象固定がある。**コード照合済・実画面未照合** | 未来の姿に加え新しい用途を動作で見せ、現予約と次予約を分ける。採用候補 [U3/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02 | 選択しない開始、変更は次予約だけへ反映。全件V0/V1/V2を併用 |
| FO03 始め方に幅がある | 予定を決めても、少しだけでも始められる | [repository.ts](../../../src/domain/island/repository.ts)、[Island.tsx](../../../src/pages/Island.tsx): 初回3問・同予約の再開と自動継続の接続がある。**コード照合済・実画面未照合** | 追加タイマーは統合不要候補。新遊びを中断して同じ短い入口へ戻る実操作を確認。採用候補 [U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W10へ統合） | 既実装で十分（候補）：読んだコードは契約に対応。実画面/回帰後に採否判断 | P1 / W10 | 実初回/中断/再開、追加0操作の確認後に十分判定。全件V0/V1/V2を併用 |
| FO04 成果が風景に残る | 一回の達成が消えずに積み上がる | [growth.ts](../../../src/domain/island/growth.ts)、[IslandAlbum.tsx](../../../src/components/island/IslandAlbum.tsx): 成長と節目snapshotが保存され同rendererで比較できる。**コード照合済・実画面未照合** | 新しい制作/観察の思い出も残す。名前/服は現成長snapshotの記録対象外。採用候補 [U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W09へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W09 | 別日/reloadで同じ成長、過去snapshot不変。全件V0/V1/V2を併用 |
| FO05 種類や音の解放 | 同じ活動でも楽しみが変わる | [customization.ts](../../../src/domain/island/customization.ts)、[experience.ts](../../../src/domain/island/experience.ts): 3テーマ/3飾りと無料の服/音景選択がある。**コード照合済・実画面未照合** | 個別植物/模様/音の取得と暮らしの用途を全16報酬へ展開。採用候補 [U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W08へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P2 / W08 | 各報酬の実景preview→交換→利用→復元。全件V0/V1/V2を併用 |
| FO06 振り返り | 自分の積み重ねが読み取れる | [IslandAlbum.tsx](../../../src/components/island/IslandAlbum.tsx)、[commit.ts](../../../src/domain/island/commit.ts): 子ども向け成長比較と学習実績保存は別経路。**コード照合済・実画面未照合** | 任意の写真/発見物/共同作業の記念と保護者記録を混同しない表示を整える。採用候補 [U5/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W09/W10へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W09/W10 | 子ども記念とSRS/学習記録の内容を照合。全件V0/V1/V2を併用 |
| FO07 短期と長期の目標 | 今日の一歩と先の楽しみがつながる | [islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts)、[customization.ts](../../../src/domain/island/customization.ts): 次の成長と欲しい外見の目標がある。**コード照合済・実画面未照合** | 今日の小さなお手伝いと期限なしの工房作品を追加、途中状態を保持。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W03/W06 | 途中保存、期限/連続日数の損失なし。全件V0/V1/V2を併用 |
| FO08 季節の外見 | 慣れた場所へ新鮮な気持ちで戻れる | [customization.ts](../../../src/domain/island/customization.ts)、[experience.ts](../../../src/domain/island/experience.ts): 3テーマと3音景に季節状態・季節の選択はない。**コード照合済・実画面未照合** | 葉/空/小物の季節を自由選択し、過去季節へも期限なく戻す。採用候補 [U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07/W08へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W07/W08 | 季節選択/再訪/過去への復元、期限なし。全件V0/V1/V2を併用 |
| FO09 環境音 | 静かにその場へ入り込める | [useIslandAmbience.ts](../../../src/components/island/useIslandAmbience.ts)、[experience.ts](../../../src/domain/island/experience.ts): 風/水/夕べの静かな合成音を保存、学習/背景/offで停止する。**コード照合済・実画面未照合** | 環境音選択の土台は充足候補。実端末の開始拒否・音off・声優先の実画面/実音確認を残す。採用候補 [U4/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W08へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P2 / W01/W08 | 試聴と停止、background/off、英語音声優先。全件V0/V1/V2を併用 |
| FO10 休憩の体験 | 休む時間も心地よい | [Island.tsx](../../../src/pages/Island.tsx)、[runtime.ts](../../../src/components/island/three/runtime.ts): homeは自発行動、見学画面はreadOnlyで暮らしの自発実行も止まる。**コード照合済・実画面未照合** | 誤編集/誤記録なしに暮らしを眺められる見学へ広げ、急かす案内を抑える。採用候補 [U5/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W09へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03/W09 | 無操作で暮らしを観察、中断/終了が自然。全件V0/V1/V2を併用 |
| FO11 いっしょに集中 | 誰かと一緒に取り組んでいる感覚 | [Island.tsx](../../../src/pages/Island.tsx)、[experienceRepository.ts](../../../src/domain/island/experienceRepository.ts): 同端末の見学とprofile所有保存がある。**コード照合済・実画面未照合** | オンライン共同責任は不要。見学/交代から元profileへ戻り記録が混ざらないか実確認。採用候補 [U5/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W09/W10へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P2 / W09/W10 | 家族見学から戻る、別profileの保存不変。全件V0/V1/V2を併用 |
| FO12 オフラインの基本機能 | 場所に左右されず始められる | [repository.ts](../../../src/domain/island/repository.ts)、[experienceRepository.ts](../../../src/domain/island/experienceRepository.ts): IndexedDB transaction・所有検査・再送経路がある。**コード照合済・実画面未照合** | 実SW offlineは本監査で未実行。追加した観察/作品の途中再開へ契約を広げる。採用候補 [U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W10へ統合） | 既実装で十分（候補）：読んだコードは契約に対応。実画面/回帰後に採否判断 | P1 / W10 | 実SW offline、旧データ、途中保存、profile分離。全件V0/V1/V2を併用 |
| FO13 外への貢献 | 自分の活動が外へ届く | [runtime.ts](../../../src/components/island/three/runtime.ts)、[residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts): 自分の育った家具を住民が使う。**コード照合済・実画面未照合** | 外部寄付はlocal-first範囲外。本人の制作/手伝いが誰の役に立つかまで実演。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03 | 作った物の利用者と喜びを実演で確認。全件V0/V1/V2を併用 |

### AC — あつまれ どうぶつの森

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| AC01 したいことから遊ぶ | 今日の気分が目的になる | [Island.tsx](../../../src/pages/Island.tsx): 自由遊び/図鑑/編集/見学などの任意入口がある。**コード照合済・実画面未照合** | 工房・道具・手伝いを本人の順で行き来できる島へ追加。採用候補 [U1/U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W04/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03/W04/W06 | 3種入口の行き来、学習予約を壊さず復帰。全件V0/V1/V2を併用 |
| AC02 現実の時間と季節 | 同じ場所に暮らしている実感 | [customization.ts](../../../src/domain/island/customization.ts)、[experience.ts](../../../src/domain/island/experience.ts): テーマと夕べの音はあるが朝夕の光/季節は未選択。**コード照合済・実画面未照合** | 実時刻に参加条件を縛らず朝夕・季節の表情を選べるようにする。採用候補 [U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07/W08へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W07/W08 | 時刻変化/時計後退/任意切替で進行不変。全件V0/V1/V2を併用 |
| AC03 環境を読む発見 | 知っていると出会いを探せる | [visitors.ts](../../../src/domain/island/visitors.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 環境/成長別の来訪条件と未発見の案内がある。**コード照合済・実画面未照合** | 一覧外の現地の足跡/気配を設け、整えた環境で探す実行へつなぐ。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W05/W07へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W05/W07 | 条件表示と実候補の一致、同条件で再会。全件V0/V1/V2を併用 |
| AC04 初めての記録 | 初体験が自分の履歴になる | [runtime.ts](../../../src/components/island/three/runtime.ts)、[IslandAlbum.tsx](../../../src/components/island/IslandAlbum.tsx): 実表示後に安定IDを一度記録し保存順で一覧にする。**コード照合済・実画面未照合** | この原則は充足候補。新道具/作品も表示前に記録せず、再送を含め実確認。採用候補 [U1/U5/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W05へ統合） | 既実装で十分（候補）：読んだコードは契約に対応。実画面/回帰後に採否判断 | P1 / W05 | 未表示/表示/再演/保存retryを照合後に十分判定。全件V0/V1/V2を併用 |
| AC05 博物館 | 集めた物を歩いて眺めたい | [sharedDisplayScene.ts](../../../src/components/island/three/sharedDisplayScene.ts)、[IslandSharedMemories.tsx](../../../src/components/island/IslandSharedMemories.tsx): 主島3展示、同じ標本参照/作品snapshot、実物の表示/近景/選択UIを接続。 **実装/範囲内証拠あり・全体未合格** | 本人の配置/移動/収納と実物の再訪を仕様38 M06〜M08で検証する。静的geometryの12testsは実操作完成の証拠ではない。 | 採用・実装/検証中：元の価値を仕様37/38へ接続し、残る受入を保持 | P1 / W05/W09 | 展示選択→現地再演、未所持や再抽選なし。全件V0/V1/V2を併用 |
| AC06 化石の鑑定 | 見つけた後にも正体を知る楽しみがある | [types.ts](../../../src/domain/island/types.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 未発見の案内はあるが同一の未知現物を鑑定する状態はない。**コード照合済・実画面未照合** | 洗う/照らすで表面と性質が出て正体へ到達し、現物と図鑑を結ぶ。採用候補 [U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W05へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W04/W05 | 観察途中の保持、結果の決定性、再試行。全件V0/V1/V2を併用 |
| AC07 DIY | 集めた物に使い道ができる | [simulation.ts](../../../src/domain/park/simulation.ts)、[types.ts](../../../src/domain/island/types.ts): 別Parkに部品選択・順序実行、島に制作物の状態はない。**コード照合済・実画面未照合** | 材料を選び2案以上を組む工房として再利用/接続。通常算数入力は置換しない。採用候補 [U2/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06/W10へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06/W10 | 実制作2案、学習問題/独力判定は不変。全件V0/V1/V2を併用 |
| AC08 施設と住民が増える | 自分以外にも暮らしが広がる | [growth.ts](../../../src/domain/island/growth.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 4居場所・7物・3住民と段階別利用がある。**コード照合済・実画面未照合** | 完成後の道具/共同作業/観察先を追加し、全成熟後も用途を残す。採用候補 [U1/U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W03/W04へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W03/W04 | 既定成長と追加用途、全成熟後の利用。全件V0/V1/V2を併用 |
| AC09 自己表現 | 人と違ってもよい場所がある | [experience.ts](../../../src/domain/island/experience.ts)、[customization.ts](../../../src/domain/island/customization.ts): 配置/テーマ/飾り/島名/住民名/旗/服/音を保存できる。**コード照合済・実画面未照合** | 個別配色・模様・道/家/植物の組合せを追加、外見と学習能力を分離。採用候補 [U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W08へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W08 | 同じ成長で異なる姿、再着替え/旧snapshot。全件V0/V1/V2を併用 |
| AC10 地形と動線づくり | 見た目と歩きやすさがつながる | [IslandItems.tsx](../../../src/components/island/IslandItems.tsx)、[simulation.ts](../../../src/domain/park/simulation.ts): 島は既定土地の家具編集、別Parkには6枠までの部品コースがある。**コード照合済・実画面未照合** | 別draftで道/橋/水の接続を試し、2通りの動線を作る。採用候補 [U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W06 | 2通りの動線、接続切替、取消と住民経路。全件V0/V1/V2を併用 |
| AC11 住民との関係 | 会いに行く理由ができる | [sharedMemories.ts](../../../src/domain/island/sharedMemories.ts)・[sharedJobController.ts](../../../src/components/island/three/sharedJobController.ts)に同住民/同対象/仕事の記憶、当時名、有限12件、実再訪反応を実装。 | M04/M05の仕事完了→reload→同対象の返し、満杯/明示整理後の記録を実操作で確認する。旧互換QAのcarry記憶保持は限定証拠で、全3仕事/全記憶受入へ広げない。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W03/W05 | 住民別の反応、別profileへ記憶が漏れない。全件V0/V1/V2を併用 |
| AC12 活動を案内する目標 | 何をすればよいか迷いにくい | [IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx)、[customization.ts](../../../src/domain/island/customization.ts): 発見条件別の次操作と欲しい外見を案内する。**コード照合済・実画面未照合** | 木陰作り/水路/観察物など本人が作る目的を実完成物へつなぐ。採用候補 [U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W03/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W03/W06 | 目標の実完成物と一致、未選択でも連問。全件V0/V1/V2を併用 |
| AC13 予期しない来訪や空模様 | 予定外の出来事が日常を豊かにする | [visitors.ts](../../../src/domain/island/visitors.ts): 条件に合う3来訪があるが空模様/漂着物の出来事はない。**コード照合済・実画面未照合** | 小さな風景イベントと再会できる漂着物を基本成長と別に追加。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W07 | 見逃し/reload/再訪/保証経路を確認。全件V0/V1/V2を併用 |
| AC14 離島への遠征 | 出かけて持ち帰る循環がある | [Island.tsx](../../../src/pages/Island.tsx)、[types.ts](../../../src/domain/island/types.ts): 島は地区focusのみで観察先への出発/持帰りの状態がない。**コード照合済・実画面未照合** | 島の端から短い観察先へ出かけ、同じ現物をhomeに持ち帰る。採用候補 [U5/U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W04/W07へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W04/W07 | 出発/中断/帰還で同じ物と学習予約を保持。全件V0/V1/V2を併用 |
| AC15 写真を構成する | 成果を自分の記念にできる | [IslandPhotos.tsx](../../../src/components/island/IslandPhotos.tsx)、[useIslandPhotos.ts](../../../src/components/island/useIslandPhotos.ts)、[photosRepository.ts](../../../src/domain/island/photosRepository.ts): 実canvas写真12枚、近景/全景/入江、拡大/PNG/削除/旧画素を固定photos-02で両viewport確認。 **実装/範囲内証拠あり・全体未合格** | 展示構図、仕事中の撮影、native保存故障の全matrixは残る。photos-persistence-01の通知欠落後の旧revision不具合は修正し固定05で再検証中。 | 採用・実装/検証中：元の価値を仕様37/38へ接続し、残る受入を保持 | P1 / W09 | 撮影/取消/保存/見返す、学習記録非露出。全件V0/V1/V2を併用 |
| AC16 島を見せ合う | 自分の場所を誰かに見てほしい | [Island.tsx](../../../src/pages/Island.tsx): 同端末で編集操作を減らしたreadOnly見学がある。**コード照合済・実画面未照合** | ネット訪問は不要候補。暮らしの再演/本人の作品を見せる流れと戻る境界を確認。採用候補 [U5/U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W09へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W09 | 見学で誤編集/交換なし、戻ると同じ状態。全件V0/V1/V2を併用 |
| AC17 題材のある創作 | 自由すぎても迷わず始められる | [IslandWorkshop.tsx](../../../src/components/island/IslandWorkshop.tsx)・[workshopLayout.ts](../../../src/domain/island/workshopLayout.ts)に自由な4部品盤面、一般ヒント、異なるA/B成功案、2保存作品を実装。題材を選ぶUI/状態はない。 | 自由工房を新規要求へ戻さない。住民の用途へ結ぶ任意題材1つ等は未実装・追加採用未確定。採用する場合も複数解/自由制作/取消を保ち、通貨や学習加算を増やさない。 | 既実装＋題材選択は未実装・未採用候補 | P1 / W06/W03 | 題材なし/ありの両方、複数完成形で住民利用。全件V0/V1/V2を併用 |
| AC18 作った場所への来訪 | 自分の制作に世界が応える | [workshopPresentation.ts](../../../src/components/island/three/workshopPresentation.ts)は本人の作品の水源操作と住民別注視、[sharedJobController.ts](../../../src/components/island/three/sharedJobController.ts)は保存作品snapshotへの3仕事/返しを実装。 | 作る→住民が扱う接続は存在する。workshop-residents-02はphone取消時のselectResident待機でFAIL、tablet後続は未完。修正後の接触/結果画角と3仕事を実画面で確認する。自由な建築物全般への自発来訪まで採用済みとはしない。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W03/W06 | 自分の2配置で住民が接触・利用、全身が読める。全件V0/V1/V2を併用 |
| AC19 別の場所で自由制作 | 大切な場所を崩さず試せる | [workshop.ts](../../../src/domain/island/workshop.ts)に主島と分かれたdraftCheckpoint、4部品/2作品/取消、[sharedMemories.ts](../../../src/domain/island/sharedMemories.ts)に作品の独立snapshotを実装。A/B編集・展示A再訪の限定PASSあり。 | 別draft無しという旧判定は解消。主島家具の複数編集を別庭でまとめて確定する拡張は未採用候補であり、4部品の工房と混同しない。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W06 | 試作DB境界、複数案/取消/反映/復元。全件V0/V1/V2を併用 |
| AC20 片付けて再編集 | 作り直しの負担が下がる | [workshop.ts](../../../src/domain/island/workshop.ts)は20操作undo/redo・盤全体clear・取消を保存。workshop-diagnostic-04/gestures02/persistence04に実操作・再送・reloadの限定証拠。主島は単品収納/保存案復元を維持。 | 工房のundo/clearを再実装しない。主島での任意範囲選択/複数家具undoは別の未採用候補。既存所有/成長を巻き戻さない。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W06 | 片付け→undo→reload、所有/到達段階不変。全件V0/V1/V2を併用 |

### PK — ポケットモンスター

| ID・機能 | 狙う気持ち | 現行仕様の根拠・実装状態 | 不足・具体的な翻案 | 仮分類・理由 | 優先 / 作業単位 | 検証する場面 |
|---|---|---|---|---|---|---|
| PK01 出会いが仲間になる | 自分の発見が一緒に過ごす存在になる | [visitors.ts](../../../src/domain/island/visitors.ts)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 3来訪は図鑑登録し環境が残れば再会できる。**コード照合済・実画面未照合** | 一緒に過ごす個体/同行/持帰りの仲間化は未実装。安全な再会利用を拡張。採用候補 [U3/U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W05/W07へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P1 / W03/W05/W07 | 初会/登録/再訪、能力差と進行ロックなし。全件V0/V1/V2を併用 |
| PK02 埋まる図鑑と探索情報 | 収集の達成と次の探索がつながる | [IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx)、[IslandAlbum.tsx](../../../src/components/island/IslandAlbum.tsx): 15件の未発見案内・保存順一覧・現地再演がある。**コード照合済・実画面未照合** | 好きな発見を展示/命名し、全件記録後も観察条件を変えて遊べるようにする。採用候補 [U5/U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W05へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W05 | 所持/未発見/環境/再演の1本の導線。全件V0/V1/V2を併用 |
| PK03 連続的な育成 | 日々の活動が蓄積していると分かる | [commit.ts](../../../src/domain/island/commit.ts)、[growth.ts](../../../src/domain/island/growth.ts): 島の蓄積と支援/独力・再確認の学習記録を分離している。**コード照合済・実画面未照合** | 成長値を上達証拠にしない契約は保持候補。通常planner/後日確認の回帰を残す。採用候補 [U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W10へ統合） | 既実装で十分（候補）：読んだコードは契約に対応。実画面/回帰後に採否判断 | P1 / W02/W10 | 支援同成長、学習DBの独力/復習を照合後に十分判定。全件V0/V1/V2を併用 |
| PK04 技と進化 | 量の増加が質の変化になる | [growthVisuals.ts](../../../src/components/island/three/growthVisuals.ts)、[islandGrowthPreview.ts](../../../src/components/island/islandGrowthPreview.ts): 成長の輪郭と次段階preview、既定利用の解放がある。**コード照合済・実画面未照合** | 姿の変化から本人の道具/制作の新しい動詞へ接続。採用候補 [U1/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W02/W04へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W02/W04 | 輪郭差と新用途、前の姿でも到達能力保持。全件V0/V1/V2を併用 |
| PK05 相性と特性 | 知識や工夫が役に立つ | [residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts)、[livingSettings.ts](../../../src/domain/island/livingSettings.ts): 住民の好み優先と物の組合せはあるが得意仕事はない。**コード照合済・実画面未照合** | 誰と/何を/どこで試すかで結果が分かる役割と性質を追加。採用候補 [U3/U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W03/W04 | 同対象×異住民、同住民×異環境を比較。全件V0/V1/V2を併用 |
| PK06 複数の物語と順序 | 次の目的を自分で決められる | [Island.tsx](../../../src/pages/Island.tsx)、[IslandDiscoveryGuide.tsx](../../../src/components/island/IslandDiscoveryGuide.tsx): 育成/図鑑/配置/外見を任意順に選べる。**コード照合済・実画面未照合** | 観察・制作・整備・手伝いも一本道にせず本人の順で進める。採用候補 [U1/U2/U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W04/W06へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03/W04/W06 | 異なる順序で同じ成果へ、必須選択なし。全件V0/V1/V2を併用 |
| PK07 連れ歩きと役割 | 仲間が同じ世界で活動する | [residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts)、[types.ts](../../../src/domain/island/types.ts): 家具へ住民を選ぶ経路はあるが同行/調査命令はない。**コード照合済・実画面未照合** | 好きな住民を明示選択して調査/運搬を頼み、見つけた物を持って戻る。採用候補 [U3/U1](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W04へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W03/W04 | 頼む→調べる→持って戻る、中断可能。全件V0/V1/V2を併用 |
| PK08 任せて眺める | 見守ることも自分で動くことも楽しい | [Island.tsx](../../../src/pages/Island.tsx)、[runtime.ts](../../../src/components/island/three/runtime.ts): 自発行動/住民演技を中断して学習へ戻せる。**コード照合済・実画面未照合** | 既存の並行性は保持候補。道具・工房・依頼の全途中状態から即復帰を確認。採用候補 [U7](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W10へ統合） | 既実装で十分（候補）：読んだコードは契約に対応。実画面/回帰後に採否判断 | P1 / W03/W10 | 全行動の途中で同じ問題に即復帰してから十分判定。全件V0/V1/V2を併用 |
| PK09 冒険中の居場所 | どこへ行っても自分たちの場所がある | [runtime.ts](../../../src/components/island/three/runtime.ts)、[IslandItems.tsx](../../../src/components/island/IslandItems.tsx): 固定家具の共有利用と自由配置はある。**コード照合済・実画面未照合** | おやつ/ピクニック作品を本人の配置で作り好きな2住民が集まる用途へ。採用候補 [U3/U2](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03/W06へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P2 / W03/W06 | 2住民の集まる/座る/分ける、配置変更後再演。全件V0/V1/V2を併用 |
| PK10 自由な触れ合い | 用事がなくても見ていたい | [runtime.ts](../../../src/components/island/three/runtime.ts)、[residentInteraction.ts](../../../src/components/island/three/residentInteraction.ts): 自発仕草・家具利用・固定好みがある。**コード照合済・実画面未照合** | 仕事/以前の共同体験を覚える返しと好み別の過ごし方を追加。採用候補 [U3](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W03へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W03 | 通常待機と再訪の違い、同時の大動作1つ。全件V0/V1/V2を併用 |
| PK11 洗う・世話する | 手入れで目に見えてよくなる | [workshopScene.ts](../../../src/components/island/three/workshopScene.ts)、[workshop.ts](../../../src/domain/island/workshop.ts): 同じ標本の6区画をなぞり、接触した砂が落ちる任意操作。固定gestures02で連続なぞり/取消/同予約復帰を確認。 **実装/範囲内証拠あり・全体未合格** | 主島3展示と同個体の再観察はshared-memories-06の限定PASS。残るのは3仕事と組み合わせた実経路・無説明理解。住民の空腹/放置罰や能力差へ移さない。 | 採用・既実装/限定証拠あり・実経路検証残 | P1 / W01/W04 | touch/keyboard代替、途中/再開/世話罰なし。全件V0/V1/V2を併用 |
| PK12 ちょっと失敗する制作 | 予想外の形が笑いと再挑戦になる | [workshopLayout.ts](../../../src/domain/island/workshopLayout.ts)・[workshopScene.ts](../../../src/components/island/three/workshopScene.ts)に向き/接続型で流れが止まる実演と即undo、A/B複数解を実装。workshop-diagnostic-04の限定PASSあり。 | 不成立を試し直せる制作は存在する。積み上げ/物理的な崩れ/意外な別用途は別の未採用候補として残し、没収なしの価値を維持する。 | 採用・既実装/限定証拠あり・実経路検証残 | P2 / W06/W01 | 崩れた後の即再開と部品数不変。全件V0/V1/V2を併用 |
| PK13 特別な状態の姿 | 特別な瞬間が一目で分かる | [growthVisuals.ts](../../../src/components/island/three/growthVisuals.ts)、[runtime.ts](../../../src/components/island/three/runtime.ts): 成長形状と共有/発見の反応はある。**コード照合済・実画面未照合** | 正体判明や共同制作完成だけの固有の形/短い光を日常反応と分ける。採用候補 [U1/U4](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W01/W05へ統合） | 既実装を改善（候補）：仕様の土台を拡張 | P1 / W01/W05 | 日常/初発見/再演、音off/reduced、入力遅延なし。全件V0/V1/V2を併用 |
| PK14 珍しい外見との遭遇 | いつもの種類にも特別な出会いがある | [visitors.ts](../../../src/domain/island/visitors.ts)、[experience.ts](../../../src/domain/island/experience.ts): 3来訪に固有外形があるが同種の色/模様個体・保存着替え化はない。**コード照合済・実画面未照合** | 能力差のない珍しい模様を観察し、既知なら再会/好きな姿へ使う。採用候補 [U5/U6](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W07/W08へ統合） | 新規実装（候補）：現行仕様に具体契約なし/一部のみ | P1 / W07/W08 | 抽選/記録/再利用、速度/支援による差なし。全件V0/V1/V2を併用 |
| PK15 一緒に探索 | 発見の瞬間を共有できる | [Island.tsx](../../../src/pages/Island.tsx)、[islandPhoto.ts](../../../src/components/island/islandPhoto.ts): 同端末見学と実frame写真の保存がある。**コード照合済・実画面未照合** | オンライン同期は不要候補。自分の観察/制作の瞬間を家族へ見せる再演と構図へ。採用候補 [U5](2026-09-08-island-experience-remaining-audit.md#additional-candidates)（W09へ統合） | 既実装を改善（候補）：コードに一部到達。残る体験と実画面の判断待ち | P2 / W09 | 見学/再演/撮影と学習/他profileの境界。全件V0/V1/V2を併用 |

## Cross-index — 分析の全観点を残す

C01〜C22の根拠は[読んだsourceの境界](2026-09-08-island-experience-remaining-audit.md#source-boundaries)、U1〜U7は[追加採用候補](2026-09-08-island-experience-remaining-audit.md#additional-candidates)を参照。

以下の索引の行数は104件とは別。複数項目を同じ体験が満たすため、件数を足して実装量や達成率にしない。各索引の存在は網羅した記録であり、完成した証拠ではない。各索引の末尾へ現コードの到達範囲と残る候補を記す。すべて**実画面・採否判断待ち**であり、メニューや状態の存在だけで欲求を満たしたとはしない。

### A01–A18: 18の観点

| ID | 元の観点 | 比較する要素 | 元の項目 | 対応する体験 |
|---|---|---|---|---|
| A01 | 1. 操作の気持ちよさ | 押す、置く、崩す、積む、洗う、拾う、一手の結果 | MC01・18、PK11–12、SC12 | W01/W06。現状/残り: 単品配置あり。洗う/拾う/積むと材質の手応えはU1/U2/U4 |
| A02 | 2. 達成と緩急 | 小反応、蓄積の予兆、完成、大発見、休む余白 | YO09、FO01・10、PK13 | W01/W02/W05。現状/残り: 成長の段階あり。観察→正体判明の固有の山場はU1/U4 |
| A03 | 3. 見た目のデザイン | 輪郭、素材差、場所ごとの色、縮尺、変化前後 | MC07、SC03、PK04・13 | W01/W02/W08。現状/残り: 実geometryとテーマあり。全景/部分/成長の見分けは実画面判定U4/U6 |
| A04 | 4. 音と動き | 材質音、環境音、BGM選択、予備動作、反応の連鎖 | MC14–15・18、PA12、FO09 | W01/W03/W08。現状/残り: 3音景あり。材質SE・本人がつなぐ音/光の連鎖はU4/U2 |
| A05 | 5. 分かりやすさ | 完成予告、不足数、配置範囲、原因表示、段階ヒント | MC03、SC04–05、YO06・10 | W02/W04/W05/W06。現状/残り: 次姿previewと15ヒントあり。レシピ/届く範囲/因果overlayはU2/U4 |
| A06 | 6. 世界の成長 | 植物、同じ建物、土地、施設、人の往来 | FO01・04、SC03・06・09、AC08 | W02/W03。現状/残り: 4居場所/7物/橋と既定利用あり。制作で暮らしが変わる用途はU2/U3 |
| A07 | 7. 能力・上達の成長 | 新しい技、移動方法、道具、相性理解、工夫 | PA03–04、MC04・10・13、PK03–05 | W03/W04/W06。現状/残り: 既定利用解放あり。本人の道具と知った性質の応用はU1/U2 |
| A08 | 8. 探索・好奇心 | 遠景、手掛かり、宝の地図、寄り道、離島 | MC07–09、AC14、YO11 | W04/W05/W07。現状/残り: 地区focusと一覧ヒントあり。現地を追う/観察先へ行く/持帰るはU1/U5 |
| A09 | 9. 観察・実験 | 触る、運ぶ、条件を変える、組み合わせる、知識の再利用 | YO01–06、MC14–17 | W04/W06。現状/残り: 2つの環境反応あり。運ぶ/洗う/照らす/対照実験はU1、連鎖はU2 |
| A10 | 10. 収集・図鑑 | 初発見、種類、棚、展示、生態情報、未発見の余白 | YO07・10、AC04–06、PK02・14 | W05/W09。現状/残り: 15案内/保存順一覧/再演あり。未知現物の正体と展示はU1/U5 |
| A11 | 11. 創作・自己表現 | 自由配置、服、色、名前、テーマ、複数解 | PA10、YO08、MC05・17、AC09・17 | W06/W08/W09。現状/残り: 名前/服/配置保存あり。編集可能draft/部品制作/複数解はU2、個別配色U6 |
| A12 | 12. 愛着・世話 | 仲間の得意、好み、会話、おやつ、手入れ、同行 | PA06–07・11、AC11、PK07・09–11 | W03。現状/残り: 固定好みあり。得意仕事/手伝い/共同体験記憶/おやつ/同行はU3 |
| A13 | 13. 仕組み・経済・計画 | 採集→制作→利用、資源の循環、範囲、接続、専門化 | MC02–03・11、SC01–10 | W03/W04/W06。現状/残り: 確定成長/交換あり。採集→制作→利用/接続/専門用途はU1/U2/U3 |
| A14 | 14. 運・意外性 | 珍しい遭遇、場所の変化、準備で変わる傾向、未知の正体 | MC08・12、PA13、AC06・13、PK14 | W07。現状/残り: 3来訪あり。未知現物の正体はU1、漂着/珍しい同種模様はU5/U6 |
| A15 | 15. 目標・選択・挑戦 | 小さなお願い、長期目標、順番選択、遊び方選択、複数経路 | PA08–09、MC06・11、FO07、PK06 | W02/W03/W06/W08。現状/残り: 成長/外見/発見の目標あり。お願い/作品題材/複数到達経路はU2/U3 |
| A16 | 16. 習慣・時間・季節 | 短い入口、続けやすさ、再訪時の変化、休息、時間の記録 | FO02–10、AC02–03 | W07/W08/W10。現状/残り: 短い入口/音/来訪あり。季節/朝夕と自由な再選択はU5/U6 |
| A17 | 17. 思い出・共有・協力 | 発見順、アルバム、記念写真、訪問、役割協働、家族に見せる | YO07、AC15–16・18、FO11、PK15 | W09。現状/残り: 成長比較/PNG/見学あり。構図/展示/共同作業/動く見学はU3/U5 |
| A18 | 18. 試しやすさ・続ける安心 | 置き直し、収納、別の試作場所、オフライン、任意の助け | SC14、AC19–20、MC05、FO12、YO10 | W06/W10。別draft/20undo/redo/clear・取消は仕様37へ実装済み。主島家具の範囲編集は未採用、実offline/中断の版別証拠と未完経路はU7へ残す。 |

### H01–H12: 気持ちよさ12分類

| ID | 気持ちよさ | 起こしたいこと | 元の項目 | 対応する体験 |
|---|---|---|---|---|
| H01 | 触った手応え | 押した場所が短く動き、何に触れたか分かる | MC01・18 | W01。現状/残り: tap/配置あり。材質局所反応U4 |
| H02 | ぴったり収まる | 置いた物が意図した位置・向きへ収まる | SC14、AC20 | W01/W06。現状/残り: 配置判定あり。接続/部品fit/undoU2/U4 |
| H03 | 満ちていく | 空いていた景色や棚が、意味のある物で埋まる | FO04、PK02 | W02/W05。現状/残り: 成長/発見一覧あり。現物の棚/作品が増えるU2/U5 |
| H04 | きれいになる | 洗う・潤す・整える操作で、変化がその場に残る | PK11、PA03 | W01/W04。仕様37の6区画洗浄と同じ表面の露出は既実装、gestures02で限定確認。日常/判明の手応えと無説明理解はU1/U4の検証残。 |
| H05 | つながる | 道・橋・水・灯りがつながり、実際に人や物が動く | SC09、MC14 | W02/W04/W06。旧床/橋は固定37で保持し、仕様37の本人がつなぐ水/軸連鎖も既実装。住民の接触から結果までの実画面と理解をU2へ残す。 |
| H06 | できることが増える | 昨日までできなかったことを、自分でできる | PA04、PK04 | W02/W03/W04。現状/残り: 既定利用あり。新しい道具の動詞U1/U2 |
| H07 | 分かった | 予想して試した結果が、短い事実として理解できる | YO04–06 | W04/W05。現状/残り: 条件反応あり。予想→道具→性質の対照U1 |
| H08 | 意外だった | 見慣れた対象が、予想していなかった反応を返す | YO05、AC13 | W04/W07。現状/残り: 3来訪/反射あり。別条件の実験/漂着U1/U5 |
| H09 | 手に入れた | 新しい存在が図鑑・展示・暮らしの中に残る | PK01–02、AC05 | W05/W07/W08。現状/残り: 記録/交換あり。現物取得→展示/利用U1/U5/U6 |
| H10 | 自分で決めた | 名前や配置、行く場所に本人の選択が残る | YO08、AC09、PK06 | W06/W08/W09。改名/配置/4部品の自由試作/A・B/3景色保存は既実装。題材選択と別解の無説明理解はU2の残差。 |
| H11 | 役に立った | 作った物を住民が使い、仲間の仕事も見える | PA07、SC08 | W03/W06。本人の作品への水源操作と3仕事/返しは既実装。workshop住民の修正後画角、仕事から記憶再訪までの実経路をU2/U3として確認する。 |
| H12 | 眺めていたい | 急かされず、生活や小さな動きを見届けられる | PK10、FO09–10 | W03/W07/W08。現状/残り: home自発/音あり。見学で動く暮らしU3/U5 |

### D01–D10: デザイン10観点

| ID | 観点 | 確認する問い | 実装と実画面で試す方向 | 対応する体験 |
|---|---|---|---|---|
| D01 | 1. 輪郭 | 小さく見ても対象や成長段階を見分けられるか | 花・樹冠・家のシルエットそのものを変える | W02/W08。現状/残り: growthVisualsの輪郭差あり。390pxで現地確認U4/U6 |
| D02 | 2. 材質 | 木、石、水、生き物の触れ心地を想像できるか | 全部を同じ光沢・同じ質感へ揃えず、反応と音も変える | W01/W08。現状/残り: 材質描画あり。触る材質反応/短音U4 |
| D03 | 3. 色の焦点 | 今見てほしい物と、背景の役割が分かれるか | 場所ごとの主色と、小さな焦点色を決める | W01/W08。現状/残り: テーマ焦点あり。新しい対象/道具/作品まで全景確認U4/U6 |
| D04 | 4. 縮尺と画角 | 育つ前後の差や、住民の行為が読めるか | 成長比較は同じ倍率。全景と暮らしを見る画角を使い分ける | W02/W03/W09。現状/残り: 昔今同rendererあり。住民全身と新作品の画角U3/U5 |
| D05 | 5. 身体の演技 | 説明文なしで、誰が何をしてどう返されたか分かるか | 視線、体の向き、触れる位置、相手の返しを揃える | W03/W04。現状/残り: 既定歩行/共有あり。洗う/渡す/仕事の一連の演技U1/U3/U4 |
| D06 | 6. 置いた後の生活 | 完成品がただの飾りで終わっていないか | 座る、渡る、分け合う、休む行動までを一つの機能とする | W03/W06。現状/残り: 既定家具利用あり。自作作品の利用点/経路U2/U3 |
| D07 | 7. 音の役割 | 入力、結果、材質、環境、節目が聞き分けられるか | 短い操作音と環境音を分け、声や問題の理解を妨げない | W01/W08/W10。現状/残り: 入力音/3音景あり。材質/完成/声の優先U4/U7 |
| D08 | 8. 動きの緩急 | 日常と大発見が同じ強さになっていないか | 平常は少数の動き、節目は短く大きい変化 | W01/W03/W07。現状/残り: 自発/成長あり。新しい発見/完成の緩急U1/U4 |
| D09 | 9. 情報の順序 | 景色の変化より通知や達成率が先に目に入らないか | 世界で起きたことを先に、詳細記録は任意の図鑑へ | W02/W05/W10。現状/残り: 実表示から記録。新しい棚/制作で景色を先に見せるU1/U2/U5 |
| D10 | 10. 操作の確かさ | 選択・配置・取消・次の操作が分かるか | 置く前の影、届く範囲、戻す操作、音に依存しない状態表示 | W01/W06/W10。現状/残り: 単品preview/取消あり。届く範囲/接続/undoU2/U4 |

### G01–G08: 成長8軸

| ID | 成長の軸 | 具体例 | 対応する体験 / 証拠 |
|---|---|---|---|
| G01 | 量が増える | 木、発見、図鑑の棚が増える | W02/W05。有限の成長と発見棚の増加。現状/残り: 有限の成長/15発見あり。現物/作品の棚U1/U2/U5 |
| G02 | 姿が変わる | つぼみ→花、小屋→屋根窓のある家 | W02/W08。実geometryと次姿preview、固定36/37の診断成長0/1/2で既定home同倍率を確認。直前fixtureからの実回答による解放は限定確認済み。新しい学習ヘッダーは固定39・7実経路で限定PASS。 |
| G03 | 用途が増える | 座れる、渡れる、運べる、照らせる | W03/W04/W06。仕様37の道具/連鎖、38の3仕事、40の3家具用途は既実装。取得後に本人の作品が役立つ一連の実経路と用途の理解が検証残。 |
| G04 | 空間が広がる | 橋、新しい水辺、別の探索先 | W02/W04。固定36/37の診断0/1/2と東接続点の実配置、追加の直前fixture→実3正答による東/西解放を限定確認。旧床/橋/home画角を保持。初回からの全育成と別観察先の未採用候補は別に残す。新ヘッダーは固定39・7実経路で限定PASS。 |
| G05 | 理解が深まる | 初めて知る→別条件でも性質を使える | W04/W05。仕様37の同じ3標本×道具、A/Bの水/軸連鎖は既実装・限定PASS。別条件へ性質を使う理解と、住民と試す因果の実画面は未完。 |
| G06 | 関係が育つ | 好みが分かる、頼ってもらう、一緒に過ごす | W03。3仕事・同住民/同対象の永続記憶・お返しは仕様38へ実装済み。仕事完了→reload→同物へ再訪する実経路と、関係を感じるかのHuman N=0は別の未確認。 |
| G07 | 表現が豊かになる | 選べる配置、音、名前、テーマが増える | W06/W08/W09。4部品の自由制作、12slot mix、衣装/模様/音とsceneStyle v2は既実装。完成景色で暮らし、保存/復元後にまた試す一連の使い方を確認する。 |
| G08 | 本人が上達する | 独力で解ける、日を空けてもできる、別表現へ使える | W10。独力回答・後日の再確認を別に検証。島の成長・滞在・収集で代替しない。現状/残り: 独力/支援記録の分離あり。通常planner/後日確認は別回帰U7 |

### N01–N08: 欲しくなる8つの入口

| ID | 欲求の仮説 | 起きてほしい言葉・行動 | 元の候補 | 対応する体験 |
|---|---|---|---|---|
| N01 | 所有したい | 「この島、ほしい」 | 島全体の完成風景を大きく試せるプレビュー | W08/W09。現状/残り: 本人の実島previewあり。全16報酬の欲しさは実画面未確認U6 |
| N02 | 自分らしくしたい | 「ぼくの島はこれ」 | 好みのテーマ、名前、色、配置、着替えの保存 | W06/W08/W09。現状/残り: 島名/服/配置あり。自由制作/個別色の余地U2/U6 |
| N03 | 揃えたい | 「この橋も同じシリーズにしたい」 | 小さなテーマセット、所持が分かる図鑑、個別の確定交換 | W05/W08。18単品/3完成セット・所持差額は仕様39へ実装済み。3セットpreviewの限定PASSと、全購入順・完成後の暮らしの未確認を分ける。 |
| N04 | 完成させたい | 「あとこれでできあがる」 | 途中の姿も魅力があり、完成までの距離が読める制作 | W02/W06。部品をはめる/つなぐ/AとB/undoは既実装。任意題材は未採用候補、完成までの見通しと自分で試す理解は未確認。 |
| N05 | 育てたい・世話したい | 「この子にこれをあげたい」 | 同じ仲間の表情、好きな場所、新しい過ごし方 | W03。現状/残り: 固定好みあり。本人が世話/手伝い/おやつを選ぶU3 |
| N06 | 試して動かしたい | 「ここに置いたらどうなる？」 | 置いた家具を住民が使う、つながると仕掛けが動く | W04/W06。道具×3標本の条件差、水/軸連鎖、3家具の利用は既実装・限定証拠あり。自作を仲間と試す修正後経路と3仕事は実検証残。 |
| N07 | 驚きたい・発見したい | 「えっ、こんなことするの？」 | 新しい仕草、環境との反応、能力差のない珍しい外見 | W04/W05/W07。現状/残り: 3来訪あり。現物の正体/意外な性質/模様U1/U5/U6 |
| N08 | 見せたい・覚えておきたい | 「見て、これ作った」 | 自分の島の全景、記念写真、昔と今、見学表示 | W09。3展示/A snapshot再訪/実写真棚・家の賞状/トロフィーは既実装。家23と展示/写真の限定PASSあり。完成景色から暮らし/撮影/復帰までと、見せたい気持ちは別検証。 |

### R01–R16: 報酬16カテゴリの採用候補と取得後の用途

外見の選択、行動の追加、道具の解放を別責務として設計する。「検討した」という印だけで終えず、各行の具体案を仕様/現在コードと照合して採用内容を定める。全件W08を参照し、行動付きはW03/W04/W06の受入も必要。現状欄はコード照合済。個別カテゴリを選べないテーマ内の表現、無料の設定、取得する報酬を区別する。**全件の実画面・採否判断待ち**。

| ID | 報酬カテゴリ | 現行仕様の範囲 | 不足・具体案と取得後に使う理由 | 仮分類 / 優先 | 検証 |
|---|---|---|---|---|---|
| R01 | 1. 島全体のテーマ | 39の3有料テーマ/3完成セット・12slotのmixと、[sceneStyle v2](../../../src/domain/island/sceneStyle.ts)による無料設定＋41の全expression選択を既存3案へ保存する実装あり | 1シリーズの単品→差額セット→住民利用→写真/景色保存→別案から復元を最小の次検証候補にする。全購入順・後続成長と全報酬の組合せ・完成後の選好は未確認。 | 採用・既実装/限定PASS・全体HOLD/P1 | appearance-04の3系統/mix、固定16 身支度04（`../../../output/island-experience/expression-04/report.json`）のv2保存/同予約/reload。全R行で人N=0、魅力・無説明理解・意欲の合格は未判定 |
| R02 | 2. 空と遠景 | [appearance.ts](../../../src/domain/island/appearance.ts)のsky単品3品と実group/materialを実装。41の朝/昼/夕・4季節は別の無料設定として[環境renderer](../../../src/components/island/three/expressionEnvironment.ts)へ接続済み | 空/遠景の独立選択を維持。全テーマ/成長との組合せ、毎回見たい魅力、実背景復帰は未検証 | 採用・既実装/限定PASS・全体HOLD/P2 | appearance-04のsky差分。固定16身支度04は12環境組合せと無料設定の復元を確認し、全学習速度の証拠にはしない |
| R03 | 3. 地面・岸・道 | 39のground部位権とground/shore/pathの別装備を[appearance.ts](../../../src/domain/island/appearance.ts)・[部位renderer](../../../src/components/island/three/cosmeticScenery.ts)へ実装。candy地面の大きな溝/焼き色は現sourceへ反映済み | 一括テーマしか選べない状態ではない。全成長・実配置との接地、道と建物のまとまりの魅力は未検証。入江の水/軸接続は37の別用途 | 採用・既実装/表示改善済・全体HOLD/P1 | appearance-04/06の選定差分と地面/壁の限定比較（`../../../output/island-experience/appearance-surfaces-03/signature-resolution.json`）。浮動小数点の署名差を購入変形と混同せず、実見た目は別判定 |
| R04 | 4. 水の見た目 | 39のwater単品3品による海/噴水の水の装備は実装済み。36の無料音景と41の[三音engine](../../../src/components/island/islandAmbienceAudio.ts)は別の選択として存在 | 水面・反射の因果可読性HOLDを保持。三音の実bell観察→明示取得は固定17資格03で確認。デジタル音出力と停止は同app20のQA05/06で限定確認。未収録onset・実聴・水面反射の可読性は別の残差 | 採用・既実装/一部改善・未検証/P2 | appearance-04のwater実表面差。固定16身支度04の音は表示previewのみ。反射/実験と実聴を別に確認 |
| R05 | 5. 家・屋根・窓 | 39の家の利用権とbody/roof/windows適用を分離済み。[専用近景](../../../src/components/island/three/appearanceFraming.ts)も実装し、現在/試用で固定倍率。candy壁の苺色は現sourceへ反映済み | 「近景未実装」ではなく、選定経路を確認済み。全成長・旧snapshot・出入口と、単品差の欲しさは全体未判定 | 採用・既実装/限定PASS・全体HOLD/P1 | appearance-06（`../../../output/island-experience/appearance-06/report.json`）の近景/屋根25ほし購入、地面/壁比較（`../../../output/island-experience/appearance-surfaces-03/signature-resolution.json`）。旧外見と他slot保持を継続確認 |
| R06 | 6. 木・花・きのこ | 39のplants権利とtree/flower/mushroomの別装備、[実配置を使う近景](../../../src/components/island/three/appearanceFraming.ts)を実装。移動/収納時の対象と成長輪郭を維持する設計 | 独立取得/近景は存在する。全成長・複数配置・住民利用の見え方、輪郭の差が欲しさになるかは未検証 | 採用・既実装/限定PASS・全体HOLD/P1 | appearance-04/06の3系列/近景の選定経路。全姿勢/接点と人の評価は別受入 |
| R07 | 7. 橋・門・柵 | 39のbridge単品3品を東西橋/桟橋へ実装し、床/通行位置を保持。自由配置する門/柵は未実装・未採用の残差 | 橋slotだけで門/柵まで消化しない。往来の見せ場と、門/柵を追加する意味を残す | 採用・橋は既実装/門柵は残差/P1 | appearance-04の橋差分。全通過/合法経路/成長の受入と独立門柵の採否を別確認 |
| R08 | 8. 家具・遊具 | 40の[家具取得](../../../src/domain/island/furniture.ts)・[専用UI](../../../src/components/island/IslandFurniture.tsx)・[実利用controller](../../../src/components/island/three/optionalFurnitureController.ts)は実装済み。望遠鏡/ハンモック/茶卓各1個、基本7物と旧重複を保持 | 固定17の同住民利用/本人復旧に加え、固定24で両幅の選定9利用を有限合成PASS。全衣装×模様×家具の全直積ではない。固定37は東ランタン1点の配置のみで、全家具利用へ転用しない。永続目標は固定20の限定実UIで確認済み。 | 採用・既実装/限定経路PASS/P1 | 固定17家具06の実取得/同予約と、[固定24の50portrait＋18利用](../../design/audits/2026-09-09-island-expression-matrix/README.md)は別証拠。元no-space/FAILと本人修復を保持し、全仕様40は未完。 |
| R09 | 9. 仲間の衣装 | 41の合羽/ベレーを[expression.ts](../../../src/domain/island/expression.ts)・[身支度UI](../../../src/components/island/IslandExpression.tsx)・[同じ実rig](../../../src/components/island/three/expressionResidentVisuals.ts)へ実装。3住民共通所有と無料original/scarf/capを保持 | 固定24の両幅残25portrait/選定9利用は診断fixtureで有限確認済み。 無料capへの復元・改名保持を未実装へ戻さない。全衣装×模様×家具接点、顔/耳/手足の自然さと人の評価は未完了 | 採用・既実装/限定PASS・全体HOLD/P1 | 固定16身支度04: 2衣装×3住民preview、6有料品取得と明示装備、3住民の無料cap→追加衣装→改名→同じcap復元を確認 |
| R10 | 10. 仲間の色・模様 | 41の購入チェック/蝶観察の縫い模様を[専用所有](../../../src/domain/island/expression.ts)と[実rig布片](../../../src/components/island/three/expressionResidentVisuals.ts)へ実装。資格/取得/装備は別操作 | 固定24で有限25portrait/幅を確認済み、全直積ではない。 チェックの購入は確認済み。蝶の実観察→取得/装備は固定17資格03で限定PASS。固定19資格07（`../../../output/island-experience/qualified-07/report.json`）の両幅では、選定近景の蝶の両羽・花・住民の分離を作者が改善確認。全衣装/全組合せ/全critical pathと子どもの理解（N=0）は未検証。全面の体色変更/同種内の新個体は未実装残差 | 採用・既実装/限定PASS・残差あり/P1 | 固定16身支度04のチェック取得/復元・未所持模様preview。4資格品は同run対象外。追加の資格03（`../../../output/island-experience/qualified-03/report.json`）で実観察/明示取得を確認したが、全X02〜X06の合格にはしない |
| R11 | 11. 仕草・交流 | 38の3仕事と40の[選択住民による実演](../../../src/components/island/three/optionalFurnitureController.ts)を実装。同一カップ受渡し、接眼、布への支持を扱い、基本交流を通貨で失わせない | 固定24の選定18家具利用は確認済み。shared-memories-06/shared-camera-03の3仕事は明示not-run。 固定19の鳥/蝶の選定近景は作者による改善確認に到達したが、全3仕事/全住民ペア・配置での因果可読性は未合格。仕草単体の取得や同種内の新個体を、家具3品の実装や来訪近景の改善で充足扱いにしない | 採用・既実装/改善・検証中/P1 | 固定17家具06（`../../../output/island-experience/furniture-06/report.json`）の両幅で同じ住民の選定利用・本人による配置復旧がPASS。全仕事/全衣装の証拠へ広げず、物の出所→手→相手→返しと停止/学習復帰を実画像で継続確認 |
| R12 | 12. 足跡・移動の表現 | 41の葉/水輪を[有限pool](../../../src/components/island/three/expressionFootTrails.ts)と[同じ住民の試歩/離席](../../../src/components/island/three/expressionResidentWalk.ts)へ実装。接地前に足跡を出さず、取消で元の身体へ戻す | 選択/保存/歩行の実装と限定確認あり。実background/offline・全着座/家具からの離席・全反復条件は別検証 | 採用・既実装/限定PASS・全体HOLD/P2 | 固定16身支度04: 両幅で2足跡×3住民の6実歩行、有限markと取消/学習復帰を確認。全X12/X13や速度測定の合格ではない |
| R13 | 13. 音楽・環境音 | 41のbell観察資格/三音を[expression.ts](../../../src/domain/island/expression.ts)と[単一音engine](../../../src/components/island/islandAmbienceAudio.ts)へ実装。既存3無料音景/off、明示試聴・句/声数/停止の境界あり | 実演資格→取得は固定17資格03で限定PASS。同app20のQA05で三音2周/無料3音/解除復帰、QA06で実hidden/SPA退出/学習時停止と同予約回答を限定確認。未収録onset・実スピーカー・学習cueとの実聴の共存は未検証 | 採用・既実装/実出力・停止の限定PASS/P2 | [音QA05/06の範囲](../../design/audits/2026-09-09-island-audio/README.md)。65回帰PASS、各幅49 caller DB＋9 native pairで予約と全islands保持。05の全体FAILと06の境界限定PASSを単一runの全通過にせず、実聴や全X02〜X05/X12へ広げない |
| R14 | 14. 図鑑・アルバム装飾 | 38のprofile別実写真棚と41の[葉表紙/蝶印](../../../src/components/island/IslandAlbumDecoration.tsx)を実装。写真の外側を飾り、PNG/thumbnail/当時名を変更しない | 葉表紙の取得・実写真保持は確認済み。蝶の実観察→取得/装備は固定17資格03で限定PASS。旧景色/全履歴と図鑑専用の装飾は未検証または未実装残差 | 採用・既実装/限定PASS・残差あり/P2 | 固定16身支度04: 写真metadata/PNG/thumbnail/exportの同bytes、葉表紙のpreview/取得、v2保存を確認。蝶資格品と全X09/X10/X14は別受入 |
| R15 | 15. 名前・看板・旗 | 36の改名/4旗印と41の[葉鳥旗飾り](../../../src/components/island/three/personalScenery.ts)を実装。現sourceには[実旗の近景](../../../src/components/island/three/flagFraming.ts)・屋根を避ける取付位置・全景復帰を追加済み | 固定17身支度06で旗の近景/取消/全景復帰、資格03で実鳥観察→取得→装備を限定確認。鳥自体は固定19（workshop-20260909-7a2d01e5fb1c、leaf-bird-face-observation-v2）の実初観察frameと作者レビュー（`../../../output/island-experience/nature-19-review/review.json`）で、両幅の目・嘴・翼・胴の輪郭を改善確認。全視覚/全組合せと子どもの理解（N=0）は未検証。音07のlong-loop FAILと停止検証後半の未到達は保持し、選定近景の改善を全run合格へ転用しない。自由看板/印制作は未実装残差 | 採用・既実装/表示改善中/P1 | 固定16身支度04は未所持previewと改名保持の限定根拠。焦点23件（`../../../output/island-experience/flag-focus-camera-audit/final-focus.log`）は実8外見・同UUID/倍率・名前/旗印・取消を確認し、視覚合格へ転用しない |
| R16 | 16. テーマセット | 39の6部位＋飾りの3完成セット/単品分の差額を実装。40の家具配置と41の新衣装/模様/足跡/音/旗/外装/環境を[sceneStyle v2](../../../src/domain/island/sceneStyle.ts)で3案に残せる | 個別mix/保存は既実装。最小の次候補は1シリーズの途中→差額完成→家具/展示/写真→保存案復元。全セット実購入順・全報酬組合せ・全所持後の自発制作は未確認。 | 採用・既実装/限定PASS・全体HOLD/P1 | appearance-04の3完成previewと固定16身支度04のv2保存/同予約/reload。全セット/全報酬/全交換24項目の完了は未判定 |

### E01–E24: 交換前後の24比較項目

段階ごとの4項目を1行ずつ追跡する。仕様35の既存契約も確認を省略しない。家具/仕草/制作物へ広げる時は、交換直後の画像だけでなく実際の使い方までを検証する。**現コード照合済・実画面/採否判断待ち**。

| ID | 段階 / 比較項目 | 仕様上の現状・次の具体確認 | 対応する体験 / 優先 |
|---|---|---|---|
| E01 | 欲しいものを見つける / 商品の大きさ | **既実装・表示改善中**: 39の[部位近景](../../../src/components/island/three/appearanceFraming.ts)、40の実家具試用、41の同じ住民/足跡/旗/実写真外装を接続。固定17身支度06（`../../../output/island-experience/expression-06/report.json`）で実旗の近景/全景/取消、家具06で実道具の選定利用を確認。全商品/成長での見え方と、欲しさは人N=0で未判定 | W08/P1 |
| E02 | 欲しいものを見つける / 完成風景のプレビュー | **既実装・限定PASS**: 39は本人の成長/配置を使う単品・完成セット・mix、37は実部品の制作/実演、41はv2景色previewを持つ。固定16身支度04で選定v2を確認。全段階/全報酬込みの完成風景の魅力は未検証 | W02/W06/W08/P1 |
| E03 | 欲しいものを見つける / 未所持品の見せ方 | **採用・実装済み**: [家具UI](../../../src/components/island/IslandFurniture.tsx)と[身支度UI](../../../src/components/island/IslandExpression.tsx)は所持/価格/不足/用途、無料試用と資格未達を区別。固定16で10品previewと6有料取得を確認。4資格品の実観察→明示取得は固定17資格03（`../../../output/island-experience/qualified-03/report.json`）で両幅確認。無説明理解は人N=0 | W05/W08/P1 |
| E04 | 欲しいものを見つける / お気に入り・目標登録 | **追加採用・限定経路実UI PASS**: 35/39の[desiredItemId](../../../src/domain/island/customization.ts)を保持し、[仕様35](../../product/35_island_customization_spec.md)で40家具/41身支度を横断する任意目標1件を採用。[rewardGoal.ts](../../../src/domain/island/rewardGoal.ts)は未資格0ほし品の選択と必要条件、無料変更/解除を扱う。固定20の横断目標QA（`../../../output/island-experience/reward-goals-01/verification-context.json`）は両幅37実回答・52全DB比較で選択/解除/再表示/3カテゴリ取得時解除/試用保持/同予約復帰がPASS。最後の非区切り回答による全島field保持も保存済みnative記録から再監査（`../../../output/island-experience/reward-goals-01-strengthened-audit.json`）。制作/共同作業目標は引き続き候補 | W02/W08/P1 |
| E05 | 貯める / 獲得条件 | **採用・実装済み**: [pacing.ts](../../../src/domain/island/pacing.ts)は保存済みanswers-v1予約の問題数、旧予約は10ほし。支援/正確さ/連続正解で倍率を変えない。固定16は実回答による獲得と遊び/試用の全DB不変を選定確認。全旧予約/保存障害の境界は別検証 | W08/W10/P1 |
| E06 | 貯める / 獲得間隔 | **採用・実装済み**: 通常plannerの初回/複雑3問・通常6問を使い、予約の完了区間で[問題数分を加算](../../../src/domain/island/customization.ts)。固定16の実回答/同予約復帰は限定根拠。最適な獲得間隔・価格や通常入力速度は未検証で、timingEvidenceEligible=false | W08/W10/P1 |
| E07 | 貯める / あとどれだけか | **既実装・候補残り**: 39の[差額見積り](../../../src/domain/island/customization.ts)、40の家具不足数、41のほし/観察資格不足、次成長の姿を表示。固定16は選定価格と不足を確認。制作材料/部分完成の予告を永続目標とどう結ぶかは候補 | W02/W06/W08/P1 |
| E08 | 貯める / 中断・支援・再開 | **既実装・限定PASS**: 同予約の再開、遊びの取消、結果不明時の同意図再送を39〜41のwriter/hookへ接続。固定16身支度04と家具05 tabletで実回答復帰/reloadを確認。実背景・profile・native abort/通知欠落・旧予約を含む全境界は未合格 | W06/W07/W10/P1 |
| E09 | 選んで使う / 確定交換と抽選の区別 | **採用済みの区別**: 39〜41の選んだ品の確定取得、保存済み観察による0ほし資格、37の未知物の実験、有限来訪は別機構。抽選購入は採用しない。固定16の確定購入を、4資格品の取得や未知の正体の理解へ転用しない | W07/W08/P1 |
| E10 | 選んで使う / 小物・セット・全景の価格差 | **既実装・限定PASS**: 39の部位5〜35/飾り15〜25/テーマ60・100・150/完成75・120・175と所持分の差額、40の25・30・40、41の有料6品計85/観察4品0を実装。固定16で身支度6品、家具はtablet3品を購入。価格の最適性/全購入順は未検証 | W08/P1 |
| E11 | 選んで使う / いま使うか貯めるか | **既実装・選好未検証**: 小部位/表紙/模様/家具から大きな景色まで、同じ財布で本人が選ぶ。全未所持品の無料試用、取得後の明示利用も接続。横断する永続目標はE04の限定実UI経路が合格済みで、残高減少や購入数だけで選択の楽しさを認定しない | W08/P1 |
| E12 | 選んで使う / 通常通貨と有料通貨 | **採用済みの境界**: 通貨はほし1種類で有料通貨なし。41の朝夕/季節/無料設定、観察資格の0ほし取得、37の有限制作部品は別に表示・保存する。複数通貨は比較上の問いで追加採用ではない。4資格品の実導線は固定17資格03で両幅確認、無説明理解は人N=0で未検証 | W06/W08/W10/P1 |
| E13 | 受け取って使う / 交換演出 | **一部既実装・体験検証中**: 39は保存後に指定slotを反映、40は収納取得→本人の配置/実利用、41は取得表示→別の装備操作へ接続。固定16で選定経路を確認。短い受取/初利用の気持ちよさは未判定で、演出を次の学習の必須操作にしない | W01/W03/W08/P1 |
| E14 | 受け取って使う / その場で適用 | **採用・実装済み**: 39は取得権と今回slotを分離して同時保存。40は[収納状態で取得](../../../src/domain/island/furniture.ts)して本人が配置、41は[取得と装備を別action](../../../src/domain/island/expression.ts)にする。固定16身支度04/家具05 tabletで選定手順を確認し、未確定previewの混入と全保存障害は別受入 | W08/P1 |
| E15 | 受け取って使う / 取消・元に戻す | **既実装・限定PASS**: 単品/足跡/環境/外装のpreview取消、無料look/音への選び直し、37のdraft undo/redo、保存景色previewを接続。固定16で無料cap復元と同予約を確認。未知結果を未保存と断定しない契約を保持し、実音・全背景/再送境界は未検証 | W06/W08/P1 |
| E16 | 受け取って使う / 保存した着せ替え切替 | **既実装・限定PASS**: [3景色の保存](../../../src/domain/island/experience.ts)は配置/12slot/無料設定と[41の全selection v2](../../../src/domain/island/sceneStyle.ts)を凍結。固定16身支度04で選定v2保存/取消/同予約/reloadを確認。旧v1/省略・後発家具/展示衝突・同receipt再送の全実境界は未検証 | W06/W08/P1 |
| E17 | 揃えて眺める / 所持・未所持・重複 | **採用・実装済み**: 39の旧テーマ権/単品credit/所持差額、40のkind別所有、41のprofile別取得を実装。既存購入・保存境界の限定証拠を保持。全購入順と完成後の暮らしの組合せは別受入で、権利解決を再実装しない。 | W05/W07/W08/P1 |
| E18 | 揃えて眺める / セット完成 | **既実装・実購入の組合せ検証残**: 6部位＋飾りの完成と差額見積、3完成previewは確認済み。次は1シリーズの単品→差額セット→暮らしを限定確認。全購入順/全単品収集、途中と完成後の魅力は未確認。 | W08/P1 |
| E19 | 揃えて眺める / 住民の反応 | **既実装・実経路検証残**: 3仕事、3家具の接眼/布支持/同一cup、同じrigの衣装を接続。固定17の取得/本人復旧、固定24の有限18利用は別の限定PASS。3仕事→記憶再訪はnot-runのまま、全ペア/全配置へ広げない。 | W03/W08/P1 |
| E20 | 揃えて眺める / アルバム・見学・共有 | **既実装・限定PASS**: 3展示/作品A再訪/実写真棚、見学、外装と家の成果棚がある。shared-memories-06/shared-camera-03、固定17保存03の別profile画像/元bytes/実offline、家23を各版へ帰属させる。完成景色で利用→撮影→保存案復元の組合せは未確認。オンライン交流は必須採用ではない。 | W05/W09/P1 |
| E21 | 長く遊ぶ / 過去報酬への戻り方 | **採用・実装済み/限定証拠あり**: 39〜41の期限なし再装備と無料復元、12環境、sceneStyleなし/v1/v2の互換を実装。旧保存の実取得経路とcheckpointからの残経路は別記録で、全履歴・全成長の証拠にはしない。日付待ちや再購入を追加しない。 | W07/W08/P2 |
| E22 | 長く遊ぶ / ポイントの使い道 | **既実装・選好未検証**: 18部位/3セット、3利用家具、6有料品/4観察資格品、横断目標がある。全所持後も制作・共同記憶・写真・家の成果確認は無料で使える。何をまた試したいかはHuman N=0。架空の次商品で埋めない。 | W06/W08/P2 |
| E23 | 長く遊ぶ / 新旧テーマの混在 | **既実装・限定PASS**: 12slot別legacy-v1/parts-v1、無料look/追加品、景色v2を併用。appearance04/06・身支度04・旧景色checkpointは限定証拠。保存当時の姿/写真と現在の所有を保ち、後発成長を伴う完成景色の往復は別検証。家の賞を昔の景色へ後付けしない。 | W06/W08/P1 |
| E24 | 長く遊ぶ / 全部揃った後の過ごし方 | **既実装の体験あり・長期未検証**: 条件実験/複数解/undo、共同記憶/展示/再訪/写真、無料mix/家具/家の成果棚を実装済み。次は既存機能で作る→仲間が使う→記憶から戻る連続経路を確認。題材付き制作は別の未採用候補、全所持後の選好・自発再遊びはHuman N=0。 | W03/W04/W05/W06/W09/P1 |

### B01–B12: 追加12作品の取り出す価値

元資料の公式確認と設計解釈を混同しない。今後の参考画面調査では、原作の価格/課金や抽選を学習量へ機械的に換算しない。

| ID | 対象 | 比較対象 | 対応する体験 |
|---|---|---|---|
| B01 | リヴリーアイランド | 島・衣装・ペットを合わせた世界観 | W03/W08: 島/仲間/本人のまとまり |
| B02 | Spirit City: Lofi Sessions | 活動と通貨、購入前プレビュー、部屋の景観 | W08: 実景previewと音景 |
| B03 | Finch | 日々の活動から家具・服の選択購入 | W03/W08: 活動後の仲間の暮らし |
| B04 | どうぶつの森 ポケットキャンプ コンプリート | 選んで交換、家具配置、レイアウト保存 | W06/W08/W09: 確定交換/配置案/見せる |
| B05 | Clash of Clans | 村全体の景観、全画面プレビュー、外見報酬 | W08: 全景の変化 |
| B06 | Hay Day | テーマ装飾のコレクション、段階的な外観変更 | W02/W08: 途中も魅力あるセット |
| B07 | ハロー・スイートデイズ | キャラクター・服・部屋を合わせたテーマ | W03/W08: 家具で作る場面 |
| B08 | ねこあつめ2 | 家具を使う生き物、訪問、写真 | W03/W07/W09: 物→来訪→利用→写真 |
| B09 | Tiny Glade | 描く・置く操作から自然にできる美しい建築 | W01/W06: 置くと自然につながる |
| B10 | Sky 星を紡ぐ子どもたち | 素材を集める染色、外見の組合せ | W08: 個別配色と元へ戻す |
| B11 | Disney Dreamlight Valley | 家・服・家具、創作、過去報酬への導線 | W07/W08: 過去テーマと現在のmix |
| B12 | Habitica | 行動から報酬、見た目と性能の分離、ペット収集 | W05/W08/W10: 外見と能力の分離 |

### T01–T12: 元の優先12候補

| ID | 元の候補 | 対応する体験 | 実参加者で確認したいこと |
|---|---|---|---|
| T01 | 同じ場所が、一目で分かるほど育つ | W02 | 子どもが変わった場所を自分で指せる。未確認 |
| T02 | 作った物を住民が実際に使う | W03 | 完成後に住民を見に行く。未確認 |
| T03 | 普段の一問と、大きな完成の気持ちよさを分ける | W01/W10 | 入力を続けつつ、節目も分かる。未確認 |
| T04 | 対象×場所を試して性質を発見する | W04 | 別の場所でも自発的に試す。未確認 |
| T05 | 図鑑から発見の場所へ戻り、再現できる | W05 | 記録を見た後に再び遊ぶ。未確認 |
| T06 | 昔と今を同じ視点で比べる | W09 | 数字を読まずに成長を説明できる。未確認 |
| T07 | 並べ直しても獲得した成長を失わない | W06/W10 | 失う不安なく模様替えをする。未確認 |
| T08 | 次に育つものの姿と用途が想像できる | W02 | 自分の言葉で次の楽しみを示せる。未確認 |
| T09 | 仲間の好み・得意な仕事が違う | W03 | 名前や動きから仲間を選びたくなる。未確認 |
| T10 | 能力差のない珍しい訪問・外観 | W07 | 普段の成果も喜び、珍しい時は人に話したくなる。未確認 |
| T11 | 題材を選んで作る、おためしの場所 | W06 | 指示を増やさず本人が配置を試せる。未確認 |
| T12 | 季節・環境音・小さな来訪で再訪を新鮮にする | W07/W08 | 義務感からでなく景色を見に戻る。未確認 |

## Deliberate non-adoption — 衝突部分と残す価値

| 元の仕組み/案 | 見送る部分と理由 | 残す具体的な価値 / 対応 |
|---|---|---|
| Forestの中断枯死/共同責任、Habiticaの未達損失 | 休み・中断・誤答で成果を失う方式はGoalの明示条件と衝突 | 確かな蓄積・同端末で見せ合う。FO01/03/11/12、W02/W09/W10 |
| SimCityの破壊災害・維持費 | 育てた物や学習成果を取り上げ、支払いを日常の必須工程にすること | 旅人・風・漂着物、制作物を住民が使う循環。SC02/07/11、W03/W07 |
| BuildItの通常学習ごとの強制回収 | 連問の追加0操作に反する | 任意の収穫/部品をはめる手応え。SC12/13、W01/W06 |
| 有料ガチャ、性能差のある珍しさ、学習支援を買う通貨 | local-firstの無課金範囲、支援同額、基本成長確定と衝突 | 好みの確定交換、能力差のない訪問/外観、無料段階ヒント。MC11/12、YO10、PK14、W05/W07/W08 |
| 時刻限定・期間限定の必須取得、連続日数の没収 | 学習の時間/中断を罰や締切で縛る | 季節や朝夕の表情、見逃しても再会/再選択。FO08、AC02/03/13、W07 |
| オンライン交換/共同進行/島訪問 | 現在の端末内保存・profile分離に対しアカウント/通信が必要。今回のGoalにオンライン指定なし | 家族に同じ端末で見せる見学/記念写真。FO11、AC16、PK15、W09 |
| 外部寄付/植樹等の金銭連携 | 外部契約/送金が必要で、現行のゲーム改善の実装範囲と異なる | 自分の制作が住民の役に立つ。FO13、W03 |
| 任意創作を通常問題の攻略条件へ差し替える | 通常の全教科入力・速い連問・学習正本の保持と衝突 | 独立した工房/観察遊びとして試す。MC04/15/17、AC07、W04/W06/W10 |

これらは価値の全体を不採用にする判断ではない。104項目の翻案候補は対応行に残す。主要観点を見送りへ移すには、その観点を満たす代替体験かGoalとの具体的な衝突を記録する。

## Verification

### V0 — 視覚と動きの魅力

同一source/build/flag/candidateの390×844と768×1024で、変更前後の実画面・必要な動作の連続場面を確認する。成長/外見は同倍率、住民は取る→運ぶ→使う→返すの顔/手/足/対象を見える状態で比較する。作品のカタログ絵や別buildの画像を実利用証拠に混ぜない。作者の視覚判断を記録し、子どもの「欲しい」「また触る」は実利用者がいない場合は未確認とする。

### V1 — 意味の理解と学習非阻害

文字を読まなくても、何を選び、何が起き、どこへ戻れるかを作者が確認する。音off/reduced motion、44px操作面、touch/keyboard、選択/取消/中断/再開を扱う。通常問題間の追加0操作・正解→次入力P95≤650ms・誤答→再入力P95≤550msを保ち、ヒント/お手本/独力再確認/復習/教科入力を阻害しない。作者確認と実参加者の無説明理解は別に記録する。

### V2 — runtimeと保存

採用した機能の最小単位でdomain検証を行い、旧データ・profile所有権・CAS/revision・同操作再送・保存abort/retry・途中再開・実SW offlineを必要範囲で確かめる。実際に表示した発見だけを記録し、試作/preview/自由遊びは学習実績を増やさない。既存の学習/成長と追加の外見/作品/観察のtransaction境界を明示する。

島domain/page/storageに触れる統合段階では[検証matrix](../../ai/verification_matrix.md)の現行必要検査を適用する。`verify:core`、`e2e:smoke`、classic構成の`e2e:pwa-update`、`e2e:island`、`e2e:island-pwa`、`e2e:island-living`、`benchmark:island-fixed-ten`と機能専用検査を、正しい固定build/sourceへ実行する。旧報酬契約専用の未移行ハーネスを現行機能の証拠にしない。高速入力の固定fixtureは通常plannerや子どもの学習速度と区別する。

### V3 — 分析の完全性と採用判断

104 IDが重複/欠落なく存在し、A18/H12/D10/G8/N8/R16/E24/B12/T12の索引を確認する。採用した各行に現在のコード・仕様・実UI証拠とV0/V1/V2の判定を紐付ける。未採用は理由と代替を示す。初回案の作成、既存きせかえの検証、仕様36のE1〜E6、一つのworkpackageの完成だけでGoal全体を完了にしない。

今回の対応表/監査文書は、件数/ID/索引の機械照合、read-through、親担当による`npm run docs:check`で確認する。アプリの実装合格をこの段階では主張しない。

## Progress

### Now

- 2026-09-09: 仕様37〜42と569d1c0の実装へ関連行を再照合。接続岸37の限定証拠、3仕事/工作住民の実経路検証残、完成景色の利用、未採用の制作題材を区別した。編集時HEAD/origin/main 8e36612のnavigationと、固定37の正式80run限定PASSは別境界。学習中不可視を不具合とした記録をSSOT30へ照合して訂正し、新仕様のヘッダー通知は後続の固定39・7実経路で限定確認した。

- 2026-09-08: 原表104件と仕様28/30/35/36を照合し、全行の狙い・現sourceの根拠・残る翻案・仮分類・P1/P2・検証場面を記録した。
- 18観点、12気持ちよさ、10デザイン、8成長、8欲求、16報酬、24交換比較に現コードの到達範囲と不足を追加した。追加12作品、元の優先12候補も保持する。
- 初回監査時は仕様36のE1〜E6で到達した部分を反映した。3配置保存は自由な別試作場ではなく、2つの条件反応は道具実験/多段連鎖ではない。無料の衣装/音/旗は16カテゴリの取得報酬をすべて実装した意味ではない。
- 別Parkの部品編集・決定的な連鎖実行と、別Exploreの手掛かり/大発見は再利用候補として記録した。島と保存/学習フローが別のため、現島で遊べる実装には数えない。
- 機械確認: 原表と104 IDの集合一致/重複0、9索引の件数/連番、全104行のsource/候補/7列、3監査文書の全ローカルリンク実在を確認。
- 実画面3ゲート・実参加者・固定buildの統合検証は本監査では未実行。「十分候補」を含めGoal全体の完了は宣言しない。

### Next

1. 既存の3仕事各1回→同対象の記憶再訪→途中停止/同予約復帰を、仕様38 M01〜M04/M12の未検証経路として先に確認する。展示や旧carryだけの合格で代替しない。
2. 仕様37の住民による接触→水車/ベルの結果→接続変更/復元を、修正後の両幅で確認する。標本/制作A/B/undoの既存PASSを再実装要求へ戻さない。
3. 新仕様30の大きな節目のみのヘッダー通知は固定39で実装し、7実経路・正式80run・Island PWAを限定確認した。固定37の当時仕様どおりの不可視測定とは分け、4地区全成長巡回と残る回帰を追う。
4. 1シリーズの単品→差額完成→家具利用/展示/写真→保存案復元を限定確認する。全16報酬とU7の責任は残し、過去の有限matrix/音/家の証拠を最新版全体へ転用しない。
5. 題材付き制作はAC17の未実装・未採用候補として用途と採否を決める。Source A、無説明理解・自発再遊びは別判定で、Human N=0・全Goal未完了を保持する。

### Risks and boundaries

- 表が埋まったことと体験の完成は異なる。source根拠は転記したが、全行の実画面と採否の証拠はこれから必要。共有treeは他担当が更新中なので、release判定では固定buildへ照合し直す。
- 現行仕様28内には過去段階の候補IDや旧区間拡張の記述が残る。現在契約は先頭の優先注記と仕様30/35で読むが、現source/buildの証拠と一致させて親担当が整合を判断する。
- 104個の独立機能を増やすのではなく、複数の分析項目を同じ実体験で満たす。新しい通貨、毎区間の大量配布、未設計の無限拡張を網羅性の代替にしない。
- 研究資料の『ポイントは新規提案』等は調査当時の状態。現在仕様は35を読み、原資料の歴史的説明を現状へ誤適用しない。
