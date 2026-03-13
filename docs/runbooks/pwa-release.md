# PWA Release Runbook

## When To Use

- PWA update behavior changed
- Deploy settings changed
- Release candidate needs update/reload verification

## Preflight

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm run e2e:smoke` when release-sensitive flows changed

## Files To Review

- `src/pwa.ts`
- `vite.config.ts`
- `public/manifest.json`
- `public/_headers`
- `vercel.json`

## Checklist

- `version.json` is generated in build output
- `sw.js` is generated in build output
- `index.html`, `manifest.json`, and `sw.js` are not strongly cached on supported hosts
- `updateViaCache: 'none'` behavior is still intact
- App still reloads after version drift or service worker activation

## Manual Verification

1. Open the installed PWA or browser app.
2. Confirm the current version/build is loaded.
3. Deploy a new build.
4. Refocus, reopen, or go online again.
5. Confirm the app picks up the new version without a manual cache clear.
6. On iOS, also test relaunch behavior because update timing can lag.

## Rollback Clues

- If updates stop arriving, inspect cache headers first.
- If the browser sees a new build but the app does not reload, inspect `version.json` and service worker registration.
- If only iOS is delayed, record that separately before changing shared logic.
