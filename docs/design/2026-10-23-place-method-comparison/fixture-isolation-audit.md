# 拡張比較fixtureの保存隔離・カメラ監査

2026-10-22 UTC。読み取り専用コード監査。runtimeファイル・通常DB・UIは操作していない。対象は `trialScene=expanded` を付けてページを新規読込し、通常の地形編集・配置・利用を行う経路。story/share/visit/学習画面を操作しないという今回の運用を前提にする。

## 結論

**今回の限定経路には実島を書き戻す到達可能な呼出を見つけなかった。** ただし現状の画面全体を「全操作がメモリ内のみ」「repository read/writeなし」と表現するのは広すぎる。通常hookの外に、実DBへ花を送る経路と実DBを読むパネルが残る。

## 地形・配置・利用の経路

1. 試験Viteの `GrowingIsland.tsx` import置換は一箇所一致を要求し、`useGrowingIsland` を `useComparisonIsland` に置き換える。
2. `TrialIsland.ts:19` は実hookを `active && !fixture` で呼ぶ。fixtureではfalse。実hookのopening read/full sync、15秒timer、visibility sync、BroadcastChannelの各effectはactive guardで登録されない。実hookのdispatch/sync自体にはactive guardがないが、fixtureの返却値にはそれらの実callbackを露出していない。
3. fixtureのdispatchは `applyIntent` → `current.current` とReact state更新のみ。repositoryの `commandGrowingIsland` を呼ばない。地形edit/undo/redo、place/move/store/unstore、通常expandとガイド内dispatchもこの経路。
4. `acknowledgePlace` は同じメモリdispatchへ入り、place-used/place-shown/shared-playも実DBを呼ばない。syncはno-op、通常achievement acknowledgeはfalse、sailは拒否する。
5. `GrowingWorld` のcamera sessionViews、seedBadge、LiveUseはmodule-localのMap/変数であり、localStorage/IndexedDBへの保存ではない。

メモリfixtureが `applyIntent` を実行したことと、通常repositoryのrevision競合・永続化・再読込に成功したことは別。fixtureの利用受理は前者と描画後receiptの証拠に限る。

## 直接repositoryを使う残存経路

| 経路 | 実際の作用 | 今回の限定操作での到達 |
| --- | --- | --- |
| `GrowingIsland.tsx:510` `leaveFlower → sendFlower` | `growingDb.gifts` のrw transaction / put。実profileIdの送付記録を作る | visitへ入らない限り到達しない。ただしfixtureにguardなし |
| `GrowingIsland.tsx:272` 自動 `addMoment` | momentsへadd、上限超ならdelete | fixtureのrevealは常にundefinedでpendingPictureが立たず、新規読込からの通常操作では到達しない |
| showChoiceのstory | listMomentsで実島とmomentsを読む | story操作時のみ |
| showChoiceのvisit / startVisit | profiles・他島・当日gift記録を読む | visit操作時のみ |
| VoyageChart | listVoyageIslandsでislands/archivedIslandsを読む | 海図を開いた時。sailはfixture側で拒否 |
| TracePanel | getProfileで実学習済み語彙を読む | なぞるパネルを開いた時。旗の変更自体はメモリdispatch |
| カード保存 | saveImageでファイルdownload | 明示的なカード保存操作時。DB保存とは別の外部出力 |

実hookの未完了syncはactive=falseに切り替えても中断されない。今回のfixtureリンクは通常の`<a href>`で文書を再読込するため、元ページのReact hookをそのまま切り替える方式ではない。将来history APIでqueryだけを書き換える方式にすると、既に走っていた実syncが後から完了する可能性がある。現行fixtureの新規読込からの操作にはこの経路を認めない。

## 最小の修正提案

本体sourceを変更せず試験Vite側で、fixture中だけ以下をguardする。

- `leaveFlower` の先頭で拒否。これが現在の直接DB書込経路を閉じる最小の対策。
- 自動addMoment effectにfixture early return。今はreveal undefinedで不活性だが、hook実装が将来変わっても保存しないことを直接保証できる。
- 「repositoryを読まない」まで保証するならstory/visitへの入口とVoyageChart/TracePanelをfixture中は開かない。今回は操作範囲外なので、書込防止の必須変更とは区別する。
- `TrialEvidence.tsx:21` はtrialEvidence queryがないとfixture bannerも消す。`trialScene=expanded` のbannerを独立して常時表示する。現在の「操作は保存しません」は上記guard前なら「地形・配置・利用の試験操作は保存しません」と限定する。

別のプロフィールへの切替ではfixture stateのuseState initializerは再実行されず、recordのprofileIdも最初のままになる。通常操作のDB隔離を破るものではないが、比較中にprofileを切り替える使い方は今回の証拠範囲外とする。

## A/F/Hの比較カメラ

`comparison-camera.ts` はterrain方式を読まず、同じ固定position/quaternion/scale、near=.1、far=100、同じaspectからfrustumを設定する。`trialScene=expanded` の時は全方式とも `half=1.8/.11397398623138763`。したがって**同じexpanded fixture・同じviewport・trialCamera=fixedのA/F/H比較**には正当な共通カメラ条件である。1.8はどれかの方式だけを小さくする処理ではない。

通常30区画では係数1、拡張96区画では1.8なので、両者を並べて「同じ縮尺」とは呼べない。拡張時の1world単位の画面サイズは通常時の1/1.8。A/F/H間の同一viewportでも描画物全体の収まりを自動保証するわけではなく、クリップやUIによる隠れは実画面で確認する必要がある。

固定カメラはframeCameraの冒頭から返るため、通常のview.zoom/azimuth/pan、自動focusによるview変更を描画に反映しない。候補ごとのauto-fitも走らない。GrowingWorldの通常カメラはcamera.zoomを変更しておらず既定1なので、別方式だけzoomが残る経路も見つからなかった。カメラ固定時の地形・ownerの見かけの位置差は同じ座標変換を受けた形状差であり、自動framing差によるものではない。

## 監査版SHA256

```text
TrialIsland.ts       892e4c5027b7353798dffd42f6823716f630b2427d56f0a4438a624d0f874f47
TrialEvidence.tsx    fba6b8d02ee8c264618da5bf0f42cbc567ff8e3a8819a2adb42b31c17f4fe5ef
trial vite.config.ts 12ad912517b986c0c359410a71c5880e89b0fe2eb8ea9f894e31ba3bde197e1c
comparison-camera.ts 298feab471b55419eb0629c41ad10391da5286823347771140d14d5f11c59428
GrowingIsland.tsx    c8d785cd7fc937226a31fad408a4ac71a31b33c43776102670e8afce7001d406
useGrowingIsland.ts  e43a07498d2f36c19b8dd71ce007e89b411f5d2ad5b4e00c2ba18e8f61453e1b
```

この監査はアプリ全画面・PWAキャッシュ・他タブ・DB schema upgradeを含む全I/Oゼロの保証ではない。今回の比較操作から実島保存へ至るコード経路の限定監査である。
