# 紹介ページ — 入り江の初期と村

2026-10-18 / `promotion-cove-growth-v4` / `website/`。利用者が比較画像の左案を選定したため、家1軒の島と3軒の村を仕上げた。効く柱は愛着とにぎわい。小さな居場所への愛着と、家々がつながる成長差を伝える。

[実表示のcontact sheet](contact-sheet.html) / [ブラウザー検証](runtime-final/report.json) / [版・入力hash・出典](source-evidence.json)。

## 内容と由来

- 初期：紫の大樹、赤い屋根の家、花の小道、桟橋。
- 村：大樹と赤い屋根の家を目印に、青とピンクの屋根、入り江の橋を追加。
- 内蔵imagegenを使用。[初期の指示](start-prompt.txt)、[村の指示](village-prompt.txt)、PNG原本の `start-source.png` / `village-source.png` を保存。前者は採用比較画像、後者は初期原本と比較画像を参照した。
- 配信画像は `website/public/images/island-start-cove.jpg` と `island-village-cove.jpg`。sipsのJPEG品質88で符号化し、計約790KB。旧画像より約38%軽い。既存原本は保持。
- 親仕様01が委譲する仕様53を先に改訂。家・学習の実画面と完成目標の3D画像は維持した。恒久的な運用変更ではないためmemory・ADR・runbookの改訂は不要。

## 判定の境界

- 美術：利用者選定の方向に合わせ、実表示で樹冠・屋根・道・岸がphone/desktopで切れず見えることを作者確認。生成画像は実モデルの描画ではない。大樹と家の目印は共有するが、岸・桟橋の位置は完全一致ではなく、成長の正確なシミュレーションには使わない。
- 理解と安全：独立参加者0人。子どもの理解・再訪の合格とは扱わない。ぽこもこのデザインは変更せず、生成場面に人物を足していない。
- Runtime：紹介ページの4幅、3段階選択、連打、キーボード、FAQ、リンク、画像読込、読込失敗から別段階への復帰、reduced motion、JavaScript無効時を確認。全幅で横overflowなし、操作44px以上、ゲーム用SW・DBなし。
- 画面内の注記と出典を開発中のイメージへ揃えた。紹介用の生成画像を現在のゲーム画面として見せない。
- 公開・push・ゲーム本体への統合は実施していない。ローカルDEVは `http://127.0.0.1:5199/#growth`。公開版・実機・ゲームの保存/学習/PWAの合格へ読み替えない。

## 検証

- `npm run build:website`：PASS。
- `node tools/verify-promotion-website.mjs http://127.0.0.1:5199/ docs/design/2026-10-18-promotion-cove/runtime-final`：PASS。320/390/768/1440幅、新規context。読込失敗は明示的なネットワークabort診断。
- `node --check website/main.js`、`node --check tools/verify-promotion-website.mjs`：PASS。
- `npm run docs:check`、入口guard、全体lint、typecheck：PASS。lintは既存の4警告、docsは期限超過の既存警告あり。
- `npm run build`（個別実行、assets:checkを含む）：PASS。PWA precache 8.52MiB/12MiB。
- `npm run verify:core`：PARTIAL。全体unitは141ファイルの通過出力を確認したが、長時間の3D検査を含むため完走前にこのタスクの検証プロセスだけを停止。途中までの通過を全体unitの合格にしない。全体buildは個別に完了した。
- 共有作業ツリーには他タスクの未commit変更があり、これらは公開候補の検証ではない。[残る検証](../../tasks/active/2026-10-18-promotion-cove-verification.md)。

Nodeはインストール済みv24.18.0を使用（packageの条件は22以上）。この環境にはnvmとNode22がないため `nvm use` は未実行。
