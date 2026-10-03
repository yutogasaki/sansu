# PWA Release Runbook

2026-09-29: 住人の招待を保存版21へ統合。新規所有者はぽこもこ1人から開始し、既存所有者は3人を保持する。切替境界と版21を同じtransactionで保存し、版20以下の旧writerを拒否する。復旧も版21互換reader/writerを残してFantasyのみfalseで再buildする。旧deployment・Life OFF・DB削除は使わない。版20からの実SW更新、途中切断・再接続、同じ学習のoffline再開は[統合検証](../design/2026-09-29-island-community/README.md)を参照。以下の日付付き旧手順は当時の履歴。

2026-09-27: 幻想の庭の家庭内公開はIsland/Life/Discovery/Fantasy=true、Life preview/NatureTown=false。Life版20と食料・土の切替を同時に保存する。以前のdeploymentやLife OFFへの切替は今回のrollback手順に使わない。復旧時は今回の版20互換reader/writerを残してFantasyのみfalseで再buildし、同じDBと所有・学習を保持する。公開先のversion.jsonと実庭candidateを照合する。過去のPark公開flagの例は履歴。

2026-09-11: 家庭内利用のユーザー承認により、main配信は `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true` を使用する。新しい島は `SansuIslandLifeV1` に空の所有物から開始し、学習記録は保持。時間送りは本番で無効。新島のみ戻す場合は `VITE_ISLAND_LIFE_ENABLED=false` で再配信し、保存DBを削除しない。採用仕様は[48](../product/48_island_life_spec.md)、統合版の検証は[main release](../design/2026-09-10-island-life/main-release/README.md)。

> 2026-09-09: 遊園地は公開終了。旧BuildPlay/renderer flagは再有効化しない。公開版では `park.enabled=false` / `park.renderer=retired` と一覧からの除去、旧 `/park` のホーム復帰を確認する。以下の旧遊園地の公開・復帰手順は適用しない。

## When To Use

- PWA update behavior changed
- Deploy settings changed
- Release candidate needs update/reload verification

## Preflight

- 本番 `https://sansu-seven.vercel.app` はGitHub `yutogasaki/sansu` のmainからVercelへ自動配信する。現行 `vercel.json` のbuildCommandは `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true VITE_ISLAND_LIFE_DISCOVERY_ENABLED=true VITE_ISLAND_FANTASY_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=false VITE_NATURE_TOWN_ENABLED=false npm run build`。保存版21、実庭 `living-fantasy-garden-v2`、学習 `pokomoko-pop-live-v8` を実画面と照合する。
- classic回帰用buildは別の出力先でIsland/Life/Discovery/Fantasy/BuildPlay/NatureTownをfalseにし、配布artifactと混同しない。現行の復旧方法は冒頭の版21互換手順を使い、旧Parkを再有効化しない。
- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run assets:check`（`build`にも含まれる。原因切り分け時は単独実行）
- `npm run e2e:smoke` when release-sensitive flows changed
- `npm run e2e:pwa-update` for protected-route or checkpoint changes（先にproduction buildが必要）

## Files To Review

- `src/pwa.ts`
- `vite.config.ts`
- `public/manifest.json`
- `public/_headers`
- `vercel.json`
- `tools/asset-policy.mjs`
- `tools/check-asset-budget.mjs`
- `docs/design/README.md`

## Checklist

- `version.json` is generated in build output
- `version` はbuildごとに一意、`revision` はsourceのGit SHA。同じrevisionでも再ビルド時のversionが変わり、埋め込み `__APP_VERSION__` とmanifestが一致することを検証する。Island/Life/Discovery/Fantasy=true、Life preview/NatureTown=false、Life saveVersion=21と実画面のcandidateを確認する。Parkはretiredのまま保持する。
- `sw.js` is generated in build output
- `index.html`, `manifest.json`, and `sw.js` are not strongly cached on supported hosts
- `updateViaCache: 'none'` behavior is still intact
- 表示中は最大60秒間隔で確認し、起動・復帰・再接続・フォーカス・pageshow・SPA内の画面遷移でも確認する
- SW更新通信と版確認は独立し、版確認/復旧用HTMLの取得は本文を含め10秒で打ち切る。SWのactivatedだけで先走らず、controlling後に一度だけreloadする。
- 版差の復旧はオンライン/表示/保存保護をHTML取得の前後で確認する。`__app-update`付きURLをnavigation fallbackから除外して最新HTMLを取得し、登録解除やcache削除は行わない。失敗時は次の復帰/再接続/定期確認で再試行する。同じ版への復旧はsessionStorageでタブ内1回に制限する（storage利用不可時は通常確認を継続）。
- `/onboarding`、`/study`、`/explore`、`/battle/play` は、子どもがまだpointer/key操作をしていない初回表示ではversion driftのreloadを許可し、操作後の同一セッションだけを保護する
- Studyの回答/テスト保存、Exploreのrun開始/回答/帰還保存が進行中は、route遷移後もreloadを待機し、全critical persistence解放後にだけ再開する
- 島の読み込み・失敗画面で遊べない間は、タップを理由に更新を止めない。Growingの同期は旧島の読み取り・Workerでの計算・島/贈り物を照合する短いtransactionに分け、更新holdは書き込みだけに置く。読み取り準備は120秒で打ち切り、遅い結果を保存へ渡さない。15秒の55%待機で現れる再起動ボタンは最新HTMLの取得後に開き直す。保存中/オフラインでは開き直さない。検証は `SANSU_OPENING_URL=<固定production preview> SANSU_OPENING_OUTPUT=<新しい出力先> node docs/design/2026-10-04-island-opening/browser-check.mjs`。実DBのupgrade阻害、Worker無応答、学習保持、ChromiumのSW offline再起動/回答を検査し、実iPadの起動確認とは分ける。
- React RouterのSPA遷移をnative `hashchange` に依存せず観測し、保護対象画面から離れると延期中の更新を一度だけ適用する。別の保護対象画面へ移った場合も最初の操作前に更新できる
- Exploreのreplay、Battleのcancel/replay、Study breakのcontinueを選んだ時点は、同一URLでも新しいセッションとして再armする。結果・報酬・休憩が表示されただけではreloadせず、Studyの結果遷移はsession/profile保存完了より後に行う。replay/continueのpointerは新しいactive sessionの最初の保護操作として残す
- PWA precacheが12 MiB以下で、探索本番画像の合計が8 MiB以下・1枚800 KiB以下である
- `raw / concept / draft / comparison / visual-tests` がprecacheへ入っていない
- 探索本番画像は原則 `public/assets/explore/<encounter-id>/scene-*`、制作入力は `docs/design/` に分離されている
- 既存探索のdefaultは `snap-root-v1` とし、buildの `version.json` が探索用delivery `snap-root-v1` / visualLineage `pokko-field-v1` を返すことを確認する。遊園地の公開設定は別の `park` フィールドと実stage属性で確認する。`classic-v1` は旧マキモドンから別rendererへ切り替わる既知のmixed-lineage FAILのため探索のrollback先に使わない。現行探索production assetはcold-open `dig-pop-carry-bloom-v3` と後続 `firefly-stumble-bloom-painted-v5` の実runtime URLだけをprecacheし、旧編み根、旧landed、一本葉を引く版、水やり版、旧firefly v4をコード参照とprecacheから外す。探索の新assetが未実装、旧assetが参照中、因果・身体完全性のmanual gateが未記録、またはcritical pathにvisible legacy / mixed lineageが1件でもあれば探索releaseを止める。保存済みactive runのopening IDは途中で差し替えない。制作sourceは `docs/design/` からprecacheへ混ぜない

## Manual Verification

1. Open the installed PWA or browser app.
2. Confirm the current version/build is loaded.
3. Deploy a new build.
4. Refocus, reopen, or go online again.
5. Confirm the app picks up the new version without a manual cache clear.
6. Scenario A（fresh old build → new build）: repeat from each protected route (`#/onboarding`, `#/study`, `#/explore`, `#/battle/play`); do not interact and confirm the new build reloads.
7. Scenario B（fresh old build → new build）: interact with one protected route, confirm the update does not interrupt it, then leave for a safe route and confirm exactly one reload at the destination.
8. Scenario C（fresh old build → new build）: interact with protected route A, then use an actual in-app React Router action to enter protected route B. Confirm exactly one reload before B's first interaction and confirm the destination is preserved.
9. Scenario D（fresh old build → new build for each case）: verify same-route checkpoints independently at Explore replay, Battle cancel/replay, and Study persisted break/continue. Confirm the result/reward/break remains visible, no reload happens before persistence or the child's next action, and exactly one reload follows that action.
10. Run `npm run e2e:pwa-update`; confirm a real `version.json` drift causes exactly one reload, and that safe/protected Router handoffs, delayed recovery, and the same-route Battle checkpoint pass without `hashchange` or duplicate reloads.
11. On iOS, repeat relaunch/update timing because activation can lag behind Chromium.

ローカル二build回帰は `npm run e2e:pwa-two-build`（`verify:release`にも含む）。既定はclassic flagで2回buildし、`output/pwa-two-build-*`へ保存する。固定buildを使う場合は `SANSU_PWA_OLD_DIR=<旧build> SANSU_PWA_NEW_DIR=<新build>` を両方指定する。同じsourceでも別buildのversionを用い、実SW更新と、SW配信停止/ネットワーク復旧を分けて確認する。実装根拠: [Workbox lifecycle](https://developer.chrome.com/docs/workbox/modules/workbox-window)、[navigation fallback](https://developer.chrome.com/docs/workbox/modules/workbox-build#type-GenerateSWOptions)。

実際の公開二ビルド監査には、公開前に `SANSU_PARK_LIVE_URL=https://sansu-seven.vercel.app node tools/e2e-park-live-update.mjs` を起動する。専用ブラウザのテストプロフィールで旧版をSW制御下・offlineに保持し、公開後に新しい40桁のGit SHAを標準入力へ渡す。オンライン復帰による自動更新、保護中フォーム、1回のreload、IndexedDB/localStorage保持、公開Three.jsを確認する。実機検証とは区別する。

電源OFF、OSによる停止、オフラインの端末をサーバー側から即時更新することはできない。オンラインでの次回起動・復帰時に確認し、入力や保存中は安全なcheckpointまで待つ。強制更新のためにプロフィール、学習履歴、作品を消す運用は行わない。

## Rollback Clues

- If updates stop arriving, inspect cache headers first.
- If the browser sees a new build but the app does not reload, inspect `version.json` and service worker registration.
- If only iOS is delayed, record that separately before changing shared logic.
