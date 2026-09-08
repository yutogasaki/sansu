# Diff Review Report

## Findings

教科切り替えの変更について、修正が必要な回帰・仕様不一致は見つからなかった。全workspaceの別作業を含む公開認定ではなく、固定revision `9300ea0-subjects-880a65a8d2ec` の対象差分をレビューした。

- 既存の成長比較ボタンで一度だけクリック後の遷移が30秒以内に起きなかった。アプリ/検査条件を変更しない再実行で、同じ箇所とphone/tablet各25区間を通過した。原因は未確定で、原FAILのreport・画面を保存する。教科の希望UIとは別の導線であり、このタスクで無関係な修正やリトライ追加はしていない。

## Summary

- Safety: OK（対象差分）。新しい教科の選択は現在の予約がない場合だけ。希望保存はプロフィール/予約/更新版を照合する原子的な書込みで、回答・下書き・SRS・成長を変更しない。希望の消費も次予約と同一transactionに限る。
- Spec alignment: OK。仕様28の優先順、同一学習日の2区間上限、独力正解3回未満の初見候補、本人の次一区間希望を確認。2と3は設計値であり、研究による最適性を主張しない。
- Tone: OK。教科名と「つぎも やる」、チェック・pressed状態だけで任意操作を示す。教科の選択や回数を責めず、必須の選択画面を追加しない。
- Over-change: None（対象差分）。既存履歴処理を一箇所へ抽出し、plannerには省略可能な入力だけ追加。既存Parkの教科選択、単教科設定、旧予約を保持する。音声・成長・独力/SRSの他担当差分を維持した。

## Evidence

- `subjectSelection.ts`: 出題範囲/当日停止とDue資格を共通関数から取得。直近2予約だけを読み、学習日の境界、本人希望の予約ID、明示的な独力証拠を確認する。ログや記憶を書き換えない。
- `subjectPreference.ts` / `repository.ts`: stale操作/別プロフィール/終了済み予約を拒否し、同じ希望の再送は冪等。保存失敗では消費・学習更新を残さない。旧予約へ初見IDを推測追加しない。
- math/vocab planner: 短期の継続は最大1練習枠。Due/weak・誤答後の支援、範囲、当日停止、同一ID上限を守る。省略時に追加の乱数を消費しない。
- `IslandLearningPanel.tsx` / `IslandSubjectChoice.tsx`: `type=button`、44px以上、aria-pressed、フォーカス、既存の保存lockを使う。実UIで入力中の選択、Enterによる取消、再読込、保存abort/retry、希望消費を確認した。
- 最終のphone選択済み・tablet選択済み・英語画面を既存v4の学習面と見比べ、問題/キー/住民の階層と操作領域を確認。子どもの無説明理解や継続率は未観察。

## Verification Plan

追加修正は不要。verify:core、実UI6シナリオ、通常Island、classic smoke/PWA、Island PWAと固定10問の結果は同じ監査ディレクトリのREADMEに集約する。最終source照合とdocs:checkで閉じる。
