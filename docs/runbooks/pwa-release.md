# PWA Release Runbook

## When To Use

- PWA update behavior changed
- Deploy settings changed
- Release candidate needs update/reload verification

## Preflight

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
- `sw.js` is generated in build output
- `index.html`, `manifest.json`, and `sw.js` are not strongly cached on supported hosts
- `updateViaCache: 'none'` behavior is still intact
- 表示中は最大60秒間隔で確認し、起動・復帰・再接続・フォーカス・pageshow・SPA内の画面遷移でも確認する
- App still reloads after version drift or service worker activation
- `/onboarding`、`/study`、`/explore`、`/battle/play` は、子どもがまだpointer/key操作をしていない初回表示ではversion driftのreloadを許可し、操作後の同一セッションだけを保護する
- Studyの回答/テスト保存、Exploreのrun開始/回答/帰還保存が進行中は、route遷移後もreloadを待機し、全critical persistence解放後にだけ再開する
- React RouterのSPA遷移をnative `hashchange` に依存せず観測し、保護対象画面から離れると延期中の更新を一度だけ適用する。別の保護対象画面へ移った場合も最初の操作前に更新できる
- Exploreのreplay、Battleのcancel/replay、Study breakのcontinueを選んだ時点は、同一URLでも新しいセッションとして再armする。結果・報酬・休憩が表示されただけではreloadせず、Studyの結果遷移はsession/profile保存完了より後に行う。replay/continueのpointerは新しいactive sessionの最初の保護操作として残す
- PWA precacheが12 MiB以下で、探索本番画像の合計が8 MiB以下・1枚800 KiB以下である
- `raw / concept / draft / comparison / visual-tests` がprecacheへ入っていない
- 探索本番画像は原則 `public/assets/explore/<encounter-id>/scene-*`、制作入力は `docs/design/` に分離されている
- production defaultは `classic-v1` とする。旧編み根版 `snap-root-v1` の `prop-sheet.png`、`leaf-landed.svg`、旧landed pose、`nest-squash | nest-tip` は実機安全監査で50 / 100のREJECT、一本葉を引くBloom版も75 / 100のHOLDとなったため、active safety candidateやproduction assetとして扱わない。水やりBloomへ切り替えるreleaseでは、全身相棒、全身の根生物、触られない葉冠、閉じた花、開いた花、青いじょうろ、水滴の実runtime URLだけを個別globへ追加し、旧編み根・旧landed・引っ張る一本葉assetをコード参照とprecacheの両方から外す。新assetが未実装、旧assetが参照中、または因果・身体完全性のmanual gateが未記録ならreleaseを止める。`root-pull-v1` / `root-pull-v2` の既存画像も比較用presentationとして当面precacheへ残す。制作sourceは `docs/design/` からprecacheへ混ぜない

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

## Rollback Clues

- If updates stop arriving, inspect cache headers first.
- If the browser sees a new build but the app does not reload, inspect `version.json` and service worker registration.
- If only iOS is delayed, record that separately before changing shared logic.
