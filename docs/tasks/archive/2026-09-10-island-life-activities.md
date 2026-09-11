# 住人の活動と配置の違い

- Review By: 2026-09-17

## Goal

ユーザーの「すすめて」により、既存回帰3件の解消と仕様48の花/ブランコ/ベンチによる自律活動・配置差を実装する。公開・経済確定・全コンテンツ追加は別段階。

## Plan

1. 保存した失敗のDOM/経路からアプリと検査を切り分ける。
2. 数字のみの連続入力を正しく測り、現在の実メニュー操作で既存回帰を通す。
3. 実際に座る/揺れる/花を見る活動と、好み・ぽこもこの所在・地区による利用差を追加する。
4. 旧試作の残高を保持し、固定候補でdomain・core・両幅の実画面・回帰を確認する。

## Docs To Touch

仕様48、検証matrix、実画面runtime-v2、月次完了記録。

## Verification

既存island/PWA/fixed-ten、domain旧版継続・個性/配置比較、描画の接地・接触、新しい島の通常学習から両幅一周、core/smoke。最終アートと子どもN=0は区別する。

## 2026-09-10 実装状況

ユーザー追加の、新規購入に気づく !/?、好きな場所の ♪ と小さなジャンプも実装。置いた後は景色へ戻る。旧試作切替・時計巻戻しの同時刻境界、空席の公平な順番、ブランコの頭/耳のクリアランスを修正。

最終活動入力は `/tmp/sansu-island-life-final-v2b`、hash `812edf6a957f6dfc6c8f4e4f9a31dea99cc8a16112c9dcac3f949892c35e5726`、DEV試作 `http://127.0.0.1:5241/`。core 3,464 tests、新島2幅の実学習一周がPASS。既存回帰は `/tmp/sansu-island-life-final-v2`（a8fc5bb…）でisland11/smoke31/classicPWA4/IslandPWA8+実offline/production guard PASS。差はDEVのスクロールと観測QAの3ファイルだけで、別版として証拠を保持。

固定10問80走行はv2bの試作OFF `http://127.0.0.1:5242/`、`source-legacy.json`を指定。出力 `/tmp/island-life-v2-final/throughput.json`、ログ `/tmp/island-life-v2-throughput-final.log`。80走行がPASSし、runtime-v2へ集約済み。

証拠作成先 `docs/design/2026-09-10-island-life/runtime-v2/`。レビューHTMLとcontact sheetは作成済み。既存のv1証拠は変更しない。共有indexへstage/commit/pushはしていない。

## Result

今回のDEV実装と指定回帰は完了。正式80runもeligible/PASS。視覚HOLD、子どもN=0、本番移行/経済は対象外の後続。[検証と実画面](../../design/2026-09-10-island-life/runtime-v2/README.md)。
