# 実装境界・保存・移行契約

v3.0-rc1／新設する部分の契約。型名・テーブル名は提案であり、既存API名を断定したものではない。

## 1. 責務の分離

| 層 | 正本として持つもの | 持たせないもの |
|---|---|---|
| 学習 | 予約Problem、回答、支援、終端、独力証拠、復習・定着 | 魔法や配置を正答へ変換する処理 |
| 島の経済・所有 | 確定終端の一度だけの報酬、購入receipt、個体、土地、成長 | 現在価格で過去の購入を再解釈する処理 |
| 関係の判定 | 現在の配置・育ちから導く構造条件 | 画面を再描画するたびに変わる抽選 |
| 住人の活動 | 行き先、経路、役割、席、開始・終了 | 背景の散歩を有料の利用活動とみなす処理 |
| 表示 | 通常反応、魔法、レア、音、表示時計 | 永続の物理位置や学習証拠の改変 |
| 記録 | 成立・表示・本人保存・再演の区別、不変のscene snapshot | 自動的な「理解した」の判定 |

新しい汎用ゲームエンジンや完全なルール言語の開発を初版の前提にしない。21の制作台帳に必要な小さな判定器と共通表示部品から始める。

## 2. 最小データ契約

```text
LearningTerminalFact
  profileId, planId, slotId, committedAt, completedAt
  subject, source, problemVersion, outcome, supportEvidence
  legacyRewardPolicyRef

IslandCreditReceipt
  profileId, planId, slotId, sourceFactId, ruleVersion, actualDrops
  projectedAt

ItemInstance
  instanceId, kind, purchasedAt, paidDrops, purchaseReceiptId
  cell?, orientation, accessProfileVersion, appearanceId
  growthEffectiveHours, growthRuleVersion

PurchaseReceipt
  profileId, intentId, priceVersion, quoteFingerprint
  actualPaidDrops, itemInstanceId, committedAt

RuleEligibility (derived; not an earned reward)
  ruleId, ruleVersion, participantIds, semanticSignature
  currentResult, currentAvailabilityReason

SceneEvent
  eventId, profileId, ruleId, ruleVersion, semanticSignature
  createdAt, source: live | current-context-test | replay | simulated
  originEventId?, sceneSnapshotRef?, focalParticipants

PresentationEvidence
  eventId, firstVisibleAt?, visibleDurationMs, coreShown
  presentationKind: live | current-context-test | replay

DiscoveryRecord
  ruleId, firstPresentedEventId?, firstPresentedAt?
  userSavedEventIds[], latestSceneEventId?
  # No inferred comprehension or creativity score.

MemorySnapshot
  snapshotId, contentVersion, objects[], residents[], environmentStyle
  originEventId, immutableHash

MigrationCheckpoint
  checkpointId, sourceSchema, sourceRules, sourceFactWatermark
  cutoverAt, importedItemIds, balances, growths, ownedRights
  legacyLightRemainingBudget, validationHash, completionStatus
```

現在の型に既に同じ責務があれば再利用する。`semanticSignature`は、プロフィール・ルール版・参加個体ID・位置・必要な育ち段階・参加住人・必要な利用状態から作る。描画フレーム、無関係な保存revision、現在の残高、P、正答率、タップ数を含めない。

## 3. 報酬の投影

学習DBのcommit成功が先。島は対象終端を読み、`profile+plan+slot`で既処理なら同じreceiptを参照して終了する。新規ならreceiptと2しずくを島側の同一トランザクションに保存する。

島投影失敗で回答をやり直させない。次回起動や帰島で未処理終端を照合して再投影する。学習日やcompletedAtを投影時刻へ置き換えない。筆算の途中行、skip、誤答試行を終端として取り込まない。

学習の対価を払う意図がある保存済み予約は更新で無報酬にしない。旧予約と新規予約の扱いを版で区別し、v2の重み2が実際に採用されていた場合は、その予約の約束を維持する。未実装の提案に報酬権を発行しない。

## 4. 購入と編集

価格quote、公開capability、所持上限、現在残高、占有、入口・席・経路をcommit時に再検証する。意図IDの既存receiptとの一致は、単なるrevision不一致より先に確認し、再送の二重購入を防ぐ。異なる内容に同じ意図IDを使った場合は拒否する。

自分の時間更新で進んだrevisionだけなら最新状態へ再検証してよい。他画面・別タブの競合は勝手に承認せず、結果を見せて再選択する。自動更新で仮配置や取消を消さない。

編集中の「まなぶ」は未確定previewを取り消して移動する。開始済みcommitは元のプロフィールにだけ完了し、別プロフィールへ結果を表示しない。commit開始前に取り消された操作を、遅延した更新の失敗時に復活させない。

収納は所有を残し、成長の適用区間だけを閉じる。移設後の再配置に費用を請求しない。撤去だけが実支払額に基づく返金を行う。

## 5. 構造判定と住人の予約

構造判定は、保存された同じ状態から同じ結果が得られる純粋な処理にする。地区、普通の関係、魔法の候補、レアの候補は独立に算出する。

住人の予約は構造判定の後。必要な利用点、役割、経路が全て取れる場合だけ活動を開始する。2人活動が取れない場合は1人動作等へ戻り、一人を永久に待たせない。

関係判定がtrueでも、住人が忙しくて動かないことはあり得る。`eligible / waiting-for-resident / blocked-path / growing / active`等の現在状態を分け、画面で全部を「何も起きない」にしない。

物を動かした場合、古い利用とその魔法を取消し、予約を解放し、現在の安全な地上位置へ戻す。保存された所有を表示都合で書き換えない。

## 6. 魔法・レアの表示と優先順位

優先順位は、学習・退出・プロフィール変更 > 編集 > 本人がいま触った対象 > 現在状態のお試し > 自然なレア > 周囲の小さな環境反応。

同時の焦点は一つ。新しい明示操作を待たせて古い魔法を最後まで見せない。通常の住人生活は続けてよいが、検証中の対象より大きく目立たせない。

初回描画の準備で短い反応を消費しない。可視render後に表示時計を開始する。バックグラウンドへ移った場合は中断し、期限を過ぎた古い演出を戻った瞬間に自動再生しない。条件を整えて任意に試し直せる。

魔法の再生回数、レアへの気配タップ、記録の保存は通貨・成長速度・学習量を増やさない。現在状態の「みてみる」は無料の表示用活動であり、従来の30分利用報酬へ変換しない。

## 7. 記録の真実性

SceneEventを作るだけでは表示済みにしない。実際に対象が画面内にあり、主要部分が表示されたPresentationEvidenceで区別する。最初の表示と理解は別である。

自動履歴は20件の有限領域で、同じ内容の再演をまとめる。本人保存12件は別の権利。上限に達した場合は本人へ選択を求め、古い本人保存を自動削除しない。満杯でも学習・経済・構造判定は止めない。

自動履歴から外れる場合も、本人保存や最初の表示事実が参照するsnapshotを削除しない。詳細を解放できるのは参照のない自動履歴だけとし、ルールごとの最初の表示メタデータは別に保持する。

当時の場面の再演は、不変snapshotを読む隔離した表示。現在の島に戻したことにしない。再演で過去の`simulated`を`live`へ書き換えない。旧38の思い出棚、既存写真・展示とは別namespaceにする。

既存写真は本人が実canvasから撮るPNGという契約を維持。自動イラストやsnapshotは写真と呼ばない。写真bytesを学習の回答トランザクションへ混ぜない。

## 8. v1／現行48からの移行

1. 元DBと利用中のルールを確認し、読み取り用のバックアップを確保する。個人DBがない本レビューでは実移行を実施しない。
2. 進行中の島commitと投影を整理し、学習正本の確定終端を読み込む境界を`sourceFactWatermark`として確定する。壁時計だけで未処理事実がないと決めない。
3. 切替前のイベントは**旧価格・旧成長・旧ひかり規則**で確定する。旧個体の実支払額がイベントにない場合、当時の版付き価格からのみ復元する。根拠がなければ未確認として止め、現行価格で埋めない。
4. 残高、個体ID、成長の有効時間、配置、外観、土地、既得資格、未受取贈与をcheckpointへ保存する。原データを削除しない。
5. 新領域へ書き込み、件数・ID・残高・権利・成長が一致することを検証し、全て成功してからactive schemaを切り替える。中断時は同じcheckpoint IDで再開する。
6. checkpoint以後のイベントだけに新価格、新成長、有限ひかりを適用する。旧版を読めないアプリへの無条件downgradeはしない。

学習事実が遅れて投影され、切替前区間に影響する場合は、source watermarkと旧ルールに基づいて不足分を補正する。**過去の購入列全体を新価格で再計算しない。** 成長補正に必要な旧時間境界が復元できない場合は自動推測せず、旧領域を保ったまま移行未完として扱う。この競合ケースは実リポジトリのwriter方式に適合させる必須受入項目である。

## 9. v2案が既に一部使われている場合

v2は元々提案だが、実際に実装されたかどうかは最新リポジトリとDBで確認する。Pが存在しないDBへ、過去の残高からPを推定して追加しない。

Pが存在しても新しい購入・魔法のゲートには使用しない。既得のレア外観、魔法の知識、未表示の確定済み出会い権、既発行贈与、土地は保護する。v3で廃止するのは**新規付与の仕組み**であり、既得物の取り上げではない。

価格を下げても過去の支払額は書き換えない。旧購入品の返金は当時の実支払額に従う。新価格で買い直した品は新しい実支払額を使う。所有上限を下げる必要が生じても、自動削除や自動売却はしない。

## 10. ひかりの有限補充

`B = max(0,4×未取得の既存色数−現在残高)`を切替時に一度保存する。従来の有効活動から得られる量とB残りの小さい方を発行し、残高とB残りを同時更新する。色を買って残高が減ってもBを再計算しない。

旧残高1000は1000のまま、B0。旧残高3・未取得1色ならB1。新規なら最大8。旧色以外の用途を増やす場合は、経済を別に再設計する。

## 11. PWA・オフライン・プライバシー

キャッシュ済みの公開capabilityだけを使えると案内する。画像・音・3Dが欠けた魔法を、未確認なのに解放済みの表示へしない。取得済み所有は素材不足でも消さない。

PWAの更新はcriticalな保存中にreloadしない。DB削除や学習予約の再生成を通常の復旧策にしない。プロフィール削除・バックアップの実際の範囲は既存契約を保ち、別DBを一つのトランザクションで削除・書出しできると仮定しない。

発見ログ・学習ログ・写真はローカル保存を基本とし、本人や保護者の操作なしに外部分析へ送らない。仮説力等をスコア化しない。製品分析が必要な場合は最小限のイベント・同意・保存期間を別仕様で決める。

## 12. 仕様モデルで確認していないこと

本一式の38テストは、学習報酬の簡易台帳、成長積分、地区の一部、原資、4代理配置等を対象とする。実DBのtransaction、複数タブ、PWA更新、全ルール表示、実行中の移行、データ復元、3D干渉を確認したものではない。実装時に別のテストが必要。
