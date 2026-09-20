# 家の写真保存がWebKitで失敗する問題

- Date: 2026-09-20
- Owner: Codex
- Status: Awaiting real Safari confirmation — Playwright nonpersistent WebKit fails; persistent WebKit profile passes
- Review By: 2026-09-27
- Related SSOT: `docs/product/43_island_navigation_spec.md`, `docs/product/48_island_life_spec.md`

## Goal

Safari/WebKitで家から撮った写真を、画面に示された再試行の手順でアルバムへ保存できるようにする。失敗する場合は、実画面、画像の符号化、IndexedDB transactionのどこで止まるかを切り分け、元写真と学習状態を保持する。

## Evidence

[2026-09-20家UI/カメラ監査](../../design/audits/2026-09-20-house-camera/README.md)で公開版およびカメラ変更前ビルドの両方にてWebKitの写真保存が待ち時間超過。PNG previewは作成され、保存writerは変更していない。Chromiumの保存は成功。既存の失敗記録：`photo-current-webkit-report.json`、`photo-before-camera-report.json`。

## Next

## Diagnostic result — 2026-09-20

The earlier report did not distinguish Playwright's in-memory WebKit context from a persistent browser profile. The current published target (`0e4b62cc91b366d52b42a2280ef8e209757f9459`, delivery `mystic-island-v1`, candidate `mystic-island-shore-garden-v18`) was retested at 390×844 through the updated house → photos → camera flow with a fresh temporary profile.

- `webkit.launch()` + `browser.newContext()` (nonpersistent): scene PNG and metadata hashes are produced; `islandPhotos.add` succeeds; `islandPhotoBlobs.add` fails with `UnknownError: Error preparing Blob/File data to be stored in object store`; IndexedDB transaction aborts and UI leaves retry available.
- `webkit.launchPersistentContext()` with a new temporary user-data directory: the same route saves the original canvas-produced blobs; both image and metadata rows commit and UI reports saved.
- Reconstructing each image as a new Blob from its ArrayBuffer did not make the nonpersistent context succeed. No application/storage code changed.
- This WebKit error wording matches reports in [WebKit bug 188438](https://bugs.webkit.org/show_bug.cgi?id=188438), including reports in 2026. That supports a browser storage-mode lead; it does not prove that ordinary Safari or an installed iOS PWA fails.

## Remaining external confirmation

Use real Safari in a normal persistent profile and, if possible, installed iOS PWA. Confirm capture, save, gallery reload, offline read and same-learning-reservation recovery. Until then, keep the application implementation unchanged and treat the Playwright nonpersistent-context failure as a harness-specific limit. If real Safari reproduces it, reopen a focused implementation task with the iOS version and storage mode recorded.

## Boundaries

- 原因未特定の段階ではtransactionの形、blob上限、再試行契約を推測で変更しない。
- 写真の失敗で既存アルバム・学習記録・プロフィール所有権を失わない。
- 画面の写真previewが見えることだけで保存完了としない。

## Verification

- 再現は実装と同一の固定版・実WebKit・空の一時profileで記録する。
- 修正時は `docs/ai/verification_matrix.md` の写真/保存/WebKit該当要件を使う。IndexedDB書込み結果と実UI結果を両方照合する。
- 原因がproductionとPlaywrightの違いに限られる場合、未解消として記録してユーザー向けの保存エラー導線を維持する。
