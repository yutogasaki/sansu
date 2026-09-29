# 家に直接入る導線の復元

2026-09-29。幻想の庭の統合時に、家overviewを外観だけの画面へ置き換えていた。ナビの「いえ」と庭の「いえへ」から既存の閉じた室内へ直接入る挙動に戻した。既存の床歩行・棚・アルバム・写真・家からの学習と復帰を使う。庭、ぽこもこの造形、保存版21、学習ロジックは変更していない。

[実画面](index.html) / [対象buildとsource](build.json) / [初回からの旅程](community.json)

## 対象と検証

ローカルproduction preview http://127.0.0.1:5450/#/island。Island / Life / Discovery / Fantasy有効、Nature Town / Life Preview無効。build.jsonのversionとsourceHashで固定対象を識別する。家candidateは house-world-first-v1、室内cameraは island-home-interior-v5。共有checkoutの検証であり、別作業の未commit LearningProgressCards.tsx も含んだ。今回のcommitにはその変更を含めていない。公開結果は後段に別記し、共有buildの全入力が独立commitと一致したとは扱わない。

- [verify:core](core.txt): lint/typecheck、484 files / 4,293 tests、build/assets/docs PASS。
- [classic smoke](smoke.txt): 31ケース PASS。
- community: 390×844通常motion / 768×1024 reduced motion。実初回3問→花/水ばち購入→来訪/招待→昼夕夜の庭から入室→室内再読み込み→SW offlineの庭/室内→同じ次問への復帰/回答。学習正本・所有action・仲間の保持とpageerror 0を確認。開始/終了のappとdist hash一致。
- [室内操作](room.json): 両幅で床タップ・キーボード歩行・画面内の移動境界・実物アルバムのタップ・写真・棚・メニューのfocus復帰・家から学習して同じ予約の室内復帰を確認。nativeプロフィールfixtureであり、実獲得と混ぜない。最初の診断実行は学習を閉じた後に庭を待つ誤ったハーネスを中断した。既存の室内へ戻る契約に合わせて修正した後の両幅結果を掲載。

## 判定の範囲

- 美術: 元の室内の家具・色・カワウソの描画を復元。[以前の室内](../audits/2026-09-09-house-edges/390-house-empty.png)とも照合し、同じ棚・ソファ・テーブル・鉢とキャラクターを確認（周囲のUIは当時より更新されている）。庭の美術を室内へ新たに描き直した変更ではない。
- 理解/安全: 入室・退出・メニュー・学習復帰を実操作で確認。子どもの無説明理解と実機評価は未実施。
- Runtime: 上記の固定buildで通過。旧島の全成熟・全機能PWA・fixed-tenを再実行した証拠ではなく、入室と影響経路の回帰確認。保存schema/PWA更新実装に変更なし。

## main / 公開

実装修正は main ea08a6ca73a3e2efe308e55e5201d808777e24c9 としてpush済み。公開 version.json が同revisionを返すことを確認。[公開版の検証](public-room.json)は390×844 / 768×1024ともPASS。床タップ・キーボード移動・実物アルバム・写真・棚・メニューfocus・同じ予約の学習/室内復帰、pageerror 0を確認。各captureのroot revisionが修正commitと一致。GitHub Docs Checkは成功、Verify Coreは記録時点で実行中。ローカルcoreとは区別する。
