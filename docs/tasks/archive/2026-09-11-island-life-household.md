# 暮らす島を家庭内の本番で使う

- Review By: 2026-09-18

## Goal

本番投入の最低限を整える。ユーザーは家庭内利用で所有物リセットを承認。学習記録は保持し、旧所有物の移行や新しい美術制作は含めない。

## Plan

本番flag、独立した空所有物の保存先、DEV時間送りの除去、PWA保存保護、プロフィール削除を実装。固定したproductionで実学習→購入→reload/offline、coreと既存回帰を確認する。

## Docs To Touch

憲章、仕様01/48、verification matrix、家庭内本番の検証記録。

## Verification

core3,484とsmoke31、production2幅、classic PWA4、実2build更新PASS。速度80run（eligible/pass=true）と旧島の回帰もPASS。最新固定入力と実画面は[家庭内本番の記録](../../design/2026-09-10-island-life/household-production/README.md)。共有indexは変更せず、commit/push/deployは未実施。
