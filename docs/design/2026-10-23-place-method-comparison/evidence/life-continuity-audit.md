# 最終v17の生活継続：読み取り監査

結論：**85の新規起動では2人×庭/ベンチの4組すべての可視fresh利用が成立した。81のUndo復元後については、新しい可視fresh利用を確認できていない。** これは別の証明範囲である。元capture・runtimeコードは変更していない。照合結果は [post-edit-life-check.json](post-edit-life-check.json)。

## 記録から確定したこと

81-restoredから82-restoredへ、地形・全Undo/Redo・土地・所有物・住人・通貨等は変わらず、useHistoryが33→35件になった。追加は次の2件。日時はdomainが受理して記録した日時であり、可視frameの証明時刻とは同一視しない。

| actor | target | domain受理日時 UTC |
| --- | --- | --- |
| v2 | starter-flower:garden | 2026-10-22 22:24:10.973 |
| pokomoko | starter-bench | 2026-10-22 22:24:11.125 |

一方81/82のLiveUseは同じ2件のまま。そこにあるのは編集前のPokomoko gardenとv2 benchだけである。82の待機前後DOMは `data-terrain-editing=false` で、編集パネルを開いたまま停止していたとは説明できない。ただし継続する全frameの状態は採取していない。

85は新しいsession IDで、同v17 build UUID・同candidate・同raw heights・同土地/所有物/派生placesを確認。82とのworld DOM差は選択セル `4,4`→空だけで、カメラ行列・geometry revision・編集false等は同じ。新規memory fixtureなのでUndo64/Redo0へ戻り、82のUndo62/Redo2とは異なる。これは保存再開ではない。

| 85のfresh利用 | UTC | 起動から |
| --- | --- | ---: |
| Pokomoko bench | 22:33:31.511 | 7.145秒 |
| v2 bench | 22:33:44.930 | 20.564秒 |
| Pokomoko garden | 22:33:55.880 | 31.514秒 |
| v2 garden | 22:34:06.263 | 41.897秒 |

全4件でfresh-life-receipt、visible、active/playActive、inFrustum、renderSucceeded、handlerAcceptedが成立。記録のworld revisionとplace revisionはcaptureの派生world/placeと一致した。操作者の報告は、目的地指定・地形編集なしの新規shore起動で、取得用のヒント閉じ/比較panel開きは4件より後。4件の成立は、最終候補が初期状態で生活を一律停止させるという仮説に反する。ただし81の編集後continuityを代替しない。

## 2件で止まったように見える仕組み

- `growingLife.ts:552–560` のキーはplace ID/revision＋actor ID＋target ID。`observedUses`はsyncで消さず、同じ組を再利用してもreceiptを追加しない。2人×2targetが4組観測済みになれば、生活が続いても同revisionで記録数は増えない。
- `GrowingIsland.tsx:521–522` はpanel/menu/selected等でplace receiptの受理を止める。一方、地形編集中以外は生活tickを続ける。`GrowingWorld.tsx:690–699` は拒否されたreceiptを1.5秒後に再送する。
- 試験の `live-use-transform.mjs` と `LiveUse.tsx:68` はretryを可視fresh記録から除外する。このため「背景で発生→UI遮蔽中に拒否→閉じてretry受理→保存historyは増えるがLiveUseは増えない→その組はdedup済み」という経路が成立する。今回の追加2件は初期2件と反対のactor/targetで全4組を埋めるので、この説明と整合する。

**これは仮説であり、今回のretry queue/拒否frameを採取していないため原因確定ではない。** domain受理やdedup仕様から可視利用を捏造して合格にはしない。手動の `visitPlace` はgarden/gallery/shoreだけを対象にするため、単に「ここですごす」でbenchの新receiptが必ず得られるわけでもない。

## 行動選択と停止しうる条件

fixtureはgrowth有効で `chooseTarget` を使う。利用可能な場所・席・家・散歩を列挙し、homeから到達可能か、現在位置から実床に沿うrouteがあるか、他actorの予約や席占有がないかを確認する。`lifeChoices.ts` は直近3choiceを避け、好み/未利用/再利用/散歩を重み付きで選ぶ。無作為なので数分で必ず全targetを回る契約ではないが、同じ2targetだけを永久に選ぶ固定ループでもない。

通常gardenは4.2秒で終了し、その後2秒待機。bench座りは通常6秒で終了し、その後1.5秒待機。これ自体には数分間の滞在設定はない。receiptは到着後700msで生成する。重複抑制はreceiptを抑えるだけで、タイマーや次のchoiceを止めない。

地形変更時は `sync` が床・walkable/homePathsを再取得する。移動中は現在の実位置から旧目的地へ再探索し、通れなければidleへ戻す。乾いた足元を保って孤立区画を作ることは許しているので、現在位置から.76cell以内に安全なgraph接続点がない、homePathsとの接続が切れる等では、3秒おきに再選択しても移動できない場合がある。安全な退避点が一つもなければawaitingGroundで不可視になり、毎tick再試行する。これは編集後停止を調べるべき実経路だが、81/82で発生した証拠はない。復元で元のraw幾何へ戻った事実も、途中のactor実位置を完全には証明しない。

`GrowingWorld.tsx:564` は地形編集中とwater preview中にtickを止める。通常の夜は住人を隠す。rAF/context障害も別途止まりうる。82 DOMの編集falseは前者の一条件を除外するだけで、すべての停止条件を除外しない。

## 今回の変換との境界・追加UI案

v17試験のtransformはGrowingLifeのchoice・timer・observedUsesを変更していない。GrowingWorldの追加は計測と受理後の読み取り観測で、観測例外はゲーム動作へ伝播させない。singlecompile/query固定/sample memo/edge memoは床生成・検証の処理再利用で、経路同値の診断は通っている。既存の地形対応にはfractional位置からの安全経路再探索などの変更があるが、今回の性能候補で生活周期を変更したわけではない。source読み取りだけで全回帰なしとは結論しない。

必要なら通常UIで、編集終了・本/選択sheet/メニューをすべて閉じ、同じsessionの住人が別地点へ歩くことを短い連続映像で確認する。既に4組dedup済みならLiveUse件数ではなく実際の移動を証拠にする。新しいreceiptを得るために内部observedUsesを消す、再読込結果をUndo後継続として扱うことはしない。この監査では追加操作・修正を行っていない。

## 86：同じsessionで1編集→Undo後の継続確認

[final-continuity-check.json](final-continuity-check.json) は85と同sessionの `(4,4)` 0→−1→Undo0を照合した。core状態・raw heights・派生placesは85と完全一致。最終Undo63件は85の先頭1件を除いた履歴、Redoはその新しい1編集だけで、64件上限に合う。復元直後と最終world DOMは完全一致、85との差は選択セルが空→4,4だけ。camera/geometry revision/candidateは不変、編集フラグは復元後false。LiveUseは85の4件と完全一致し、新fresh利用を主張しない。

記録された3枚は復元直後22:38:56.879から22:40:13.304 UTCまで76.425秒。checkerは日時の順序・元PNGのhashを確認した。2人の位置変化は別の可視レビューへ委ねる。その確認が成立しても証明範囲は「この同sessionの編集復元後に動きが続いた」であり、新しい場所利用receipt・全区間の安全な歩行・すべての編集後状態の保証へ広げない。runtime変更なし。
