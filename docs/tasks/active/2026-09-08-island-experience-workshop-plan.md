# E7/E8 おためしの入江 — 道具と制作の採用案

- Date: 2026-09-08
- Owner: Codex / island experience goal
- Status: Active — 親担当の仕様採用判断待ち
- Review By: 2026-09-15
- Related ADR / Runbooks: [体験36](../../product/36_island_experience_spec.md)、[検証方針](../../ai/verification_matrix.md)

## Purpose

島の任意の「おためしの入江」で、本人が同じ物を拾う・運ぶ・洗う・照らす・浮かべる。その性質を使って部品を組み、つながった仕掛けを住民が使うところまで一つの体験にする。発見一覧、説明文、既存配置を保存する操作だけで代用しない。

[全104項目対応表](2026-09-08-island-experience-coverage.md)と[残る体験の監査](2026-09-08-island-experience-remaining-audit.md)のU1/U2/U4を主に扱い、U3の仕事、U5の展示と持帰りへの接続点を作る採用案である。最終仕様・実装完了・他のU候補の不採用を宣言するものではない。

## Docs To Touch

採用時に仕様36へE7「道具で標本を調べる」とE8「部品をつないで使う」を追加し、親仕様01、島28、成長30との境界を明記する。本案では通常の学習問題/予約/独力/支援、ほしの付与、4居場所の成長、7家具、既定の土地拡張を変更しない。新しい保存状態・画面・検証を必要な子仕様へ対応付ける。task queueと採用判断は親担当が管理する。

## One continuous experience

1. ホームの任意入口から入江へ。拾える3つの形と、洗い場・光の台・浅い水面が先に見える。最初に説明ダイアログを読ませず、目の前の物を触ると少し動く。
2. 砂をかぶった物をタップ/ドラッグして持ち、調べる場所へ置く。洗うと触れた部分から表面が出る。同じ物を光や水へ運び直すと、透ける/沈む/浮く等の性質がその場に現れる。
3. 必要な特徴を自分で実行すると、その現物の正体が確定する。未知の形を新品アイコンへ差し替えるのではなく、表面・色・模様がつながったまま短い発見の山場を作る。本人が名付け、棚へ置き、再び持って調べられる。
4. 標本の素材から道具や部品の使い方へつながる。標本は失わず、同じ素材の工作用の見本を工房で使う。板をみぞへ、貝をベルへ、透ける石を水車の窓へ、対応する場所にはめると部品の形が完成する。
5. 4種類の部品を直接動かし、みぞ→水車→ベルへつなぐ。「みずを ながす」を押すと水が実際の接続をたどり、水車が回り、その軸で貝のベルが鳴る。途中を外すとそこで止まる。
6. 好きな住民が入江でハンドルを回す/流れを見守る/ベルへ返事をする。作った本人の配置に歩いて来て、実物へ触れる。別の道につなぎ替えて再び試し、保存する・元へ戻す・すぐ学習へ戻るを選べる。

## Finite content with real differences

素材は3種、道具は3種、制作部品は4種。数を有限にしながら、対象・場所・部品の順序で結果を変える。追加の毎区間配布や別学習通貨で反復理由を作らない。

| 対象 | 見つけた時から続く現物 | 洗う | 照らす | 浮かべる | 制作とのつながり |
|---|---|---|---|---|---|
| 流木 | 砂がついた丸い枝 | なぞった面から木目が出る | 光を通さず輪郭の影ができる | 水面へ浮き、押すと戻る波紋 | 木のみぞ。工作用見本をはめて形を作る |
| 透ける石 | 曇った淡い緑の欠片 | くもりが部分ごとに取れる | 光を通し、台へ淡い色の光が落ちる | 砂底へ沈み、水面と底の位置差が読める | 水車の小さな色窓。回ると光の向きが変わる |
| しま模様の貝 | 土色の丸い殻 | 縞と溝が現れる | 光を通さず溝の影が変わる | 底へ沈み、流木と結果が違う | 貝のベル。触れた時と軸で鳴らす時に短い音 |

正体判明の初期条件案は、流木が「洗った表面＋浮く」、透ける石が「洗った表面＋透過光」、貝が「洗った表面＋遮光の影」。残る道具も別の性質として観察でき、正体判明後も未確認の性質と対照実験が残る。1対象に3道具全件の消化を強制せず、異なる見つけ方でも同じidentityへ到達させる。

対象の正体は拾う前から固定のcatalogに対応させる。保存を読み直す・操作をやり直す・学習速度を変えることで正体が再抽選されない。「何か分からない」と「出会えるか偶然」は分ける。

| 道具 | 本人の操作 | 目に見える結果と入力の代替 |
|---|---|---|
| やわらかいブラシ | 面をなぞる/選んだ部分へブラシを当てる | 粗い6区画程度の砂被覆が減り、その場所の表面が出る。長押し耐久ゲームにせず、keyboard/タップでは同じ区画を選んで洗える |
| 小さなランプ | 対象へ向ける/対象を光の台へ置き向きを変える | 実際の対象の影/透過光が台へ届く。光線が対象を通過したように見えるだけの字幕は不可。左右ボタンでも同じ角度を選べる |
| 浅い水の皿 | 対象を持って水へ置く/取り出す | 浮く対象と沈む対象が異なる高さへ移り、波紋が接触点から出る。置く場所の枠とボタン入力でも同じ判定 |

「持つ/置く」は手の基本操作で、4つ目の道具を増やす必要はない。複数pointer・途中取消・範囲外releaseで現物を消さず、元の合法な場所へ戻す。

| 制作部品 | 有限の初期数 | 実接続 | 手応え/利用 |
|---|---|---|---|
| まっすぐのみぞ | 1 | 向かい合う水の入口/出口 | 接続口が合うと木の短音、水の流れが通る |
| まがりみぞ | 1 | 90度の水の入口/出口 | 回転させると進む向きが変わる |
| こまどの水車 | 1 | 水の入口→軸の出口 | 入水して初めて羽と色窓が回り、隣の軸へ動力が渡る |
| かいのベル | 1 | 軸の入口 | 軸がつながった時だけ貝が揺れ、音offでも打つ/揺れる動作が読める |

素材見本を部品の対応するくぼみへはめる制作工程を設ける。消耗在庫を作らず、やり直すと見本は戻る。制作の失敗で標本や通常の成長を失わない。完成済みの4部品も自由試作に使え、材料集めを通常学習の前提へしない。

4×4程度の盤面へ自由に置ける形を候補とする。例えば左端の水源から、案Aは「まっすぐ→水車→ベル」を右へ、案Bは「まがり→下向きの水車→ベル」を下へつなぐ。未使用部品を無理に全配置する条件にしない。水/軸のport種・位置・向きが一致して初めて接続し、遠い部品へ成功演出を飛ばさない。自由題材と「ベルをならす庭」の題材は同じ部品/判定を使い、唯一の配置を正解にしない。

## E7 observations and identity

提案するpure domain:

- `getWorkshopSpecimenDefinition(kind)` — 3対象の固定identity・被覆区画・性質・展示形。
- `reduceWorkshopObservation(state, action)` — pick/place/brush/illuminate/immerse、条件判定と途中状態。表示時間やframe数は正体/成果の入力にしない。
- `getWorkshopObservationOutcome(specimen, tool, station)` — 同対象/同条件から同じ表面/影/浮沈の結果。未知でも物性は同じ。
- `recordWorkshopObservation(profileId, intent, visibleOutcome)` — 現物と必要な結果が実表示された通知から記録。条件達成だけ・preview・背景化で図鑑を埋めない。

E1〜E3の `growth.discoveries` に未知標本を無理に追加しない。現15件のID/host判定/再演は維持する。例として次のnamespaceを採用候補にする。

| 種類 | 安定ID候補 | 意味 |
|---|---|---|
| 現物 | `island-workshop:v1:specimen:driftwood` / `seaglass` / `striped-shell` | 同profile内で有限3現物。画面を閉じても同じidentity |
| 特徴 | `island-workshop:v1:observation:driftwood:clean` / `:opaque` / `:float` | 実行した道具と見えた性質を区別。石は`:transmit` / `:sink`、貝は`:opaque` / `:sink` |
| 正体 | `island-workshop:v1:identity:driftwood` ほか2種 | 規定の特徴を実際に確認した現物の正体。発見順と最初の時点を保持 |
| 作品 | `island-workshop:v1:project:slot-1` / `slot-2` | 2案の工作用配置。既存 `experience.layouts` の `slot-1..3` と別型/別field |
| 制作発見 | `island-workshop:v1:construction:water-wheel` / `:shell-bell-chain` | 実水路/水車/ベルの成立を一度記録。毎回の再演は新報酬にしない |

名前の入力は既存の16文字/NFC/制御文字制限を再利用候補とし、未入力は既定の標本名で続ける。自分の名札と正体/性質の事実は別fieldにする。

## E8 connection and performance

提案するpure domain:

- `validateWorkshopLayout(parts, poses)` — 盤面・占有・向き・有限部品IDを検査。所有家具の配置判定と別責務。
- `resolveWorkshopConnections(layout)` — 接続口を座標/向き/水又は軸の型で結ぶ。輪を許す場合もvisited setで有限にたどり、無限loopにしない。
- `simulateWorkshop(layout, input)` — 水源→みぞ→水車→ベルの順序付きbeatと不成立位置を返す。回答結果/経過日数/乱数を入力にしない。
- `sampleWorkshopBeat(beat, progress, reduced)` — 実接続のanchorへ水が届き、羽→軸→貝の順に動く。reducedでは因果の順番を少数の静止状態で読めるようにする。
- `reduceWorkshopDraft(draft, edit)` — move/rotate/assemble/remove/clear/undo/redo。判定を変えず再試運転可能。

本人が水源へ触れて開始し、全体を一度に成功色へ変えない。接続しない時は水/軸が止まった場所を見せ、そこの部品を触ればすぐ置き直せる。正誤音・点数・材料損失を足さない。試運転終了待ちなしで中断/編集/学習へ移れる。

住民利用は表示テキストと別の受入条件にする。選んだ住民が入江の安全な歩行laneを通って水源のハンドルへ行き、手が触れて回す→流れを目で追う→鳴った貝へ体を向けて返す。いずれも本人の現在配置のanchorを使う。家具の通常resident/歩行状態を上書きしてホームへ持ち帰らず、入江の演技状態を停止するとhomeの正規状態へ戻す。

## Park reuse — concrete boundaries

| 現source/function | 再利用・参照できる部分 | そのまま流用できない部分 |
|---|---|---|
| [simulation.ts](../../../src/domain/park/simulation.ts) `simulateCourse` | 純粋な決定的ルール→順序付き `PlayBeat`。並び替えで勢い/泡/色/飛び越しが変わる構造とテストの切り分け | `PartKind` はslide/trampoline/bubble/mat/bell/paint、1次元の順番。水/軸portの2次元接続は表現しない。名前だけ水車へ変換すると因果が嘘になるため別simulatorを作る |
| [course.ts](../../../src/domain/park/course.ts) `courseLayout` / `editPark` / `assertPark` | 有限所有ID・重複配置防止・純粋な編集・案の切替という不変条件 | ParkRecord/学習計画/部品報酬は島へ持ち込まない。4×4の接続とundo/draftは別stateが必要 |
| `PartWorkshop.tsx`（公開終了・Git履歴参照） `PartDemo` | 部品選択前に実際の動作を見られる点 | 学習後に1部品を作る導線とper-demo stageを島へ複製しない。入江の実sceneで触って試す |
| `ParkStage.tsx`（公開終了・Git履歴参照） / `playback.ts`（公開終了・Git履歴参照） | 任意の再演、beatごとの時間、reducedの結果状態 | 横長sprite投影・ベル音の呼出しをそのまま入江の座標/音許可へ持ち込まない |
| `three/config.ts`（公開終了・Git履歴参照） `supportsThreePark` | 現対応範囲を明示的に判定する設計 | 現Threeは**3枠かつslide/trampoline/bubbleのみ**。4部品やbell/paintでも同じ3Dになるとは言えない |
| `three/toys.ts`（公開終了・Git履歴参照） `createSlide` / `createTrampoline` / `createGate` | 厚みのあるExtrude形状、接触位置で変形する布、足の高さが決まる形づくりの参考 | 樹脂すべり台/トランポリン/シャボン門は水路/水車/貝ではない。入江用の木の溝・回転羽・軸・貝のgeometryが必要 |
| `three/choreography.ts`（公開終了・Git履歴参照） / `three/scene.ts`（公開終了・Git履歴参照） `createToyScene` | 接触→予備動作→移動→着地、描画資源のdisposeと実geometry測定 | +Xの固定玩具台/別WebGLRenderer/固定doll。島の住民/単一rendererに同じsceneを重ねて増設しない |

採用案は、既存 `IslandStage` のrenderer内に入江のscene groupとcamera focusを追加し、ホームの世界と切り替える方式。3標本・3道具・4部品を実形状で作り、raycastの意味を `specimen/tool/part/port/station` に限定する。商品カード/図鑑カードごとのrendererは増やさない。主島の7家具や4居場所の成長対象には入江の部品を追加しない。

作業用のgeometryは水の低い皿、砂被覆の面、透ける石の厚み、丸い流木、溝を持つ貝、くぼんだみぞ、回る羽と見える軸を優先する。字幕を隠しても3素材/3道具/部品の因果が読める実画面が必要。手応えのSEは木・砂を払う音・水・貝の短音を小さく分け、音off/reduced/声優先を既存audio契約へ合わせる。

## Saved state, draft, undo, and learning

保存位置の採用候補は `IslandRecord.workshop?: IslandWorkshopState` の追加v1拡張。既存の `experience` の名前/音/配置3案や `growth` の15発見とは別fieldにする。既存profile所有/CAS/同操作receiptのpatternは再利用する。学習planやほし・成長・7家具を変更するactionは含めない。

| 状態 | 永続化と変更時点 | 意味/取消の境界 |
|---|---|---|
| 有限標本のidentity・洗った区画・見た性質・名札・展示選択 | gesture確定/実表示の観察後に正規化actionを原子的保存。pointermove全件は保存しない | 途中で学習へ戻り再入場しても同じ物と途中状態。正体/初記録は単調で、実験をやり直しても消えない |
| 保存作品2案 | 「このさくひんを のこす」で全layout/組立状態を検査し一括保存。表示中作品の選択も明示 | 一時試作を保存作品へ反映する唯一の操作。旧案の復元でも成長/標本/学習実績を巻き戻さない |
| 作業draft | 編集はまずcloneへ。gesture確定ごとに別 `draftCheckpoint` を保存候補とし、保存作品やhome配置と混ぜない | 学習へ戻る時に毎回保存確認を出さず、再入場/reloadでは「おためし」の続き。取消はcheckpointを消し保存作品のcloneへ戻す。自動checkpointを『作品を保存した』と表示しない |
| undo/redo | draft内の直近20編集程度のbounded履歴をcheckpointに含む候補。pointermoveではなく1gestureが1操作 | move/rotate/assemble/clearを戻せる。観察の初発見・学習・ほし・標本所有はundo対象外。新操作でredoを消す |
| 試運転/光の向き/水粒/住民の歩行/ドラッグ途中 | runtimeのみ。背景化/学習/終了/再配置でstop/dispose | 自動で成果・ほしを増やさない。再開は保存/作業配置の静止状態から本人が再実行 |

観察の保存と試作checkpointにはそれぞれ操作IDを付け、未知I/O失敗では同じ正規化intentを再送する。CAS競合は最新stateへ明示的に再照合し、他tabの新観察を古いdraftの全stateで消さない。profile切替時に旧profileの未処理操作/通知を新profileへ適用しない。必要なら標本の単調mergeと作品のCASを別actionへ分けるが、transactionの目的は仕様で明記する。

学習への復帰を新しい承認画面・部品回収・試運転完了待ちにしない。保存をgesture確定単位にまとめ、通常の連問中には入江のcheckpointを発生させない。開始時に入江の演技/音/ドラッグを停止し、既存 `startIslandPlan` と同予約再開へ戻す。保存失敗は入江の状態として再試行可能にし、学習の正解を取り消したり未支援扱いへ変えたりしない。

## Verification

- Domain: 3素材×3道具の決定性と条件差、各identityの必要特徴と判明後の追加観察、正体が変わらないこと、未表示は記録しないこと、標本/観察IDの一意性、接続/非接続/回転/型不一致、有限loop、異なる2構成、undo/clear/取消で物を失わないこと。
- Storage: 旧v1で未設定、profile分離、同intent再送、I/O不明後のretry、2tab競合、transaction abort、観察途中/draft/保存作品のreload、実SW offline。標本や作品操作の前後で学習DB・ほし・成長・7家具を比較する。
- 実画面: 390pxで拾う→洗った部分が出る→光/水へ運ぶ→正体→棚、部品組立→接続→水車→貝→住民の返し→別案→undoのcontact sheet。対象・手・道具・水/光の到達・接続口・住民全身を確認する。成功の一枚だけで合格にしない。
- 意味と学習非阻害: 無音/字幕非表示でも何をして何が変わったか読めるか、音off/reducedで同じ事実が分かるか、任意の途中から通常plannerの同じ予約へ復帰できるか、連問追加0操作と入力P95を保持するか。
- Runtime: active時以外はループ/音停止、単一renderer、scene切替/resize/背景/復帰/低性能端末/reduced/描画失敗で資源が積み上がらない。同じbuildの実app target・flag・candidateを明記し、視覚・意味と学習非阻害・runtimeの3ゲートを独立判定する。

この案を採用しても、住民の継続した関係/仕事、16報酬、季節/写真/見学など[全対応表](2026-09-08-island-experience-coverage.md)の残りは消さない。採用した具体体験で満たすIDと残るIDを分けて更新し、規模を理由に主要観点を説明文へ置き換えない。
