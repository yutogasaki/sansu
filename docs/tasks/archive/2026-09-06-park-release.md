# Three.js park production release

2026-09-06の追加ユーザー依頼: 本番公開し、PWAを新しい版へ自動的に切り替える。

## Scope

既存のThree.js実装・fallback・学習保存契約を公開する。Vercel buildCommandに有効flagを指定し、同一コミットの再ビルドも識別できるPWA versionを生成する。既存の安全なcheckpointとcritical persistence保護を維持する。

## Verification

完了。verify:release、park/PWA回帰、offline、公開版のThree.js・cache headersを確認してPASS。Vercel Production READY、GitHub CI success。実本番旧版から新版へonline復帰後19.8秒で自動更新し、設定画面/保護フォームとも安全な時点でreload 1回、データ保持を確認した。

公開revision `f70d96797f63ff4f8a4ce78c1ea1c9e540529d78`。実績と画像・JSONは [公開監査](../../design/audits/2026-09-06-park-release/README.md)。

## Known gaps

ユーザーは前ターンの未確認事項を報告した後に公開を依頼した。独立美術承認、子どもの無説明観察、実機iOS/AndroidとSafariは未実施として残す。Vercel connectorはteamなし、ローカルCLI tokenは無効。既存のGitHub main→Vercel production連携を利用する。

- Review By: 2026-09-13

## Docs To Touch

01/22仕様、PWA release runbook、Three.js runtime、wiki memory、完了記録。
