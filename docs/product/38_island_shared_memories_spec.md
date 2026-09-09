# 仲間の仕事・島の展示・写真の棚

2026-09-09の写真の復帰補強：一覧/詳細の読込失敗でも退出を表示し、画像bytesの読込はその場で再試行できる。削除の確認はキャンセルへ最初にフォーカスを渡し、削除中のUI退出を止める。履歴移動や背景化で離れた後の削除完了は現在の画面へ遅れて作用させない。撮影→一覧は撮影を終了して元の家/写真棚へ戻れる履歴にする。高さ600px以下の室内撮影も部屋の固定を解除し、撮影・退出ボタンを全体が見える位置までスクロールできるようにする。保存schema、12枚上限、既存画素、学習writerは変更しない。

- Date: 2026-09-08
- Status: Adopted — F01/F02の実装契約。実装・実画面検証は進行中
- Review By: 2026-09-15
- Owner: Island experience goal / spec review

親は[01](01_app_spec.md)、任意体験と学習境界は[36](36_island_experience_spec.md)、標本と作品は[37](37_island_workshop_spec.md)、保存は[13](13_data_storage_migration_spec.md)。[残る差分の監査](../tasks/active/2026-09-08-island-experience-remaining-audit.md)のF01/U3とF02/U5を一続きにする採用契約。2026-09-08の親レビューで、限定した島状態、作品snapshot、初記憶receiptの直接参照、学習から分離した写真保存を採用した。

## 1. 体験の目的と範囲

自分が調べた物・作った物を選ぶ → 仲間に得意な仕事を頼む → 同じ物が手を通って島の暮らしに入る → 仲間がその出来事を覚える → 本人の島へ飾る → 展示から同じ対象へ戻る → 好きな瞬間を撮って見返す。「依頼カードを完了」にするだけでは成立しない。依頼の文、達成数、写真の代わりの生成画像で実物の行動を代替しない。

入口はホーム・入江・展示からの任意操作。仕様37と同じ入江利用条件を用い、通常の学習開始・連問へ確認や依頼受取を挟まない。3住民の利用可能性は現在の解放状態を守る。未解放住民の仕事ができなくても本人の展示・再観察・作品実行・撮影はできる。新しい通貨、学習能力差、ほしや成長の加算、空腹/友好度の減少、期限付き依頼、放置罰を加えない。

本仕様はF03「家・道・植物等の個別交換と完成セット」、F04「新しい家具の取得と実利用」、F05「季節・音・色模様・足跡・アルバム装飾」を消化済みにしない。以下の仕事用の盆・花びら・ランプ・休憩小物は無料の有限な行動用具で、F04の家具商品を代替しない。R11/R14/R15とE20/E24の一部に対応するが、16報酬全体・24比較全体の完了ではない。

## 2. 現在の実装との接続点

2026-09-08の採用時点のコードを読み取った境界。下表にない新機能は本仕様で追加する実装責任である。

| 現在の根拠 | 再利用するもの / 追加が必要なもの |
|---|---|
| [workshop.ts](../../src/domain/island/workshop.ts)、[workshopLayout.ts](../../src/domain/island/workshopLayout.ts) | profile別3標本の安定ID、洗浄/初観察、入江3棚、4部品の検証済み配置、2保存作品。現作品は同じ保存枠へ上書きされるため、展示と記憶には下記の独立snapshotが必要 |
| [experience.ts](../../src/domain/island/experience.ts) | 島/住民名、装い、音、3配置案。依頼・関係の記憶・主島展示・写真データは現在の型にない |
| [animals.ts](../../src/components/island/three/animals.ts)、[sharedActivities.ts](../../src/components/island/three/sharedActivities.ts)、[sharedActivityController.ts](../../src/components/island/three/sharedActivityController.ts) | 実住民の経路事前検査、手のworld anchor、運搬/手渡し/受取姿勢と連続したprop。既存のおすそわけを維持し、任意仕事の対象/完了条件を別controllerで接続する |
| [workshopPresentation.ts](../../src/components/island/three/workshopPresentation.ts) | 選んだ実住民のlane歩行→実ハンドル接触→実行→種別の注視。住民のtransform/visibilityの復元。依頼や共同出来事の保存は別途必要 |
| [catalog.ts](../../src/domain/island/catalog.ts)、[repository.ts](../../src/domain/island/repository.ts) | 基本7家具、土地/予約領域/既存家具の配置検査、active profile所有、島revision/CAS。展示を追加するなら家具側の検査にも展示の占有を反映する |
| [islandPhoto.ts](../../src/components/island/islandPhoto.ts)、[IslandAlbum.tsx](../../src/components/island/IslandAlbum.tsx) | 実canvasからPNGを書き出す処理と、成長比較/暮らし発見。現在は端末内の写真一覧・写真削除・Blob保存がない |
| [db/index.ts](../../src/db/index.ts)、[user/repository.ts](../../src/domain/user/repository.ts) | Dexie v7。profile削除は島3storeを含むtransaction。写真用store追加時には同じ削除契約を拡張する |
| [workshopRepository.ts](../../src/domain/island/workshopRepository.ts)、[learningAttemptWriter.ts](../../src/domain/learningAttemptWriter.ts) | canonical intentと保存receipt、未知I/Oの同操作再送。現在の `islandTables` は学習transactionのtableも含む。写真repositoryはこれを再利用せず、画像bytesを学習writerへ渡さない |

## 3. F01 — 選んだ仲間に頼み、一緒に残す

### 3.1 依頼の選択と実仕事

本人が標本または保存作品を選び、住民を選ぶ。同じ対象でも、選んだ住民によって手の仕事と最後の反応が変わる。名前だけ異なる同じ運搬アニメーションにしない。得意仕事は種ごとに1つ、計3つとする。

| jobId / 住民 | 現物を使う工程 | 完了として保存できる可視結果 / お返し |
|---|---|---|
| `carry` / カワウソ | 入江から選んだ未展示の物は準備盆、すでに展示している物の移動は現在の展示台を出発点にする。カワウソが同じ標本または作品の小盆まで歩き、両手の接点で持ち上げ、事前検査済みの経路を運び、選んだ展示台へ置く。作品の部品を運ぶ途中で組み替えない | 持っていた同じ物が台に接地し、手が離れたframeの描画後に展示を確定する。その後、台の横へ座る/しゃがむ短い休憩へ誘い、同じ物を見る |
| `gather` / ウサギ | 同じ展示対象のために、準備盆の3つのくぼみから花びらを1枚ずつ手で集める。少なくとも盆→手→展示の往復が見え、対象の周囲の3つの実位置へ並べる。花びらは無限収集資源ではなく無料の3つの行動prop | 3枚が展示の足元へ揃ったframeの描画後に、その展示の `petal-ring` を保存する。ウサギが鼻を寄せ、用意した小皿からひと口のおやつを差し出す。受け取る/一緒に休むは任意で、記憶の保存を条件にしない |
| `illuminate` / キツネ | 準備盆からランプを手に取り、同じ標本または作品の実表面へ向ける。色ガラスはその実位置から色を通し、木/貝は輪郭や溝の影を返す。作品では配置された部品の実位置を照らす。ガラス部品がない作品へ透過光を捏造しない | ランプ→対象→光/影の到達点が同じframeで読める状態の描画後に仕事完了。キツネが対象と本人側を交互に見て、一緒にのぞく余韻を残す。仕様37の初観察を裏で加算しない |

`gather` / `illuminate` は既存の展示対象へ頼む。展示がまだなければ、同じ選択を保って本人が置く操作へ進む。カワウソ以外を選んだことを理由に標本の輸送能力をロックしない。準備盆と小皿は展示の配置検査に含める有限の作業領域であり、所有数を持たない。

各工程の本人用「おく」「ならべる」「あてる」操作も、対象選択と同じ物/接点へ作用する。仕事の選択ボタンを押しただけで場面を完了させない。説明を閉じても現在の物・持ち手・目的地が見える。住民からの短い誘いを出す場合も、現在の所有対象に限る非モーダルな提案とし、断る/後でにすることで何も減らない。

仕事中の近景は、実際の物・手・住民・周囲の家や家具を使って遮蔽を確認する。接触点が画角内でも、背中や他の物に隠れる構図では完了の見た目を満たさない。照射ではランプ・対象・受け面を一緒に読み取れることを確かめる。展示台の受け面は不透明な同一平面を重ねず、描画のちらつきや放射状の縞を意図した模様・影として扱わない。受け面の高さ、対象の接地、保存済み位置・向きは共通の実geometryを正本に維持する。

### 3.2 依頼の状態と途中からの復帰

同profileで保存中の依頼は最大1つ。`requestId` を本人の確定操作時に一度生成し、residentId/jobId、対象snapshot、source/destinationの識別、開始時の島revisionを凍結する。途中の手足座標やpointermoveは保存しない。

保存状態は `prepared` と `result-seen` の2段階とする。開始時に `prepared` を保存し、再読込後は「つづける」で最初の合法な準備位置から実行する。`result-seen` は可視結果のreceiptが保存済みで、展示更新・共同記憶の処理まで完了した状態。再読込時に仕事やお返しを勝手に実行しない。次の新依頼または明示的な片付けでこのactive枠を置き換え、確定済みreceipt/展示/記憶は保持する。

- 依頼は任意に後回し/取消できる。カワウソの運搬途中で止めた場合、元の展示と入江の所有を保持し、運搬中の同じ物を元の展示台または準備盆の合法な静止状態へ戻す。元の台の物は実際の持上げ接触からだけ一時非表示にし、仕事を始めるために準備盆へ先に瞬間移動させない。未確定の置換で前の展示を消さない。
- 既存展示が選択後に別tabで変わった場合、その展示へ古い依頼の結果を適用しない。active依頼は残して競合を示し、最新の対象から選び直せる。経路が不成立なら住民を壁/家具へ貫通させず、配置を直すか本人の操作へ戻る。
- 学習・背景化・他profile・ビュー退出で演技、音、未消費command、撮影要求を止める。後で戻っても明示操作まで再生しない。途中停止のために標本や作品を削除する処理を持たない。
- reducedでは同じ順序の少数の姿を描き、source→手→目的地を最低3つの可視段階で伝える。経路や接触を無検査の瞬間移動へ置き換えない。
- runtimeの `afterRender` はactive/visible/current profileとrequestId/対象keyを照合し、実接点と可視結果が成立した時だけ完了commandを発行する。経過時間だけ、画面外、背景化、UIラベルの変更は完了証拠にならない。

### 3.3 覚えてくれる小さな記憶

記憶は「誰と、どの物に、何をしたか」の実記録で、友好度の代用品となる反復稼ぎにしない。初めてその組合せを行った日時/順序、residentId、当時の呼び名、jobId、対象snapshot、可視結果を保存する。島名や住民名を後で変えても当時の呼び名を履歴から書き換えない。現在の住民へのリンクはresidentIdで維持する。

同一 `residentId + jobId + targetKey` の再演は同じ記憶を返し、日時/初順序/件数を増やさない。初事実は下記の安定したfirst receiptに残し、棚から外した後に同じ物をもう一度残す場合も元の日時/順序を復元する。記憶から同じ対象を選ぶと住民がその物へ向き、前の仕事に対応する短い反応を返す。履歴文だけを表示し、実住民と対象が無関係に暮らしている状態を受入にしない。新しい学習・ログイン日数・世話回数はこの反応の条件にしない。

記憶の棚はprofileごとに最大12件。満杯でも依頼の実仕事と展示は完了できる。新しい組合せの記憶は勝手に最古を消さず、receiptに `not-stored-full` を残し、任意の棚で本人が残す物を整理できる。満杯で保存していない記憶を「おぼえた」と表示しない。同じactive結果を後から「記憶に残す」場合も同じmemoryKey/結果receiptを用いる。記憶だけを明示的に外しても対象・展示・初発見・住民を失わない。

## 4. F02 — 主島へ飾り、同じ対象へ戻る

### 4.1 展示の形と配置

主島に任意の展示枠 `display-1` / `display-2` / `display-3` を持つ。各枠は空、または1つの標本/作品とその展示台。入江内の既存3棚とは別の状態で、主島のホーム・見学・写真に実物として存在する。一覧だけ、入江の棚を増やすだけでは成立しない。

本人が枠を選び、主島の合法位置へ台を置く。標本用の台と作品用の台で必要な占有領域を変える。配置はtarget/位置/向き/作業領域をまとめてpreviewし、取消で全保存値を保持する。具体的な半径とhand/source/destination anchorはgeometry定数に一元化し、見た目より小さな衝突円を用いない。作品は4×4の配置関係とwater/shaftの向きを保って縮尺を変え、接続と素材が読める近い画角を持つ。

展示の操作面が長くなっても、試している島のcanvasを上部に残し、位置/回転の変更を確定前に見続けられるようにする。phoneでは高さを抑え、操作のための領域も残す。表示を復帰させるためだけに確定ボタンを押させない。実行commandは実canvasの表示後に送り、退出/背景化の未送信commandを復帰時に自動再生しない。

- 基本4居場所/7家具、予約領域、獲得済みの土地を変えない。展示は `island.items` へ既存kindを偽装して追加せず、独立の3枠として検証する。
- 展示→家具、家具→展示、展示同士、準備盆/住民の仕事経路について双方向に占有を検査する。既存家具を自動で移動/収納して空間を作らない。空きがなければ未配置のまま保持できる。
- 自動成長の配置提案も展示を避け、置けない新家具は既存の未配置/`autoPlacementBlocked` 契約へ戻す。既存7家具の取得そのものを失わせない。
- E6の旧配置案を適用する時、今の展示は巻き戻さない。衝突するなら家具だけを部分適用せず、競合箇所を示して戻す。展示を外すと物は選択一覧へ戻り、初発見/標本名/保存作品を消さない。
- 標本の同じ個体を複数の主島枠へ重複配置しない。他の枠への移動は一度のatomic変更とする。入江と主島は同じ所有物を見る別の場面であり、所有数は増やさない。作品の同じcaptureも主島では1枠とする。

### 4.2 標本参照と作品snapshot

標本は仕様37の安定した個体IDを正本参照する。主島の実物は現在の洗浄状態・確定した呼び名に追従し、名札を変えても別の標本にならない。正体未判明でも展示可能だが、未確定の正体や物性を名札で先に明かさない。記憶と写真の当時の表示は別snapshotで保持する。

作品の展示は、本人が「この作品を飾る」と選んだ時点の名前・capturedAt・検証済み4部品layoutを複製したimmutable snapshotを正本にする。少なくとも1つの組立済み部品が配置された作品を対象とし、空の保存案を展示選択しても消さず、制作へ戻れる。ベルへの成功到達は展示条件にせず、本人の途中案も残せる。`work-1` / `work-2` は編集用の保存枠であり、展示のidentityにしない。同枠をBで上書き/削除しても、展示したAとAの記憶は残る。展示をBへ更新するのは本人の明示的な置換のみで、preview/取消を持つ。

`targetKey` は次のversion付きcanonical tupleを文字列化して作る。DOM selectorや表示名として利用しない。

- 標本: 既存 `workshopSpecimenIdentity(profileId, specimenId)` の返り値をそのまま使う。この関数は `encodeURIComponent(profileId)` 済みであり、生のprofileIdを連結してIDを再実装しない。
- 作品capture: `['island-shared:v1:work-capture', profileId, workId, capturedAt, canonicalName, canonicalLayoutKey]`。同じ保存内容を再表示しても同じkeyになる。旧作品に新しいcaptureIdがなくても推測によるUUID付け直しをしない。
- 主島枠: `['island-shared:v1:display', profileId, slotId]`。枠IDと中のtargetKeyを分ける。
- 依頼: `['island-shared:v1:request', profileId, requestUuid]`。UUIDは一度だけ生成しretryで変えない。
- 記憶: `['island-shared:v1:memory', profileId, residentId, jobId, targetKey]`。

canonicalLayoutKeyは仕様37のnormalizer/validatorを通した固定順の4部品/組立/座標/向きに基づく。新しいcaptureを作るrepositoryは参照元profile、現在のsaved work全内容、期待keyを検証してsnapshotを生成する。保存済み展示/記憶からの再訪や依頼は、その保存済みsnapshotとkeyの自己整合を検証し、上書き/削除された元slotが今も一致することを要求しない。外部から渡された任意layoutを「本人の保存作品」として登録しない。表示時に名前だけ同じ別slotへ推測で付け替えない。

### 4.3 展示・記憶からの再訪

展示をタップ/keyboardで選ぶと、実物を近くで見ながら「いりえで ためす」「なかまに たのむ」「しゃしん」を選べる。標本の再訪は同じspecimenIdを選択した入江へ戻る。既存の洗浄/観察/棚を保ち、別の標本や初期状態を開かない。

作品の再訪は展示snapshotのAを読み取り用に実行する。現在のdraftがBでもBを描かず、Aの配置/向き/組立/接続停止点から実演する。再演だけでdraft、undo/redo、2保存枠、初観察を変えない。「この案からつくる」を別途選んだ時だけAを新しいdraftのbaseにし、現在の試作から切り替わる内容をpreviewする。取消は現draftを保持する。作品への参照が保存枠削除で切れたという理由で同じ案の再演を禁止しない。

発見帳には、既存15暮らし発見・成長比較を残し、入江の3個体/初観察/制作初観察と展示への往復を追加する。日時が同じ記録は既存の保存order、続いて安定IDで順序を定める。15暮らしIDへ入江IDや共同記憶を混ぜず、それぞれの由来が分かる入口にする。入江の「初めて」を依頼完了や主島展示で先取りしない。

## 5. 実写真をprofile別の端末内棚へ残す

撮影対象は「しま全体」「選んだ展示」「選んだ仲間」の3つ。現在の単一rendererの同じ世界を構図だけ変えてプレビューし、本人のシャッター操作後の実描画frameを一度だけ取得する。展示物や仲間の顔/手/道具を含むboundsを画角へ収め、枠線や説明で対象を隠さない。入江でも選択標本/作品/仲間を現在の実場面として撮れる。

写真はcanvasの画素と、その時の島名/対象名/撮影時刻のsnapshot。DOM全体や学習面、プロフィール設定、成績を撮らない。撮影後に現在のtheme/名前/衣装から場面を再生成するものを写真と呼ばない。画像生成・外部upload・自動SNS共有は使わない。既存の明示的なPNGダウンロードも保つ。

- 棚は現在profileの最大12枚。縮小一覧→1枚表示→任意PNG書き出し→明示削除を持つ。枚数/容量が満杯でも古い写真を自動削除しない。失敗時はその場の一時previewを保ち、「まだ のこせていない」と区別する。学習へ戻る際に保存や整理を強制しない。
- 長辺は最大1600px、PNG本体は最大2MiB、thumbnailは長辺320px/128KiB以下、同profileの本体とthumbnail合計は24MiB以下。元frameが上限を超えたら内容を保って1600→1280→1024→800の順で縮小し、収まらなければ未保存として扱う。元画像を拡大せず、極端な縮小で対象を読めなくして成功にしない。
- 模様の多い景色でthumbnailだけが128KiBを超える場合は、同じ撮影frameから320→256→192→160の有限候補で縮小し、上限に収まる最も大きいものを使う。元画像はthumbnailの都合で縮小・再撮影しない。小さなframeを拡大せず、同じ寸法を重複変換しない。最小候補でも超過する場合とview/profileが変わった場合は保存しない。
- `photoId = ['island-photo:v1', profileId, captureUuid]` をシャッター時に一度生成する。画像decode/resize/hashの間に再撮影しない。実frameを取得した時点で要求を消費し、renderer再mount/アルバム往復で撮り直さない。
- 非同期変換後にactive profile/view sessionが変わっていたら未送信要求を捨て、object URLを破棄する。保存開始済みなら結果を現在profileへ適用しない。別profileのgallery query、thumbnail、一枚表示、ダウンロードに古いURLを再利用しない。
- 写真を削除しても標本・作品・展示・共同記憶・初発見は消さない。逆に展示/記憶/保存作品を外しても写真を消さない。過去の写真から現在の対象への参照がなくても画像は見られる。単独photo rowに作品の完全snapshotを重複保存せず、撮影時の対象key/名前は説明用の任意metadataとする。
- 音offは無音シャッター、reducedはflash/拡縮なしで保存状態を伝える。撮影中も任意の学習復帰を演技待ちにしない。

## 6. 永続化の型・上限・旧値

### 6.1 島に属する小さな状態

`IslandRecord.sharedMemories?: IslandSharedMemoriesState` のoptional v1拡張とする。名前に反してBlobは含めず、最大3展示/1依頼/12記憶の小さな構造に限る。

```ts
type SharedTarget =
  | { kind: 'specimen'; targetKey: string; specimenId: WorkshopSpecimenId }
  | { kind: 'work'; targetKey: string; sourceWorkId: WorkshopWorkId;
      capturedAt: number; name: string; layout: WorkshopLayout };

interface IslandSharedMemoriesState {
  version: 1;
  displays: Partial<Record<'display-1' | 'display-2' | 'display-3', {
    target: SharedTarget; position: IslandPosition; rotation: number;
    arrangement: 'plain' | 'petal-ring'; placedAt: number;
  }>>;
  activeRequest?: SharedRequest; // 最大1件、prepared | result-seen
  memories: SharedMemory[]; // 最大12件、memoryKey一意、first orderを保持
  nextMemoryOrder: number; // 新しい初事実だけで増える非負safe integer。棚から外しても戻さない
}
```

`SharedRequest` はrequestId/residentId/jobId/target、destinationのslot/targetKey/poseの期待値、状態、準備時刻を持つ。可視完了後だけresult/receiptId/completedAt/記憶の保存結果を付ける。`SharedMemory` はmemoryKey/residentId/jobId/target、当時の島/住民/対象名、結果、firstAt/firstOrderを持つ。標本の記憶には当時の表示名/cleanedMask/既知の結果だけの小snapshotを追加し、現在の標本正本を上書きしない。work snapshotは表示枠/依頼/記憶へ明示複製するため、削除時の参照カウントで別の記憶まで消す共有GCを必要としない。

旧行で省略されていれば空の3枠/依頼なし/記憶なしを読み取る。初回の明示的な共有操作までmaterializeせず、普通の学習writerや起動時に旧islandを書き換えない。unknown version、未知resident/job/slot、上限超過、targetKey不一致、壊れたlayout、異なるprofileのIDを黙って空にして上書きしない。問題の状態を保持して回復可能なエラーとする。NFC/空白/16文字/制御文字禁止は既存の命名契約を再利用する。

### 6.2 写真専用storeとDexie v8

DBは採用時点でv7である。本機能の実装時、v7の全store/indexをそのまま継承し、次の3storeだけを加えるv8 migrationを行う。既存島のschemaVersionは1のまま。旧学習予約や写真のないprofileの一括変換はしない。

```ts
islandPhotoAlbums: '&profileId'
islandPhotos: '&id, profileId, [profileId+capturedAt]'
islandPhotoBlobs: '&id, profileId'
```

- album row: `{ profileId, version: 1, revision }`。行なしはrevision 0/空の棚。島revisionと独立させる。
- photo metadata row: id/profileId/version/capturedAt、撮影時の島名/任意対象名とkey、構図、PNG/thumbnailのmime/dimensions/bytes/SHA-256。全metadataが小さく、一覧取得でPNG本体を読む必要がない。
- blob row: 同じid/profileId、PNG `Blob` とthumbnail `Blob`。学習profile、IslandRecord、islandPlans、学習action、汎用JSON/localStorageへbase64/bytesを混ぜない。
- photo操作のreceiptは既存 `islandEvents` に独立namespace/type `photo_changed` で保存し、id/profileId/albumRevision/canonical metadata intent/digest/結果だけを持つ。画像bytesやdata URLをreceiptへ含めない。通常回答がこのreceiptを学習イベントと誤認しないよう型と集計filterを分ける。

写真repositoryのtransaction対象は `appData / islandPhotoAlbums / islandPhotos / islandPhotoBlobs / islandEvents` に限定する。profile所有確認のためappDataを読むが、その内容は更新しない。`islandTables` と `getLearningAttemptTransactionTables` へ写真storeを追加せず、通常の回答保存や島全体のcloneで画像を読み書きしない。capture/decode/resize/hashはtransactionの外で行い、整形済みの同じbytes/digestを短いatomic保存へ渡す。

## 7. CAS・receipt・失敗からの復帰

展示/依頼/共同記憶はcanonical actionを受ける専用reducer/repositoryを持つ。任意の全state置換をAPIにしない。既存のactive profile/島revision/CASを使い、島の状態更新と `shared_memory_changed` receiptを同一transactionへ保存する。準備、可視結果、取消、記憶追加/削除、展示変更は別の明示actionで識別する。

receipt keyは `['island-shared:v1:operation', profileId, expectedIslandRevision]`。同key/同canonical actionのretryは保存済み結果を返し、別actionは競合。可視完了actionはrequestIdとfrozen target/destination、runtimeの可視結果を照合し、現在のprepared依頼だけを完了できる。仕事完了と展示更新と記憶の追加または満杯結果が分断されない。すでにresult-seenの同依頼を再送しても記憶を重複させない。

依頼の準備時には同じ既存event storeへrequestIdを主キーとする小さなreceiptも残す。別の依頼の後に昔のrequestIdを新しい仕事へ再利用することを拒否する。操作receiptと同じtransactionで保存し、演技frameごとのeventやIslandRecord内の無制限registryを増やさない。

初事実は同じtransactionで `['island-shared:v1:first-memory', memoryKey]` をIDとする小さな `shared_memory_first` eventへ一度だけ保存し、firstAt/firstOrder/当時の名前/対象snapshot/可視結果を保持する。これは既存 `islandEvents` の保存receiptであり、IslandRecordに無制限のfirst registry/tombstoneを持たせない。追加indexや全event走査は不要とする。

repositoryは可視完了または明示再収録時に、このIDを `islandEvents.get(id)` で一度取得し、type/profileId/residentId/jobId/memoryKey/targetKey、snapshotの形式とcanonical key、可視結果、firstAt/orderを検査する。不一致は競合として保持し、現在値で上書きしない。検証済みの `firstFact?: SharedMemory` を純reducerへ渡し、UIの任意firstFactは受け付けない。既存firstFactがあればその値を再利用し、なければ可視完了時だけ現在の `nextMemoryOrder` から作ってcounterを進め、島更新/操作receipt/first receiptを同時commitする。棚の整理後に追加するだけの操作は、実結果receiptのない新しい初事実を生成できない。

棚の12件上限は本人が見返す所蔵の上限であり、削除後の不確実retryを識別する既存操作receiptまで破棄する上限ではない。first eventは新しい実仕事の組合せだけで作り、毎frame/再演/閲覧で増やさない。棚の削除はこの初事実を学習や収集報酬へ転用せず、profile削除ではreceiptも一緒に消す。

写真保存は `['island-photo:v1:operation', profileId, expectedAlbumRevision]` をreceipt keyにする。active profileとprofileの存在確認をreceipt照合より先に行い、album revision、写真数、合計bytes、photoId/digest、metadata/blob整合を同じtransactionで検査する。保存成功はmetadata+本体+thumbnail+album revision+receiptの全commit後だけ。削除も同じ5table内でmetadata/blobを一緒に削除し、revision/receiptを残す。同じ保存receiptのretryが削除後に届いても削除済み画像を再作成しない。

- 未知のI/O失敗は、UUID、expected revision、対象、名前、画像bytes/digestを変えず同じintentでretryする。結果不明の操作を新しい操作として押し直して二重保存しない。
- 既知CAS競合では最新状態を読み直し、前の意図を勝手に最新revisionへ付け替えない。別tabが展示/写真棚を変えた結果を残し、本人が最新対象からやり直せる。commit後応答欠落はreceiptを読んで回復する。
- abort/容量不足はpartial rowや片方だけの削除を残さない。古い写真や別profileの行を空き容量のために消さない。fullとquotaと競合を区別し、未保存は未保存のまま伝える。
- 既存の共通writer lock/PWA critical-persistence保護は維持する。変換や演技中までlockを広げない。新たな学習開始時には未送信の写真/演技を止め、開始済みの短い保存は原子性を守って解決する。保存失敗を回答失敗へ変換しない。
- 現在の成長/ほしは保存された予約契約に従う。本仕様の閲覧、作業、展示、写真のために予約/slots/支援/SRS/独力/復習/回答ログ/完成区間数/報酬残高を更新しない。

## 8. offline・移行・削除・資源

写真/展示/記憶の全機能は同端末のIndexedDBとbundled描画資源で動く。ネットワーク画像URLを正本にせず、実service workerのoffline再起動でも棚を読める。端末内保存であり、別端末への同期や消去後のクラウド復元を約束しない。既存PNG書き出しは端末外へ本人が残す手段になる。

profile削除の既存transactionと `deleteProfileOwnedIndexedDbRows` に3写真storeを追加し、そのprofileのalbum/metadata/blobと既存islandEventsを一緒に消す。削除失敗で写真だけ残る/別profileを消す状態を作らない。全データ削除経路も同じ対象を含める。読み込み済みのphoto URL/canvas/thumbnail cacheはprofile切替/削除/unmountで解放する。

移行テストはv7実schemaの既存学習/profile/島/予約/workshop/receiptの代表行を準備してv8で開き、内容不変・写真store空・新規写真保存可能を確認する。v8作成後のrollbackはv8を理解するbuildで入口を無効化し、v7しか知らない旧buildへのdowngradeやDB削除を手順にしない。[schema migration runbook](../runbooks/schema-migration.md)に従う。

展示と依頼は現在のIslandStageの単一renderer/groupへ統合する。既存住民を一時的に借りる場合はtransform/visibility/共有姿勢/歩行の所有権を戻す。通常暮らしと依頼controllerの二重制御を防ぐ。物の当たり判定、接点、光の到達点、撮影boundsは同じgeometryから導き、診断用宣言だけを別に作らない。写真一覧のために3D rendererを枚数分作らない。

## 9. 受入条件

| ID | 合格に必要な実操作と証拠 |
|---|---|
| M01 得意仕事の違い | 同じ標本へカワウソ/ウサギ/キツネを明示選択。source→手→目的地の運搬、3枚を集めて配置、ランプ→同物→結果を実frameで確認。どの住民でも同じ運搬にしない |
| M02 同一物と接触 | 物/盆/手/台のworld anchorと画面上の接触を確認。住民の顔/手足/対象が390pxと768pxで見える。経路不成立は安全に戻り、家具/他住民/水へ貫通しない |
| M03 可視完了と中断 | 歩行、持上げ、運搬、花びら2枚目、光が届く前、お返しの各途中で停止/背景化/学習。未表示結果は未記録、確定済み結果は保持、標本/作品/前展示が消えない。reloadはpreparedを明示再開し自動演技しない |
| M04 覚えてくれる | 依頼完了→reload→同じresident/targetの記憶から再訪し、実住民が同じ対象を見て仕事に対応する反応。再演でfirstAt/order/件数不変。名前変更後も当時の名前/対象snapshotは保持 |
| M05 記憶の有限性 | 12件の満杯、同じmemoryKey再演、13件目の新結果、棚から明示削除、残っているresult-seenから保存を試す。実仕事は可能、無断の最古削除/偽の保存成功/学習加算なし |
| M06 主島への展示 | 3標本を主島3枠へ置く、枠移動、収納、別標本への置換と取消、名札変更。主島ホーム/見学/全景写真に実物があり、入江から同じ個体へ戻る。未判明の正体を展示で明かさない |
| M07 Aを残してBを作る | 作品Aを保存→展示→共同記憶→同保存枠をBで上書き→Bのdraftを編集中にA展示へ再訪。Aの実接続順/停止点が再演され、Bのdraft/undo/保存枠不変。元slot削除後もA展示/記憶は再演可能 |
| M08 占有と既存成長 | 家具と展示の双方向衝突、作業盆/経路、全成熟/未成熟、展示中の次成長、古いE6配置適用を確認。基本7家具/土地/成長を失わず、衝突時に部分適用/無断収納しない |
| M09 写真の実像 | 全景/展示/仲間の3構図を同一rendererから撮影し、写真と撮影直前の実frameを比較。別theme/名/衣装へ変えた後も当時の画素を保持。写真棚→拡大→PNG→削除で関係/標本/作品不変 |
| M10 写真保存の境界 | 12枚/合計bytes/full/quota/変換失敗/native abort/commit応答欠落/retry/保存後削除後の旧retry。metadataとBlobの片残りなし。photoId/digest不変、重複/復活/自動削除なし。学習tableに画像bytesが入らない |
| M11 profileとoffline | A撮影中にBへ切替、A削除中の遅延callback、別tabのA/B、実SW offline再起動、v7→v8 migration。画像/URL/対象/記憶が別profileへ混ざらず、旧データ保持。profile削除が写真3storeまでatomic |
| M12 学習非阻害 | 各仕事/展示preview/再演/撮影変換/写真閲覧の途中から同じ通常planner予約へ復帰して回答。自由操作前後で学習全table、既存予約、成長、ほしが不変。通常連問の追加操作0、正式入力P95/throughput、支援/独力/復習基準を独立確認 |
| M13 資源と3ゲート | 音off/reduced/背景/反復往復で音・controller・object URL・rendererが増えない。同一固定target/revision/flag/candidate/cacheのcritical-path contact sheetで、視覚的魅力、意味/安全、runtimeを別判定。コード/テスト合格で弱い実画面を相殺しない |

M01〜M13は実装後の受入責任であり、文書の完成チェックではない。参加者N=0の場合、子どもの無説明理解・愛着・自発的再遊びは未検証と明記する。

## 10. 関連仕様と実装責任

- 本仕様: 採用済みの契約を実装・検証し、残る受入項目を全体タスクで追跡する。
- 親仕様01/島28/体験36/入江37: F01/F02の入口、主島の展示と既存配置/成長、work snapshot再訪の責務を接続する。
- 保存13/移行runbook/検証matrix: v8写真store、profile削除、画像を含まない学習writer、native migration/abort/offlineの検査を接続する。
- 全体対応表/残る差分/親タスク: F01/F02にM01〜M13の実装根拠を追記し、F03/F04/F05と16報酬/24比較の未充足を保持する。
- 仕様の採用と実装・実画面合格を区別する。実装ファイルとタスクqueueの所有分担は親担当が管理する。

## Verification

草案作成では現domain/repository/DB/runtimeと仕様36/37を読み、安定ID・snapshot・有限数・削除・学習境界を照合した。`npm run docs:check` PASS（他の既存文書のReview By警告のみ）、本文の全ローカル参照、M01〜M13の連番、担当文書の空白差分を確認した。アプリ実装やM01〜M13の実行は本草案作成の範囲に含まれず、未実施として残す。
