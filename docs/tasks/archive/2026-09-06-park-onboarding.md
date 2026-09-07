# Park onboarding entry correction

ユーザーが本番の旧ポッコ歓迎画面を提示した。Three.js本編だけでなく、未登録の初回表示も同じ遊園地へ揃える。前の公開依頼の修正として検証・再配信する。

## Scope

本編の2遊具・人形・空き位置とstageを静止表示へ再利用する。新しい美術方向やモデルは作らない。名前・学年・教科・開始範囲・profile保存の既存処理を保持し、初回から登録完了後の遊園地までを実UI操作で確認する。短い画面でも全学年を選べることを確認する。

## Verification

core/release、390×844・768×1024と小さいviewportの初回→名前→全学年→教科→登録完了→試遊、reduced motion、WebGL fallback、PWA保護中更新、本番の新規ブラウザで確認する。学習世界のモデル・動作・入力は未変更で、前候補の固定10問検証を参照する。

- Review By: 2026-09-13

## Docs To Touch

22仕様、runtime、監査、done log。独立美術・子ども観察・実機の未確認は継続。

## Completion

2026-09-06完了。公開revision `aa36adad7dcce77956a891e7917d6a29241ed83a`。verify:release、本番flag付きbuild、park PWA、本番で空のcontextから登録→試遊→学習を3viewportでPASS。旧実本番から新版へ自動更新し、入力・保存保持とreload各1回を確認。[監査](../../design/audits/2026-09-06-park-onboarding/README.md)へ証拠を保存した。実機・独立美術・子ども観察は未確認のまま。
