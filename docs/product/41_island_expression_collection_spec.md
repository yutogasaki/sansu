# いつでも選び直せる身支度と、見つけた物の小さなコレクション

Date: 2026-09-08

Status: **採用・実装と検証は進行中。** この仕様の採用は、価格の妥当性、実装完了、実画面の魅力、子どもの再遊びの合格を意味しない。

親は[01](01_app_spec.md)。既存の無料設定と全景保存は[36](36_island_experience_spec.md)・[39](39_island_appearance_sets_spec.md)、観察と制作は[37](37_island_workshop_spec.md)、写真は[38](38_island_shared_memories_spec.md)、家具の暮らしは[40](40_island_life_furniture_spec.md)を前提にする。[追加報酬分析](../wiki/reward-customization-benchmark.md)のR09衣装・R10模様・R12足跡・R13音・R14アルバム装飾・R15旗と、[残差監査](../tasks/active/2026-09-08-island-experience-remaining-audit.md)末尾のF05候補を具体化する。元資料の分析事実と、以下のSansuの採用設計を区別する。

## 1. 目的と範囲

好きな姿を実物で試す → 自分で取得する → 好きな仲間や景色に使う → 観察した出来事を思い出す → 保存した景色からまた選び直す、を任意の遊びとしてつなぐ。

衣装は住民本人の身支度、模様はその子を見分ける小さな印、足跡は実際に歩いた所へ残る短い表情、音は実演を見た記憶、表紙や旗は自分の島を見せる外装とする。取得数や残高を増やすことだけで用途を代替しない。

通常の入力、連問、予約、ヒント、お手本、復習、習得判定、基本成長は維持する。試用・取得・装備・写真・全景保存を学習開始や次の問題の必須操作にしない。音off、中断、支援、誤答によって取得資格や外見を劣らせず、成果を没収しない。

## 2. 最初の10取得品と無料の選択

商品IDは以下の有限集合とし、追加する時はカタログ、保存版、表示と受入を一緒に見直す。既存の12部位の外見カタログへ異なる権利を混ぜず、専用の `ISLAND_EXPRESSION_CATALOG` を設ける。通貨は既存のほしだけを使う。

| stable itemId | 表示名 | 対象 | ほし | 取得資格と取得後の用途 |
|---|---|---|---:|---|
| raincoat | あまがっぱ | 衣装 | 25 | 常設。住民の肩と胴を覆う布、開いた顔まわりで雨支度を表す |
| star-beret | ほしの ベレー | 衣装 | 20 | 常設。星の縫い飾りと柔らかい帽子の輪郭を、本人の頭に付ける |
| river-check | みずべチェック | 模様 | 10 | 常設。水色と濃淡のチェックを、本人の身支度の小さな布片へ付ける |
| butterfly-stitch | ちょうの ぬいめ | 模様 | 0 | 保存済み `ribbon-butterfly` 観察。蝶を見た記憶を縫い模様として使う |
| leaf-trail | はっぱの あしあと | 足跡 | 10 | 常設。歩いた接地点に少数の葉形を短く残す |
| water-ring-trail | みずの わ | 足跡 | 15 | 常設。歩いた接地点に小さな水輪を短く出す |
| shell-three-notes | かいの みっつの おと | 収集音 | 0 | 保存済みbellの `observe-creation`。工作で見届けた三音の短い音景を選ぶ |
| leaf-album-cover | はっぱの ひょうし | アルバム表紙 | 5 | 常設。写真棚の表紙と外周を葉の装丁にする |
| butterfly-stamp | ちょうの スタンプ | アルバム印 | 0 | 保存済み `ribbon-butterfly` 観察。写真の外側の余白へ小さな印を付ける |
| leaf-bird-flag-trim | ことりの はたかざり | 旗飾り | 0 | 保存済み `leaf-bird` 観察。既存の旗の縁へ葉鳥の飾りを添える |

6有料品の合計は85ほし、4品は観察資格による0ほしの明示取得。価格は既存の小品・部位・家具と選択を作る**初期仮説で未検証**。獲得倍率、所要日数、意欲への効果をここから断定しない。各商品はprofileごとに一度だけ所有し、衣装・模様・足跡は一度の取得で登場済みの全3住民へ繰り返し使える。住民別の再購入、消耗、維持費、抽選、追加課金はない。

朝 `morning`・昼 `day`・夕 `evening` と、春 `spring`・夏 `summer`・秋 `autumn`・冬 `winter` は別の無料設定で、取得品数には含めない。それぞれ「いつもの けしき」へ戻せる。実時計、曜日、季節、連続日数、抽選、期間限定によって選択を閉じない。時計変更・reload・offlineで選択を回したり権利を失ったりしない。

既存の無料衣装 `original / scarf / cap`、音 `off / breeze / brook / evening`、旗の印 `leaf / star / flower / wave` は同じ意味で残す。追加品を持っていなくても、従来の名前・衣装・音・旗・全景を使える。

## 3. 資格・試用・取得・装備を分ける

資格の正本は、現在のprofileに保存済みの `growth.discoveries` と `workshop.creations`。蝶と葉鳥は該当discovery ID、音は `partId === 'bell'` の検証済みcreation記録を照合する。旧版で保存した観察も資格になり、もう一度の遭遇、学習、制作を強制しない。

来訪候補、未保存の演技通知、図鑑を開く操作、bell部品の所有・組立・配置、未完了の水路、音を聞くボタンだけでは資格にならない。bellは仕様37の実可視到達後の保存を使い、音offで実演を見届けた記録も同じ資格とする。観察記録を新しい資格tableへ複製せず、取得時に正本を読む。取得後の所有は専用の所有配列に残り、装備を外しても資格と所有は消えない。

未所持・資格未達でも無料で試せる。住民の試着は本人が選んだ登場済み住民を同じ実rigの近景で示す。全景、足跡の歩行、音、旗、アルバム外装も取得後と同じ実装で試す。模様・足跡を試すために既存の家具や展示を移動しない。試用で新しい観察や共有記憶、学習実績を保存しない。

画面は「無料の設定」「ほしで取得」「観察済みなら0ほしで取得」「所持済み」を区別する。価格、残高、不足数、未達条件を示し、資格だけで自動取得・自動装備しない。「25ほしで もらう」「みつけた しるしを もらう」等の明示取得を保存してから、別の「このこに つける」「この おとに する」で装備する。取得の保存完了だけで現在の景色や音を切り替えない。

一度に試すのは選択した一つの商品または一つの無料設定で、保存済み状態との差を見せる。衣装・模様・足跡などを順次確定して組み合わせられる。41では複数の未確定商品をまとめて買う操作を設けない。取消・閉じる・学習開始・profile変更・背景化は未確定の試用を破棄する。未知結果の保存意図まで取消して未保存と決めつけない。

## 4. 保存モデルと具体的なAPI案

`IslandRecord.schemaVersion: 1` とDB v8を保ち、optionalな `IslandRecord.expression?: IslandExpressionState` を追加する。表記上の型別名は上表のstable IDに一致させる。

```ts
type IslandExpressionOutfitId = 'raincoat' | 'star-beret';
type IslandExpressionPatternId = 'river-check' | 'butterfly-stitch';
type IslandExpressionTrailId = 'leaf-trail' | 'water-ring-trail';
type IslandExpressionSoundId = 'shell-three-notes';
type IslandExpressionCoverId = 'leaf-album-cover';
type IslandExpressionStampId = 'butterfly-stamp';
type IslandExpressionFlagTrimId = 'leaf-bird-flag-trim';
type IslandExpressionItemId = IslandExpressionOutfitId
  | IslandExpressionPatternId | IslandExpressionTrailId
  | IslandExpressionSoundId | IslandExpressionCoverId
  | IslandExpressionStampId | IslandExpressionFlagTrimId;
type IslandDayPeriod = 'morning' | 'day' | 'evening';
type IslandSeason = 'spring' | 'summer' | 'autumn' | 'winter';

interface IslandExpressionSelection {
  version: 1;
  residents: Record<IslandResidentId, {
    outfit: IslandExpressionOutfitId | null;
    pattern: IslandExpressionPatternId | null;
    trail: IslandExpressionTrailId | null;
  }>;
  soundscape: IslandExpressionSoundId | null;
  environment: { period: IslandDayPeriod | null; season: IslandSeason | null };
  album: { cover: IslandExpressionCoverId | null; stamp: IslandExpressionStampId | null };
  flagTrim: IslandExpressionFlagTrimId | null;
}

interface IslandExpressionState {
  version: 1;
  ownedItemIds: IslandExpressionItemId[];
  selection: IslandExpressionSelection;
}
```

`expression`省略は「所有なし、全selectionはnull」を読み取り時だけ解決する。衣装nullは既存 `experience.residents[id].look`、収集音nullは既存 `experience.ambience` を使う。他のnullは追加なしで、朝夕・季節nullは現在の外見styleの従来描画をそのまま使う。古い夜空テーマを起動時に昼へ変えない。defaultの読み取り、通常の学習writer、観察資格の成立でこの拡張を勝手に永続化しない。

存在するstateは全キーと全3住民を必須にし、余分なキー、未知version/ID、誤ったslotのID、重複所有、10件超、穴あき配列を拒否する。所有配列はカタログ順のcanonical値で保存する。装備した非nullのIDはすべて同profileの所有に含まれることを検査する。clone・比較関数も全selectionを扱い、不正な保存を既定値へ直して上書きしない。朝夕/季節に所有検査や残高減算を付けない。

専用操作は次の判別unionとし、callerの任意state・価格・資格boolean・所有配列・snapshotを受け取らない。

```ts
type IslandExpressionEquipAction =
  | { type: 'equip-outfit'; residentId: IslandResidentId; itemId: IslandExpressionOutfitId | null }
  | { type: 'equip-pattern'; residentId: IslandResidentId; itemId: IslandExpressionPatternId | null }
  | { type: 'equip-trail'; residentId: IslandResidentId; itemId: IslandExpressionTrailId | null }
  | { type: 'equip-soundscape'; itemId: IslandExpressionSoundId | null }
  | { type: 'equip-album-cover'; itemId: IslandExpressionCoverId | null }
  | { type: 'equip-album-stamp'; itemId: IslandExpressionStampId | null }
  | { type: 'equip-flag-trim'; itemId: IslandExpressionFlagTrimId | null }
  | { type: 'period'; period: IslandDayPeriod | null }
  | { type: 'season'; season: IslandSeason | null };
type IslandExpressionAction = IslandExpressionEquipAction
  | { type: 'acquire'; itemId: IslandExpressionItemId };
interface IslandExpressionPreview {
  action: IslandExpressionEquipAction;
  selection: IslandExpressionSelection;
}

declare function getIslandExpression(island: IslandRecord): IslandExpressionState;
declare function hasValidIslandExpression(island: IslandRecord): boolean;
declare function canonicalIslandExpressionAction(value: unknown): IslandExpressionAction;
declare function getIslandExpressionEligibility(island: IslandRecord, itemId: IslandExpressionItemId):
  { eligible: boolean; reason?: 'ribbon-butterfly' | 'bell' | 'leaf-bird' };
declare function reduceIslandExpression(island: IslandRecord, action: IslandExpressionAction): IslandRecord;
declare function previewIslandExpression(island: IslandRecord, action: IslandExpressionEquipAction): IslandExpressionPreview;
// databaseの省略時は既存のdbを使用する。
declare function saveIslandExpression(profileId: string, expectedRevision: number,
  action: IslandExpressionAction, database?: typeof db): Promise<IslandRecord>;
```

`IslandExpressionPreview` は描画用の仮selectionと対象actionを返す別型とし、未所持品を装備した仮 `IslandRecord` を保存可能な正本として返さない。previewと装備は同じ純粋な選択変更関数・描画resolverを使い、preview入口だけで所有制約を免除する。未知IDやslot不一致はpreviewでも拒否する。保存writerへpreview objectを渡すAPIを設けない。

## 5. 既存の無料衣装・音との互換操作

現 `experience.residents[id]` はstrictな `{ name, look }` で、既存 `resident` actionはそのobject全体を置換している。追加模様などをこのobjectへ足さず、既存のenumも有料品を含む型へ曖昧に広げない。

既存experience writerへ `resident-name { residentId, name }` と `resident-look { residentId, look }` の細いactionを追加する。名前欄はname-only、無料衣装のボタンはlook-onlyへ接続する。既存のcombined `resident { residentId, name, look }` は互換として受理し、その明示lookを選択として扱う。過去receiptのactionを新しい形へ書き換えない。

| 明示操作 | 同じ純粋reducer・transactionで起こすこと |
|---|---|
| 追加衣装を装備 | 対象のexpression.outfitだけを設定。既存lookは外した時の戻り先として保持 |
| 無料lookを選択 | 対象のexperience.lookを設定し、expression.outfitをnullにする。元lookと同じ値でも省略しない |
| 名前だけ変更 | nameだけ変更し、look・追加衣装・模様・足跡を保持 |
| 旧combined resident操作 | name/lookをその意図通り更新し、対象の追加outfitをnullにする。模様と足跡は保持 |
| 追加衣装を外す | outfitをnullにし、保存されている無料lookを実際に表示 |
| 収集音を装備 | soundscapeを設定。無料ambienceは戻り先として保持し、音源の実効選択は収集音になる |
| 既存ambienceを選択 | ambienceを設定し、soundscapeをnullにする。offや以前と同じ値の選び直しでも必ず反映 |
| 収集音を外す | soundscapeをnullにして無料ambienceへ戻す |
| 既存の旗印を選択 | emblemを変更し、独立した旗飾りは保持。旗飾りは専用の外す操作でnullにする |

expressionが省略されていて消す対象がない場合、無料設定の保存だけでexpressionをmaterializeしない。追加衣装の解除や収集音の解除を、画面側の後続callbackや別writerに分けない。保存失敗で半分だけ変わる設計にしない。

表示上の選択状態は実効look/音を使う。追加衣装中に戻り先の無料capを「いま着ている」と表示せず、追加音中に戻り先のoffを「現在無音」と表示しない。profile全体の `soundEnabled === false` はすべての島音を止めるが、取得・装備選択を消さない。既存音offの明示選択は上表の通り追加音も解除する。

## 6. transaction・再送・画面退出

専用writerは既存 `islandTables`、所有profile検査、PWAの保存hold、共通writer lockを使う。別通貨、別所有table、学習profileへの配列は作らない。保存済み学習区間からのほし加算は既存契約のままにし、この機能から加算しない。

`['island-expression-v1', profileId, expectedRevision]` をreceipt IDとし、canonical actionを持つ `expression_changed` eventを既存islandEventsへ保存する。active profileと正本の検証後、**既存receiptとの完全一致をCAS・価格・資格判定より先に確認**する。同じreceiptなら現在の島を返し、取得・減算・装備・captureを再実行しない。異なるactionを同receiptで受け取ったら競合とする。

未処理の場合だけrevisionを照合し、acquireなら最新の資格・所有・残高を確認する。所有追加・必要数の減算・島revision/updatedAt・receiptは単一transactionで保存し、selectionは変えない。所持済みへの新規取得は `already-owned` として減算・新receiptを行わず装備へ案内する。equipは必要な所有だけを確認し、無料設定は残高を使わず保存する。既存財布の旧省略値の扱いも再利用し、互換残高を重ねて付与しない。

domainの失敗は少なくとも `invalid-state / unknown-action / not-owned / not-eligible / insufficient-stars / already-owned` を区別し、所有profile・known CASの失敗は既存repositoryの型を保持する。未分類のI/Oをknown CASと決めつけない。

native abortでは全tableが操作前と一致する。commit成功後の応答欠落は結果不明と表示し、元revision・canonical actionを保持する。別actionでpendingを上書きせず、明示retryで同じ意図を再送する。known CASだけは最新状態を読み、古い意図を自動で新revisionへ付け替えず本人が再選択する。

既存experienceのreceipt先照合も保持する。例として、無料capの保存成功後に合羽を装備した島へ古いcap保存の通知欠落retryが来ても、元receiptを返すだけで合羽を再び外さない。取得の古いretryから、その後に変えた装備を再適用することもない。

hookはprofile所有とactive/hidden/退出の世代を確認し、学習予約の保存待ちに入る時点で試用・音・新規writer開始を止める。開始済みtransactionはatomicに完了させるが、遅い成功から退出後の試着・演奏・別画面への遷移を始めない。保存結果の新しいisland/revisionは同profileの正本として即採用し、liveQueryの先着/後着や古いclosureで退行させない。元pendingのretry成功にも同じ規則を適用する。

## 7. 全景保存・旧snapshot・写真

既存3枠のsave/apply-layoutを使う。新しい保存は `IslandSavedSceneStyle` をv1/v2の判別unionへ拡張し、v2を生成する。

```ts
interface IslandSavedSceneStyleV2 {
  version: 2;
  residentLooks: Record<IslandResidentId, IslandResidentLook>;
  ambience: IslandAmbience;
  emblem: IslandEmblem;
  expression: IslandExpressionSelection;
}
```

保存するのは当時の確定済みの無料設定とexpression selection。所有、資格、残高、名前、写真棚、観察・作品・共有記憶、学習と成長をsnapshotに複製して巻き戻さない。アルバム外装は表示設定として含めるが、写真行や写真の並びを含めない。39の解決済み12部位・飾り・poseも同じ保存に残す。未確定のF03 mixやF05 previewをcaptureしない。

save-layoutのcallerは引き続きlayoutIdとnameだけを渡し、transaction内の現在の島からcaptureする。同receiptのretryは保存済みreceiptを先に見て返す。後の装備変更や別tab更新を、元の保存案へ再captureしない。保存したsceneStyleはdeep cloneし、rendererやpreviewから変更しない。

v2の試用と適用は同じ純粋reducerで、記録した全selectionをnullも含めて復元する。非nullの品が現在の所有にあること、全現在家具・後発取得・展示との衝突を確認し、失敗は全体拒否する。snapshot内の装備を使って未所持品の所有を増やさない。後から育った物や購入家具を消さず、現在の名前と所有を保ったまま再編集できる。

| 保存形式・用途 | 省略時と復元の規則 |
|---|---|
| sceneStyle自体がない旧配置案を現在へ適用 | 39の通り、現在の無料設定とF05選択を保持。古いcosmeticsの従来版描画の規則とは分ける |
| sceneStyle v1がある旧配置案を現在へ適用 | 記録済み無料look/ambience/emblemを復元する。無料look/音を有効にするため追加outfit/soundscapeを解除。v1にない独立した模様・足跡・朝夕・季節・外装は現在を保持 |
| sceneStyle v2の配置案を適用 | 記録した無料設定と全expression selectionを復元。所有・残高・資格は現在のまま |
| sceneStyleのない旧成長memoryを閲覧 | 従来の履歴rendererを維持し、現在のF05設定を注入しない。現在の島へ適用する操作とは別扱い |
| 新しい成長memoryを閲覧 | 有限の節目captureへoptionalなsceneStyle v2を追加し、当時の確定選択だけで描画する。現在の外見で補完しない |
| 保存済み写真を閲覧/出力 | 当時の画像bytesとメタデータを保持。現在の外装を写真画像へ焼き込まない |

v1の配置案は当時記録しなかったF05要素まで完全復元した証拠にはしない。新しい成長snapshotの追加で、島本体のexpression省略を初期化したり、通常の回答保存へ画像処理を入れたりしない。既存の初期/成長/拡張memoryの件数と学習上の意味は変えない。

写真の本体・thumbnail・sha256・寸法・撮影時刻・当時の島名/対象名は変更しない。葉表紙と蝶stampは写真カード外側の余白に描き、原画ダウンロードは元PNGのまま。装飾済み合成画像の別出力は今回追加しない。新しいカメラで撮った写真には、その撮影時の実rendererの衣装・旗・季節等が写る。未確定previewから確定済みの姿として写真保存する導線は設けない。

## 8. 実景・身体・音の受入契約

世界、近景、試用、装備、全景比較、写真は一つのrendererと同じモデルを使う。カタログ絵だけで実装を代替せず、無料/追加品の差をphone/tabletで示す。selectionの変更で同一住民のgroup、名前、身体のrig、成長、家具、展示、歩行経路の正本を置換しない。

追加衣装は独立した所有groupで切り替え、originalへ戻した時は追加衣装groupを確実に消す。既存rabbit/foxの身体に含まれる固定の衣装は従来通り保持する。帽子は目・耳・視線を隠さず、合羽は手と足を動かせる形にする。模様はbodyの可視な布片を使い、original/scarf/cap/raincoat/star-beretの全組合せで見える。服で覆う場合は同じ模様の布片を外側へ移し、消えた選択を保存成功扱いにしない。

歩行、座る、物を運ぶ、工作と住民の共同利用、望遠鏡・ハンモック・茶卓の接点で3住民を検証する。衣装を理由に接点をずらしたり、保存上の占有半径を超えたりしない。現在/試用の比較は同じ倍率で、帽子・耳を含む最大姿勢のboundsを収める。

足跡は実際の歩行中の足の接地から出し、frame数・架空の経路・停止中のtimerから生成しない。上限は1住民8片、全島24片、各片の寿命1.2秒以内とする初期制作契約。固定poolを再利用し、上限到達では古い片を再利用する。足を浮かせて運ばれる、座る、眠る時は発生させない。水輪は接地の視覚表現で、水の物理・床・衝突判定を変えない。

着座中に試歩を選んだ場合も同じ住民を借り、実際の支持面から離席して足が地面に着いてから歩く。座面・背板・肘掛けと身体の接触を保ち、初点を座面内の地面へ移す操作や家具の一括除外で貫通を隠さない。尾は通常の着座姿勢でも背板を跨がないように畳み、離席では同じ関節を動かす。離席中は接地印を出さず、取消は元の位置・身体各部の姿勢へ戻す。実座面ray、足裏座標、離席から接地の連続した実画面を検証し、診断のphase名だけを証拠にしない。

静止で新規発生を止め、残った片は寿命内で消す。学習開始、背景化、退出、profile変更で全片を即座に隠して解放する。reduced motionでは拡大波紋と移動補間を抑え、1住民2片以下の短い接地印で同じ意味を伝える。毎frameにmesh/material/textureを生成しない。preview歩行もこの上限を共有する。

朝夕は環境の光と空の表情、季節は木・草・地面の少量の色や素材の表情へ作用する。解決済み12slotの形・配色の識別、成長段階、F04接点、水の浮沈/透過・歩行可能領域を保つ。冬でも地形を氷の床に変えず、季節選択を自然観察の資格や出現抽選に使わない。組合せごとの見え方を同じ純粋resolverで決め、実時計や未保存乱数を読むfallbackを作らない。

収集音は既存の単一の島環境音エンジンを拡張する。`shell-three-notes` が未知enumの分岐でevening音へ落ちないよう、実際に区別できる三音の音源を持つ。短い試聴は明示gestureから一回の三音句を鳴らし、装備時の音景も同じ音色を使う。音景中の句は重ねず、間隔12秒以上、同時発音3声以内、1句2秒以内を初期制作上限とする。細かな音量・間隔の良さは実聴で別判定する。

初回WebAudioの起動はtrusted pointer/key gestureへ結び、blocked時に表示だけplayingへ進めない。音off、学習開始、hidden、退出、profile変更でtimer・voice・nodeと遅いstartの世代を止める。背景復帰時に過去の試聴を再生しない。装備済み音景の再開は現在profile・active・soundEnabledとgesture解放状態を確認する。学習の声や問題音のcontextを工作/環境音側から止めない。無音でも観察資格、商品、装備中/解除の状態が分かる。

旗飾りは既存の印と島名を隠さず、既存の家まわりの表示領域で納める。『はたの かざり』を選ぶと、同じ実旗・旗印・鳥飾り・島名札が入る近景へ切り替え、『しま全体を みる／はたを みる』で往復できる。現在・未所持試用・試用取消・装備・取り外しで画角と倍率は固定し、装備の有無で自動拡大しない。既定の無料の旗印と島名札が通常非表示の旧履歴では、この近景中だけ同じ実模型を表示し、近景解除で元の可視状態へ戻す。別商品・画面退出・学習開始で焦点を解除し、帽子等の住民近景へ持ち越さない。これは保存も報酬取得も発見も伴わない閲覧操作であり、実画面でphoneの鳥の輪郭と旗印、島名札を確認するまで視覚合格にしない。

鳥飾りは同じGroup・形状を使い、屋根の外に出る旗の自由端の上寄りへ短い紐で付ける。紐の上端は実際の旗布の自由端へ、下端は鳥の葉の胴へ接続し、旧/newの星の家のドームや成熟時の小屋根へ埋めない。旗布・旗印・島名札の位置や外見、家と歩行領域をこの修正で動かさない。旗近景の無料試用表示は同じ文言・文字サイズを右上の小幅に納め、左側の実旗を覆わない。全景や他商品の試用表示は従来の幅を維持する。

アルバム外装は写真の焦点と操作面を覆わない。音・旗・模様・足跡に付随する資源は所有元で破棄し、何度試用・退出しても増え続けない。

## 9. 依存方向と実装責任の案

現sourceでは `workshop.ts → experience.ts` が名前正規化のruntime importであり、`growth.ts → catalog` と `experience.ts → catalog` もある。expressionからworkshop/growthのvalidatorを呼び戻し、経験設定からexpressionへ依存すると循環を作りやすい。資格は全島の正当性をrepository境界で検証した後、正本の該当配列を純粋に読む。expression内部から `assertIsland` を再帰呼出ししない。

| 責任候補 | 境界 |
|---|---|
| 新 `residentIdentity.ts` | 既存の住民ID/無料look/音/旗の定数と型だけを依存のない末端へ移す。experienceからの既存exportは再exportで維持し、二重の定数表を作らない |
| 新 `expression.ts` | 有限カタログ、state/selection、strict検証、clone、資格の純粋読取、canonical、取得/装備/preview。identityと既存財布を利用し、experience/workshop/growth/repositoryをruntime importしない |
| 新 `sceneStyle.ts` | v1/v2型・検証・clone・capture。identityとexpressionの下位関数を使い、experience/growthはtype-only参照か狭い入力形だけで受ける |
| experienceとgrowth | sceneStyleの共通関数を呼ぶ側。experienceは無料設定の解除規則と全景apply、growthは有限節目の読み取りcaptureを担当 |
| 新 `expressionRepository.ts` / 既存repository・types | 所有profile、receipt先照合、CAS、atomic保存、event/typeの狭い追加。DB store/indexは増やさない |
| 専用hook・既存experience UI・Page | exact pending、free name/look操作、実効選択表示、previewと確定の分離、同じ学習へ戻る取消 |
| 既存renderer・音engine・写真/全景表示 | 単一rig/scene、選択resolver、有限pool、資源解放、旧snapshotと写真の表示契約 |

型のimportだけで済む依存は `import type` にする。上記は責任分割の案であり、実装担当を自動的に割り当てるものではない。検証、比較、clone、receiptのいずれかだけが旧型のまま残る部分導入をしない。未知fieldを理解しない旧buildへのdowngradeやfield削除を回復策にしない。

## 10. 受入と未検証の扱い

| ID | 必須の受入 |
|---|---|
| X01 | 10品のID/slot/価格、85ほし合計、6有料/4資格品、全3住民共通の所有、無料設定維持。通常学習からの既存獲得方式を保持 |
| X02 | 旧保存済み蝶/葉鳥/bellが資格になる。候補・未保存演技・部品配置だけは不可。音offのbell記録は可。資格だけで全DB不変、取得/装備は別々 |
| X03 | 全10品の未所持preview・取消・退出・学習/hiddenで全table不変。実模型/音/外装を示し、試用から発見や共同記憶を加算しない |
| X04 | 通常の実回答でほしを得て、明示取得→未装備保持→明示装備→外す→無料へ戻す→再装備。3住民の無料3look＋追加2look、模様との組合せを確認 |
| X05 | 合羽→改名で合羽保持、合羽→以前と同じ無料capで実際にcap、収集音→以前と同じoffで無音、収集音→無料3音で各実音。旧combined actionと保存失敗も同じ意味 |
| X06 | strict keys/未知版/誤slot/未所持装備/重複所有を拒否。省略旧stateの読むだけ/通常writerでmaterializeなし。他profileと現残高/旧receiptを保持 |
| X07 | native abortの全table rollback、commit応答欠落の同receipt retry、取得と別機能購入の同revision競合。二重減算なし、別意図の自動再送なし。無料cap保存→合羽装備→古いcap receipt retryで合羽保持 |
| X08 | liveQuery先着・古い通知後着・profile退出・hidden→foreground・学習待ち中の遅い成功。新しい正本は退行せず、古いUI演技を開始しない |
| X09 | 新v2全景の保存→装備を変更→preview取消→適用→再編集。未確定mix混入なし、同receipt再送で再captureなし、後発成長/家具/展示と衝突は全体拒否 |
| X10 | sceneStyleなし/v1/v2、旧/新成長memoryの表の省略規則。所有/名前/資格非巻戻し。写真とthumbnailの全bytes/sha/当時メタデータ不変、元PNG出力一致 |
| X11 | 朝昼夕×4季節と既定復帰、時計変更/reload/実SW offlineで選択・資格・残高保持。12slotの見分けと水/成長/通路/家具接点は不変 |
| X12 | 全3住民の実歩行・各姿勢・F04全3家具で顔/耳/手足/支持/受渡しを保持。足跡pool・音声上限、停止、reduced、反復previewで資源が増えない |
| X13 | 各入口から同じ予約の通常入力へ戻り、追加必須操作0、支援同額、学習全tableの意味を維持。通常入力速度は既存の正式検査で別に判定 |
| X14 | 同じsource/build/flag/candidateのphone 390×844・tablet 768×1024で変更前後のPNG、必要な動作の連続場面、実音の証拠を残す。視覚、無説明理解/学習非阻害、runtimeを別判定 |

実装時の必須コマンドと統合検査は[検証matrix](../ai/verification_matrix.md)に従う。fixtureの資格・通貨・完成状態はfixtureと明記し、通常の実回答や実観察の証拠へ数えない。作者の目視・実聴、子どもの無説明理解、本人が欲しいと選ぶ/別日に再び使う観察は分ける。実参加者がいなければ後者は未検証のままにする。

2026-09-09に[35のカテゴリ横断目標](35_island_customization_spec.md)へ全10品を含む「ほしいもの」1件を採用する。0ほし4品は資格未達でも目標へ選べ、quoteは必要な保存済み観察/制作と充足を示す。資格成立だけでは自動取得・装備・目標解除をせず、対象を明示取得したtransactionでだけ目標を解除する。既存のきせかえ・道具目標との変更、旧receipt再送、無料の取消、学習非阻害は35の契約を共用する。

この案の10品でR09/R10/R12/R13/R14/R15の全可能性を網羅したとはしない。模様は有限の選択で自由描画ではなく、音は一つの収集音で任意BGMの持込みではない。カテゴリ横断目標は上記の採用範囲と実証状況を別途確認し、全報酬の別購入順、自然観察の視覚HOLD等の他の残差を、この文書の作成で解消済みにしない。採用後に親仕様・索引・対応表・必要runbookを親担当が接続し、実装/証拠を確認するまでF05およびGoal全体を完了にしない。
