# docs/product/10_exploration_game_spec.md — 探索ゲーム仕様

> 状態: gameplayの **MVP-0/1**、run保存の **MVP-2a**、Study共通planner / SRS接続の **MVP-2b**、version付きactive checkpointによるrun再開は **MVP-2c**、3 / 3 / 2問segment予約は **MVP-2d**、rapid-loop適格性と全source解放guardは **MVP-2e** を実装済み。1ラン8行動・15ノードを3問単位の連問区間として遊ぶ。production defaultは `classic-v1` とする。旧編み根版は50 / 100のREJECT、一本葉を引くBloom版と「3問で水やり」版はHOLDかつ非採用である。既存delivery / feature-flag ID `snap-root-v1` のlocal validationには、後続のしずく道と同じ横舞台へ統一したvisual candidate `dig-pop-carry-bloom-v3` を配線する。旧v2の採点と速度証拠は新候補へ継承せず、実配信targetの同一build証拠と無文字5人テストが終わるまでrelease Gate Cとproduction判定はHOLDとする。本格グリッド、道具、鉱脈連鎖、未確定素材の損失は将来案として区別する。

## 1. コンセプト

> 算数で掘り、未知を探し、欲張るか帰るかを決める。

舞台は暗い洞窟ではなく、明るい地底のふしぎ世界。水晶、光る植物、地底湖、花畑、化石、宝石、根っこのトンネル、秘密基地がある。敵を倒すことではなく、**道をひらく・発見する・持ち帰る**ことが目的。

Gate Cの固定10問比較だけは、8回答の実runを帰還・再出発した後に別runで2回答するDEV限定fixtureとする。これはproductionの1ラン8行動を10行動へ変更する仕様ではない。

## 2. ゲームの勝ち筋

このゲームは以下の感情を主目的にする。

| 感情 | 実装手段 |
|---|---|
| 楽しい操作 | 岩が割れる、道が開く、橋がつながる |
| 発見 | 掘った先に未知の空洞・化石・生き物が出る |
| 判断 | どの道へ行くか、いつ帰るか、素材を使うか |
| 運 | 岩の中身、鉱脈連鎖、レア地形 |
| 爽快感 | 連続正解、まとめ掘り、鉱脈解放 |
| ギリギリ | 残りエネルギーで帰れるか |
| 物語 | 「欲張ったら橋が壊れた」「最後に虹水晶が出た」 |

## 3. プレイヤーアクション

### 3.1 掘る

固定cold-openだけは、選択を反映できない行き先カードを出さず、0タップで最初の問題へ入る。3問完了後の区間境界では隣接する岩・土・水晶壁を選び、以後は原則3問を追加操作なしで連続出題する。正解すると世界が動いたまま次問へ進み、不正解時は短いヒントの後すぐ同じ問題へ戻り、ゲーム上のボーナスに影響する。

連問中は問題が主役であり、通常発見、コンボ、保存成功、移動は背後の世界反応または非blocking toastとして同時進行する。明示的な続行操作で止めてよいのは、大発見、帰還、回復不能な保存エラーだけとする。

サクサク区間は「number入力なら何でも出す」面ではない。新規予約時にrapid-loopへ適さないDue、4桁入力、筆算、高認知負荷問題はStudyまたは将来のじっくり遭遇へ残し、その場で消化済みに見せない。候補除外を説明modalや追加tapにはせず、別のrapid-safe game-only問題で連問を継続する。

#### 8問ランの報酬グラフ

```text
Q1〜3  cold-open（調査ページ進行なし、追加停止なし）
  └─ Q3後  道を選ぶ
Q4〜6  選んだ道で主調査の手掛かり3件（non-blocking）
Q7     3手掛かりをつなぐfinale → 大発見1件（blocking peak）
Q8     最後の標本 → 「基地へ もちかえる」（primary）
帰還    今回進めた主調査1冊 → 実在する再出発操作
```

- cold-openの正解で通常標本は生成してよいが、主調査ページやlegacy図鑑ページへ特徴を付与しない。旧保存IDは既存snapshotの再読にだけ使う
- Q4〜6で現行主調査の3手掛かりを順に開き、receipt確定済みのQ7 finaleだけが最終特徴を開く。対応skillなら登録済み専用遭遇の動作と観察provenanceを付け、非対応skillなら中立のページpayoffへ戻す。正答数や希少度だけで大発見にしない
- 通常標本と調査ページ外のレア標本は約900msのnon-blocking toastとする。希少度は見た目の強弱には使えるが、入力を止める権限にはしない
- Q8後に進めるnodeがない場合、補助的な任意帰還ではなく「基地へ もちかえる」を唯一の主CTAとして表示する
- 成功終端は `8回答をreceipt確定済み` というrun roleで判定し、`available nodes = 0` だけから推論しない。Q8前の欠損edgeは大発見成功に見せず、発見を保持したまま基地へ戻す回復状態にする。逆に8回答後は誤った余剰edgeがあってもQ9へ自動進行しない
- 全問足し算の固定10問fixtureではroot-tangleを偽装せず、Q7は中立のページpayoffとする。操作中断を `Q3 route / Q7 big-discovery / Q8 return / replay` の4件へ固定し、root固有の観察provenanceは実plannerが対応引き算を割り当てるroot-tangle E2Eで別に通す。2回目のrunのQ9〜10へ前runのdialog、world reaction、調査進捗を残さない

#### 最初の3問: cold-open価値契約

現行ランの深度1〜3は、同じカメラ、同じactor、同じ対象、同じ身体規則を保ったまま問題を続ける導入区間とする。固有キャラクターを先に決めるのではなく、次の体験順を正とする。

```text
解く → 即世界反応
解く → 同じ規則が一段大きくなる
解く → 予想外だが因果の読める身体オチ
```

- stageはcommit済み正解数 `0 / 1 / 2 / 3` だけから決める。式の答え、演算、`Problem.categoryId`、planner assignment、SRS状態を身体変化へ使わない
- 誤答ではstageとカメラを維持し、550ms以内を目標に同じ問題へ戻す
- 1・2問目は問題UIを隠さず、追加0タップ・正解から650ms以内で次問を操作可能にする。世界反応と次問準備は同時進行させる
- 3問目だけ、同じ身体規則を拡大したオチを読ませる区切りを置いてよい。ただし光、紙吹雪、巨大文字、説明文だけをオチの代わりにしない。オチ自体で原因と結果が読める場合、同じ静止画を別モーダルで繰り返したり、説明用の「つぎへ」を追加したりしない
- 対象の数、大きさ、並び、ゲージなどから問題の正答を推測できるanswer leakを作らない
- `snap-root-v1` slotのlocal validationへ載せる現行visual candidate `dig-pop-carry-bloom-v3` は、スコップを持つ葉帽子のポッコ、土へ半分埋まった大きな根生物を、後続調査と同じ横camera・シアン・黄土・葉緑・コーラルの色面へ置き、`ready → dig-one → dig-two → popped` の3問で完結する。ポッコは根生物の身体や葉を引かず、中央の同じ土だけを掘る。正解ごとに一つの土塊が飛び、同じ根生物が持ち上がり、両足が見える。3問目は根生物が全身でぽんと抜け、ポッコが安全に尻もちをつき、柔らかい土塊が葉帽子へ載る。payoff variantは持たず、問題値や演算から見た目を選ばない。旧v2の合格点を継承せず、残る非補償ゲートが通るまでproductionへ昇格しない
- 1・2問目で生成されるopening途中の発見は保存してもtoastを出さない。問題と身体変化を同時に読ませ、3問目も説明modalや追加CTAを挟まず次の意味ある道選択へ進める
- production defaultは `classic-v1` とする。旧編み根版Snap Rootは実機画像による子どもの安全・無文字理解・身体完全性の再監査で50 / 100のREJECTとし、87〜88点を失効させる。一本葉を引くBloom版と水やり版は同じ `snap-root-v1` slotの旧visual candidateとしてHOLDかつ非採用とする。`dig-pop-painted-v1` はsource art 50 / 60のHOLD、`dig-pop-painted-v2` は後続画面と役者・縦横構図が分裂した旧runtime候補、`dig-pop-carry-bloom-v3` はlocal validation candidate、`root-pull-v1` / `root-pull-v2` は比較用presentation、既存の専用遭遇 `root-tangle` は別契約とする。いずれの固有名やlegacy保存IDも `snap-root-v1` の図鑑登録へ流用せず、delivery IDとvisual candidate IDを別々に記録する
- 深度1〜3は通常の `dig` ノードと正解コスト1を使う。後続の橋の見た目や追加コストをcold-openで隠さない

岩タイプ:

| タイプ | 予告 | 中身傾向 | 役割 |
|---|---|---|---|
| やわらかい土 | ふつう | 小素材、道 | 安全な進行 |
| 水晶岩 | きらきら | 水晶、鉱脈 | 報酬と連鎖 |
| 化石岩 | 骨ではなく貝・葉型 | 化石、図鑑 | 発見 |
| 根っこ壁 | 緑の根 | 橋素材、抜け道 | ルート拡張 |
| なぞの壁 | ？ | イベント、空洞 | 驚き |
| 虹岩 | レア光 | レア発見 | 高揚 |

### 3.2 進む

掘った先に進む。正式版では奥に進むほどレア発見を増やし、帰還距離との判断を強める。MVP-0/1は地形ごとの発見傾向と、残りエネルギーだけを予告する。

### 3.3 戻る / 帰還する

任意のタイミングで帰還できる。出口まで戻る、または帰還ボタンで探検を終える。正式版では「出口まで戻るほどボーナス増」を検討する。

### 3.4 橋を作る

地底湖・水路・裂け目に遭遇したときに発生する節目イベント。初期は固定選択式、将来は軽い配置パズルへ拡張。

MVP:

```text
小さな水路がある。
1. 木の橋をかける
2. ひかりの橋をつなぐ
3. 遠回りする
```

MVP-0/1の「ひかりの橋」は、左右の光を足し算で1つに合わせる縦切り遭遇とする。正解すると同じ地底湖シーンの中で光が合流し、橋が未完成から完成へ変わる。内部の報酬傾向と追加エネルギー消費は従来の石の飛び石プランを引き継ぐ。

専用遭遇は橋プランそのものではなく、プロフィール近傍で選ばれた問題と世界アクションの意味が一致するときだけ適用する。たとえば `ひかりの橋` は近傍候補に足し算がある場合に使い、対応できないレベルでは橋プランを維持したまま通常の橋ゲートへ安全に戻す。演出のために遠いレベルの演算を選ばない。

正式版:

- 板を置く
- ロープで補強する
- 浮き草で一時的に渡る
- 橋が揺れる
- 壊れても手前に戻るだけ

### 3.5 根っこのからまり

cold-openの3問と、ほたる花の通常手掛かり3件を終えた深度7へ、1ラン最大1回だけ決定的に置く引き算の縦切り遭遇。根を切る・壊すのではなく、引く数だけやさしくほどき、残りを見つけて花の抜け道を開く。

- `tangled → open → crossed` の `stateVariant` を同じ `cameraKey / viewBox / anchor` で切り替え、問題、開通、相棒の通過を見せる
- 3つの通常手掛かりがそろったrunでは、保存済みroot回答と同じnode / encounter / attemptに結び付く対応引き算だけがroot固有の観察画を開く。非対応skillでは通常問題と中立のQ7ページpayoffへ戻し、根をほどいたとは表現しない
- 観察画は `crossed` のcamera descriptor、主要輪郭、object positionを保ち、変化箇所だけへ紙・濃線の観察差分を重ねる。別構図や新しい大容量画像へ切り替えない
- 1回目の誤答では根が短く戻るだけにし、同じ問題と視覚ヒントを残す
- 専用表示は数量表現を保証できる `sub_tiny` と `sub_*_bridge` の明示スキルだけに使う
- 同レベルの引き算でも専用視覚表現がない場合は、難度を下げず通常rootゲートへ戻す
- 通常rootと同じ正解コスト1を使い、遭遇を見るための追加消費は課さない

### 3.6 遭遇の共通文法

専用遭遇は次の共通契約で追加する。

- `encounterId`: 表示とイベントを識別する安定ID
- `worldAction`: 合わせる、取り除く、分けるなど、算数の意味と一致する世界動詞
- `compatibleSkillIds`: 専用の数量表現まで保証できる明示スキル
- `compatibleSkillFamilies`: 将来、同一表現を安全に共有できる演算・概念
- `loading / ready / incorrect / correct / resolved`: 共通の表示フェーズ
- `correctHoldMs / revealDelayMs`: 原因と結果を読める最小の保持時間
- 対応不能時は通常問題へ戻る安全なfallback

遭遇追加のために探索ページ本体へ個別の状態機械を増やさず、domainの型付きレジストリとUI renderer登録を使う。

### 3.7 道具を使う

候補:

| 道具 | 効果 | 注意 |
|---|---|---|
| きらめきハンマー | 隣接1マスを追加でひらく | 問題スキップ扱いにしない。演出用マス限定も可 |
| ほたるライト | 次の2マスの中身傾向を見る | 判断を強める |
| ロープ草 | 一度だけ水路を渡る | 橋イベント用 |
| しるし石 | 帰り道を短縮 | ギリギリ判断を作る |
| シャボンバースト | 鉱脈をまとめて開く | 問題数バランスに注意 |

## 4. リソース

| リソース | 役割 | MVP |
|---|---|---|
| ひかり / エネルギー | 行動回数、探索継続 | 必須 |
| バッグ | 持ち帰り容量 | MVP後 |
| 橋素材 | 橋イベント | MVPは固定数で可 |
| コンボ | 連続正解の爽快感 | MVPは連鎖数表示だけ。報酬はMVP後 |
| 地図のかけら | 新エリア開放 | MVP後 |

### 4.1 エネルギー

- 掘る、橋を作る、特別行動で減る
- 通常問題は時間制限なし
- MVP-0/1の不正解はエネルギー -1、コンボ0。プレイテスト後にボーナス喪失方式との比較は可能
- 0になったら探検終了。怖い敗北ではなく「探検隊が迎えに来た」など明るく終える

## 5. 失敗設計

失敗はゲームを面白くするために入れる。ただし、子どもを傷つけない。

| 失敗 | 表現 | 損失 |
|---|---|---|
| 不正解（MVP） | 岩がぽよんと揺れ、ヒント模様が出る | エネルギー -1、コンボ0 |
| 橋失敗（将来） | ぷるぷるして戻される | 素材消費または遠回り |
| 欲張りすぎ（将来） | 迎えの気球で帰る | 未確定素材の一部減を検討中 |
| 帰還失敗 | 「今日はここまで。また行こう」 | 図鑑登録済みは保持 |

## 6. ランダムと発見

### 6.1 タイル別ドロップ

完全ランダムではなく、地形ごとに期待を持たせる。

| タイル | よく出る | たまに出る | レア |
|---|---|---|---|
| 土 | 石、道 | 小素材 | 迷子の生き物 |
| 水晶 | 水晶 | 鉱脈連鎖 | 虹水晶 |
| 化石 | 貝化石、葉化石 | 古い地図 | 大きな化石部屋 |
| 根っこ | ロープ草 | 抜け道 | 地底花畑 |
| なぞ | 空洞 | イベント | 秘密基地 |

### 6.2 鉱脈連鎖

水晶を掘ると、隣接する水晶が光ることがある。連続で掘るとボーナス。

```text
水晶を発見
→ 隣が光る
→ 連続で掘る
→ 3連鎖でシャボンバースト
```

### 6.3 大空洞

掘った先が突然広がる。暗い演出ではなく、ぱっと明るい発見演出。

候補:

- 地底花畑
- 水晶の森
- 星砂の浜辺
- 地底湖
- 光るきのこの道
- ひみつの研究小屋

### 6.4 調査ページと発見連鎖

完成形では、ばらばらの標本を毎問配るのではなく、1ランの主調査を1つの調査ページとして構成する。cold-openは最初の操作文法を教える3問完結の導入であり、深度4以降の主調査「ほたる花」とは進行を混ぜない。価値ゲートを通るまではcold-openを生態メモや図鑑ページとして保存せず、帰還時はそのランで最後に進めた主調査ページ1件を表示する。

```text
空白の調査ページ
→ 算数で世界へ働きかける
→ 生き物・現象の性質を1つ発見する
→ その性質が次の手掛かりを1件だけ生む
→ 複数の性質がつながる
→ 大発見でページに一区切りつく
```

Golden Discovery Page 縦切りでは、次を固定契約とする。

- catalog定義はrun内の一時IDと分離した安定 `pageId / featureId / chainId` を使う
- 1回の発見で開く特徴は1件。すでに開いた特徴を重複付与しない
- 調査ページの特徴と、道・橋プランに応じた標本報酬は別の意味を持つ。同じ行動で両方を得ても、特徴名で標本種別を上書きしない
- 次の未発見手掛かりは常に0件または1件だけ返す
- 最初の縦切りは、1ラン内の通常発見で開く3つの手掛かり特徴と、receipt確定済みのQ7 finaleで開く1つの大発見を持つ
- 最終特徴は、3つの前提手掛かりとQ7 finale roleがそろったときだけ開く。4件目の通常発見、正答数、希少度だけでは大発見にしない。catalog指定遭遇と対応skillもそろった場合だけ固有の観察provenanceを付ける
- root-tangle縦切りでは `はねかえりの 一滴` を最終特徴とし、commit済みattempt key、node、encounter、直近discoveryが一致した場合だけ観察へ進む
- 誤答、救助帰還、後日の復習で、すでに見つけた特徴を取り消さない
- `found` はゲーム上の観察事実、`mastered` はMVP-2以降の学習証拠とし、同じ状態にしない
- MVP-0/1段階の縦切りはメモリ内だけで動かした。現行MVP-2bでは予約済み学習assignmentの回答だけDexie / SRSへ原子的に書き込み、game-only fallbackは学習状態へ混ぜない
- MVP-2aでrun終了時の発見snapshotは保存しても、調査特徴を次runの開始状態へ復元しない。run横断のページ進捗はMVP-2bの別契約とする
- 旧cold-open表示実験を含む既存run・発見snapshotの再読互換性を守るため、内部保存ID `discovery-page:jabarapon` と `discovery-feature:jabarapon-*` はlegacy安定IDとして維持する。このIDは現行候補の選択、マキモドンの再承認、子ども向け名称の生成には使わない
- 新規runの深度1〜3は上記legacy IDにも現行主調査IDにもfeatureを付与しない。深度4から主調査の手掛かりを開始し、調査ページ外のレア標本を含む通常報酬はnon-blocking、大発見だけをblockingにする

## 7. 探検ラン状態（正式保存時の型案）

MVP-0/1の実型は `src/domain/explore/types.ts` を正とし、`active | returned | rescued`、メモリ内の `attempts`、`rescuePending` を持つ。以下の `abandoned` と `inventory` はMVP-2以降の候補である。

```ts
export type ExploreRunStatus = 'active' | 'returned' | 'rescued' | 'abandoned';

export interface ExploreRunState {
  runId: string;
  seed: string;
  status: ExploreRunStatus;
  startedAt: number;
  currentNodeId: string;
  energy: number;
  maxEnergy: number;
  combo: number;
  temporaryFinds: DiscoveryInstance[];
  confirmedFinds: DiscoveryInstance[];
  inventory: ExploreInventory;
  nodes: ExploreNode[];
  edges: ExploreEdge[];
  pendingProblem?: ExploreProblemGate;
  lastEvent?: ExploreEvent;
}
```

## 8. MVP探索仕様

MVPは本格グリッドではなく、ノード型でよい。

- `/explore` 独立ルート
- 算数のみ
- 1ラン 8行動、15ノード
- 2択中心、1層だけ3択、終盤は合流
- 深度1〜3は価値ゲート対象のcold-open、深度4〜6はほたる花の3手掛かり、深度7は単一の大発見finaleとする。対応引き算だけ既存root-tangleの固有動作・観察を使い、それ以外は中立のページpayoffにする
- エネルギー12。通常正解と不正解は1消費し、ひかりの橋だけ正解時2消費
- 発見は水晶、化石、地図のかけら、地底花の4種
- 橋イベントは1回だけ固定イベントとし、cold-open後の深度5で見た目とコストを明示する
- 任意帰還とエネルギー切れの明るい救助帰還
- 不正解はエネルギー -1、コンボ0。1回目は同じ問題、2回目以降は学習用フォールバック問題
- 発見はラン中だけ保持し、任意帰還・救助帰還のどちらでも帰還要約へ確定する。未確定素材の損失はまだ実装しない
- 帰還要約では未訪問の専用遭遇、未体験の地形、別ルートの順に1件だけ「つぎの たんけんの けはい」を出し、同じ画面から別ルートへ再出発できる。報酬量や永続進捗は増やさない
- 問題は同じrun seed、gate、試行、skill、プロフィールsnapshotから式と数量視覚まで再現でき、別候補の乱数消費に影響されない
- 正解step `0〜2 / 3〜5 / 6〜7` ごとに、最初の実gateから区間内の自動routeを純粋に投影し、全slotの実node / gate、完全なProblem、encounter、immutable assignmentをbulk reserveする。slotは絶対stepで識別し、区間途中のプロフィール更新や別tabからの再planで上書きしない
- rapid-loop適格性と解放上限は、新しく予約するbase segment slot / retryだけを生成時に判定する。保存済みsegment / retryはfull Problemとassignmentを正本として非遡及で復元し、旧runから採用した現在slotも維持する。旧runの残り未保存slotだけを現行規則で計画する
- 不適格な学習候補はassignment化せず、別identityの `game-only-fallback / affectsSrs = false` で不足分だけを埋める。除外Dueをgame-onlyへ変換せず、MemoryState、回答履歴、Due時刻を変更しない
- 1回目の誤答は同じslot / Problemへ戻し、2回目以降の表現支援は同じstepにぶら下がる別attemptとする。正解するまで次slotを消費せず、支援assignmentを区間の残り問題として数えない
- 画面内ゲーム状態は純粋reducerで進め、run・予約assignment・回答event・終了statusはDexieへ保存する
- 予約済み学習assignmentの回答はStudy共通writerでSRSへ接続する。active runはrun行のoptional checkpointから同じrunId、route、energy、finds、pending Problem、attemptNumberへ自動復帰し、別の導入画面を増やさない
- checkpointはversion、単調revision、opening experience ID、確認済みdiscovery cursorを持つ。Q7大発見は未確認ならreload後に1回だけ再表示し、「調査ノートを とじる」のcheckpoint保存が成功した後は再表示しない
- 回答commit後は次の操作を解禁する前にcheckpointを更新する。commit済みanswer eventがcheckpointより1件だけ先行したcrashは保存receiptをreducerへ1回だけfoldし、複数tail、別gate、別assignment、未知schema、stale revisionは推測復元しない
- checkpointを持たない旧active runは、既存の回答ログ・SRSを変更せずabandonedとして閉じてfresh runへ進む。finished rowと既存学習データは変更しない。発見図鑑のrun横断永続化は別の後続契約とする
- 予約区間はcheckpoint revisionへanchorしてrun行へassignment群と原子的に保存する。保存後・問題表示前のreloadでは同じslotを復元し、区間dataのgate / category / source / review / SRS属性がassignmentまたはcheckpointと違う場合は再生成で隠さず競合として止める
- Q7開始時にQ8のfull slotを予約することは学習planの永続化であり、blocking discoveryを越えるruntime先読みではない。Q7発見の確認checkpointが保存される前にQ8をpending Problemへ適用、表示、入力可能化してはならない
