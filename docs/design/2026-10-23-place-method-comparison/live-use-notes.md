# H の新しい自然利用を、保存履歴と分けて観測する

2026-10-23 JST。コード監査後、試験専用の `LiveUse.tsx` と `live-use-transform.mjs` を追加した。製品 source、SAVE、DB は未変更。統合 build・ブラウザー操作・H の利用成功判定は root が別途行う。

## 結論

最小の観測点は `GrowingWorld.tsx` の既存 `takePlaceUses()` ループ内。描画成功、コンテキスト正常、島が foreground、document visible、actor が frustum 内、という確認を済ませた直後に、そのフレームの証拠をコピーする。既存 `actionHandler` が `true` を返した場合にそのコピーを試験専用の表示ログへ渡す。再送は別扱いにし、新しい自然利用には数えない。

通常のページ再読込後、地形を変えず、通常の島画面で自然に待つことで、新しい `GrowingLife` が発生させた利用を観測する。保存済み `useHistory` の timestamp を増やすための操作は不要。保存履歴の重複排除は仕様どおり維持する。

## この位置を選ぶ根拠

- `growingLife.ts:552–561`: receipt の同一性は place ID / place revision / actor ID / target ID。world revision は含まれない。`observedUses` は新しい `GrowingLife` インスタンスごとのメモリー上の Set。
- `growingLife.ts:721,769–773`: garden / shore / seat は利用開始から 700 ms 以上で `observeUse` を呼ぶ。単なる接近、target の存在、成熟した場所の表示ではない。
- `growingLife.ts:374–381,815`: `guardPose` は発行済み receipt を後から取り消せる。したがって `observeUse` 直後だけを最終成功として表示してはいけない。
- `GrowingWorld.tsx:646–655,687–696`: 描画成功後、既存のキューを一度だけ取り出し、actor のカメラ内判定後に handler へ渡す。ここを共有できる。
- `GrowingIsland.tsx:521–522,540`: 通常の島を覆う UI、訪問、配置中などでは handler は `false` を返す。`playActive` だけでは全条件を含まないため、既存 handler の受理まで見る。
- `useGrowingIsland.ts:101–102` および `placeGoals.ts:129–134`: 同じ利用履歴の受理は `true` になり、元の履歴日時を保持する。`true` は「保存に新しい行が増えた」の証明にはならないが、今回の新しい lifecycle receipt が UI の受理条件を通ったことは確認できる。

## Vite の試験専用変換で追加する箇所

`src/` 自体は変更しない。既存の trial Vite plugin に `GrowingWorld.tsx` 用の branch を追加し、次の needle の出現がそれぞれ **1 回**であることを検査してから挿入する。helper は docs 内だけに置き、`trialEvidence` query がない場合は即 return する。

1. 以下の既存行の直前に、今回の drain へ再投入する receipt を記録する。

```ts
due.forEach(retry => world.life.retryPlaceUse(retry.receipt));
```

```ts
const trialRetried = new Set(due.map(retry => retry.receipt));
```

`retryPlaceUse()` は同じ receipt オブジェクトを push するため、参照同一性で再送を識別できる。キューからもう一度 receipt を取り出す処理は追加しない。

2. 下の既存 frustum 検証の直後、`Promise.resolve(actionHandler(receipt))` の直前に読み取り専用の snapshot を作る。

```ts
if (!position || !frustum.containsPoint(position)) {
    world.life.deferPlaceUse(receipt); continue;
}
```

```ts
const trialPlace = layer.places.find(place =>
    place.id === receipt.placeId && place.revision === receipt.revision);
const trialTarget = trialPlace?.useTargets.find(target => target.id === receipt.targetId);
const trialObservation = {
    observedAt: new Date().toISOString(),
    observedFrameTimeMs: now,
    delivery: trialRetried.has(receipt) ? 'retry' : 'fresh-life-receipt',
    receipt: { ...receipt },
    worldId: layout.world.id,
    worldRevision: layout.world.revision ?? 'original',
    actorPosition: { x: position.x, y: position.y, z: position.z },
    target: trialTarget && { id: trialTarget.id, kind: trialTarget.kind, cell: { ...trialTarget.cell } },
    currentPlaceRevisionMatches: Boolean(trialPlace && trialTarget),
    documentVisibility: document.visibilityState,
    active: latest.current.active,
    playActive: latest.current.playActive,
    inFrustum: true,
    renderSucceeded: true,
};
```

3. 既存 Promise の `.then` で `saved === false` の retry 処理を維持し、別途次の条件だけで visible log へ追加する。拒否・再送数を併記してもよいが、自然利用成功の件数へ混ぜない。

```ts
if (saved === true && trialObservation.delivery === 'fresh-life-receipt'
    && trialObservation.currentPlaceRevisionMatches
    && trialObservation.active && trialObservation.playActive
    && trialObservation.documentVisibility === 'visible') {
    recordTrialLiveUse(trialObservation);
}
```

日時は Promise 解決時ではなく描画直後に採った値を用いる。helper で candidate ID、query の方式、ページ session ID、ページ開始日時を付記し、最大件数を定めたメモリー配列へ保存する。DOM の `data-trial-live-uses` と、試験パネル内の読み取り専用 `<pre>` に同じ JSON を表示する。イベント発生時だけ更新し、毎フレーム React state を更新しない。アプリの SAVE / DB / receipt / observedUses / 住人状態へ書き込まない。

既存の `data-place-actors` / `data-place-targets` は位置と target の telemetry であり、利用完了の証拠ではない。また `import.meta.env.DEV` 内なので production preview では出ない。新しい試験ログを DEV に依存させず、試験 build と query の二重の限定にする。

## 誤判定を防ぐ実測手順

1. H と `trialEvidence` を指定して、保存済み状態から通常のページ再読込を行う。新しい session ID と空の live log を確認する。新規 `GrowingLife` の `observedUses` が自然に初期化される。保存履歴は残す。
2. 地形、所有物、保存データへ手を加えず、住人への誘導操作もしない。地形パネル、メニューなどを閉じ、島を表示したまま待つ。最初に UI に遮られた receipt は retry 扱いになるため、成功件数へ昇格させない。
3. 新しい live log の actor / target / place revision / world revision / candidate / observedAt を DOM と画像で保存する。通常の画面に対象 actor と場所が見える状態で撮る。計測パネルで島を覆った画像だけを利用の見た目の証拠にしない。
4. 別途、再読込後の家具・地形・過去の保存履歴保持を照合する。新しい live log の件数と `useHistory` 増分が一致する必要はない。

この単一点の日時は **receipt が描画済みとして観測された日時**。利用開始日時そのものではない。キューへ入った時点の厳密な world revision までは記録していないため、今回の試行は再読込から採取まで地形・candidate を変更しない。途中編集を含む実験へ拡大する場合は、receipt 作成時の metadata を外部 WeakMap に付け、描画後に取り出す二地点計測が必要になる。receipt の model 自体へ metadata を混ぜない。

また、receipt 単体は自然行動とユーザーによる場所への誘導を区別しない。自然利用という判定には、再読込後に誘導していないという実操作記録を併用する。1 件の利用が観測できても、全経路・全家具支持・全編集・美術・児童理解の合格へ広げない。

## 禁止する近道

`observedUses.clear()`、`visitPlace()` の強制呼出し、`uses.push()` の追加、`takePlaceUses()` の二重呼出し、保存日時の書換え、DB への receipt 注入はしない。retry の再表示を新しい利用と扱わない。元の guard / frustum / UI 受理条件を緩めない。

## 実装と局所検証

- `liveUseTransform(source)` を試験 Vite の `GrowingWorld.tsx` branch へ組み込む。source 中の retry / handler needle の出現が各 1 回でなければ変換を停止する。
- `TrialEvidence` に `LiveUse` を import して `<LiveUse />` を置く。`trialEvidence` query がない場合は記録も表示もしない。
- `recordTrialLiveUse` は最新 20 件、累積 count、session ID、candidate、実 world revision をメモリー上だけで持つ。観測日時は handler 呼出し前の `Date.now()`。表示は `useSyncExternalStore` でイベント時だけ更新する。
- 計測例外が既存 Promise の保存 retry に流れないよう、観測呼出しを独立した try/catch で囲った。
- Node / TypeScript の局所検査は PASS。実 source に変換を適用した文字列で、drain / handler 呼出しが各 1 回、一意性の崩れと二重変換を拒否、TS / TSX 構文診断 0 を確認。模擬 module の検査で retry / hidden / 非 foreground / 不一致 / flag 無しを除外し、25 件受理で count 25・保持 20、入力 object の後続変更が保存済み観測へ漏れないことを確認した。
- `tsconfig.app.json` と compiler host の読み取り置換で、実ファイルを書かずに変換済み `GrowingWorld.tsx` と `LiveUse.tsx` を semantic typecheck。診断 0、emit 無し。
- 上記は計測部品の検査であり、実住人の H 利用証拠ではない。
