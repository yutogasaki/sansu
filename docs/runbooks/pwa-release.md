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
- App still reloads after version drift or service worker activation
- `/explore` が通常起動面でも、子どもがまだpointer/key操作をしていない起動直後はversion driftのreloadを許可し、操作後のrunだけを保護する
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
6. Repeat from `#/explore`: do not interact and confirm the new build reloads; then interact with a problem and confirm an update does not interrupt that active run.
7. On iOS, also test relaunch behavior because update timing can lag.

## Rollback Clues

- If updates stop arriving, inspect cache headers first.
- If the browser sees a new build but the app does not reload, inspect `version.json` and service worker registration.
- If only iOS is delayed, record that separately before changing shared logic.
