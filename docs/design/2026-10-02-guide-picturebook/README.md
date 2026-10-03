# あそびかたの6点をポップなデフォルメへ

最新は[自己レビュー後のv6](review-v6/README.md)。以下はv5の制作・検証履歴。v5の「同じ表示範囲に収める」は320×640の実画面では未達だったため、v6で修正した。

2026-10-02。ユーザーの「絵が微妙」「他のも含めて一気に改善して」「もっとポップでデフォルメじゃない？」に基づくローカル実装。田園風の水彩案を外し、大きな葉・膨らんだ屋根・太い道具、大きな水玉、ターコイズ/黄/コーラルの色面へ変更した。入居・成長・色替え・配置替え・演奏会・拡張の全6点を本、候補一覧、目標、達成通知へ反映。commit/push/公開は行っていない。

[6点の実画面](six-invitations.jpg) · [スマホの記念](390-memory-A2.png) · [320幅](320-memory-A2.png) · [768幅](768-memory-A2.png) · [家の本](house-book.png) · [本番形式のoffline](production-offline-memory.png) · [起動から学習への接触シート](contact-sheet.jpg)

## 表現と記録の境界

- 挿絵は遊びを表す共通のイラスト。本人の島の写真ではない。ぽこもこや既存住人を生成画像で置き換えていない。
- 記念には「あのときの すがた」を添え、既存の島モデルへ固定snapshotの種類・成長段階・屋根色・住人の外見を渡す。現在の色や成長で過去を書き換えない。土地は記録された広さだけを模型で表し、記録されていない昔の建物を捏造しない。
- 模型は短いバッチで一時rendererを使ってPNG化し、GPU contextを解放する。静止画像cacheは32件上限。WebGLや読込失敗は記念の保存・本文・次の操作を妨げず、未保存の対象を代用しない。
- 一般の挿絵は6点合計130,634 bytesのWebP（720×480）。Viteのinline assetとしてアプリchunkへ含めるため、新規runtime画像fetchやPWA設定変更を加えず既存JS precacheでofflineへ運ぶ。
- 本は最大高さ76%、大きな絵はphoneで190pxまで、候補はphone2列。大きな色付きカードを外し、絵・本文・主操作を同じ表示範囲に収める。画像内にUI文字を焼き込まない。

北極星では「くふう」の入口と「愛着」の記念を支える。仮説は、小さい候補でも形を見分け、試してみたいと感じられること。学習/経済/保存形式/達成判定/キャラクターの同一性は変更なし。詳細の正本は[スターターとアチーブメント仕様](../../product/island-starter-achievements-proposal.md)。親仕様01、保存ADR、wiki memory、runbookの規則は変更不要。

## 実画面の対象

- DEV: `http://127.0.0.1:5260/#/island`、320×640 / 390×844 / 768×1024、Island/Growing=true、Life preview/Fantasy=true、候補 `guide-pop-toys-v5`、世界 `growing-island-v1`。768はreduced motion、プロフィールfixtureは音off。
- 本番形式: `http://127.0.0.1:5261/#/island`、390/768幅、Island/Growing=true、production DB、実SW制御。version `development-local:4aa20cf7-31cd-4715-927a-9b1a70f59254`。Git基点は `7116c95f`＋今回の変更。`development-local`だけで固定版を証明せず、下のreportでsrc/public/config（productionではdistも）の開始終了hash一致を確認した。
- [UI report](ui-report.json): 3サイズ、48撮影。全6種類の案内/記念、別々のsnapshot模型、閉じる/Escape、次の操作への到達、横overflowなし、学習保存不変と復帰。記念を直接用意した明示fixtureであり、実獲得の証拠とは分ける。
- [家 report](house-report.json): 390/768、直接の本/メニュー入口、家に戻る、目標/他タブの記念更新、通常3問への復帰。
- [production report](production-report.json): 390/768、実初回設定、実回答5問、無料家/通常種の配置、旗の色、家の本、実SW offline再起動/回答/記念。fixture書込なし、sourceStable=true。

## 検証

- [core](core.log): docs/現行入口/lint/typecheck、520 files・4,606 tests、build/assets PASS。`VITE_GROWING_ISLAND_ENABLED=true npm run verify:core`。PWA precache 9.00 MiB / 12.00 MiB。
- [focused](focused.log): 対象10 testsとtypecheck PASS。固定の青いテントと現在の桃色の家、記念の旗色、実住人の外見、保存された土地比率、6種類の絵を確認。
- 初回coreは旧SVGのfill文字列を期待した本のSSR検査だけが失敗。DOMで記念の旗色を確認し、実モデルの色と段階は模型の検査へ分離して、最終coreで全件PASS。
- [家の初回診断](house-loading-diagnostic.json): accessible nameが同じ読込overlayを本と判定し、Escapeを早く送った。検査を実際のbook classとfocus完了待ちへ修正し、別出力で両幅PASS。アプリの閉じる挙動を変更していない。
- 既存の文書期限warning、Fast Refresh warning、Browserslist/glob warningはcore logに残す。

## 独立した評価

- **見た目**: 6点の色面・デフォルメ・水玉の統一と実モバイルcropを確認。田園風案は不採用。今回の最終候補に対するユーザーの好みの確認は未取得で、テスト合格を美術の承認としない。
- **無説明理解・安全**: 文字と操作を残し、音off/reduced motionで使用できる。子どもの無説明理解・再訪の観察はN=0。とくに配置替えの静止画から「移動」を読み取れるかは未検証。
- **動作**: 上記local DEV/production旅程はPASS。公開先、実iPhone、実two-build更新、GPU負荷/電池、学習速度の実測は別。今回の絵を公開済みと呼ばない。

[最終生成プロンプト](pop-prompts.md)。built-in imagegenを使用し、最初の成長の絵を参照画像として他5点を制作した。[不採用案のプロンプト](prompts.md)と縮小原画は比較履歴だけに残し、アプリassetとprecacheには含めない。
