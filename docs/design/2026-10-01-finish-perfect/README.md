# しあげ：全20問独力正解でクリア

ユーザーの「全部正解じゃなくていいの？」「それで」を受け、クリア条件を20/20にした最新ローカル画面。[入口・未クリア・クリアの比較](index.html)。旧基準の証拠は[前回記録](../2026-10-01-finish-test/README.md)に残す。

- Target: `http://127.0.0.1:5238`、Vite開発版。HEAD `43d22b967d96d97375ac31433143e7710dc37d07`＋未コミット変更。配布ビルドではない。
- Candidate: `finish-perfect-v1`。起動flags: `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true`。Service Worker非制御、音なし、reduced motion。390×844、768×1024。
- Source SHA256: `finishTest.ts` = `59d94757e53f9e4355fd761cf0a12da0c069dcda1145dabceb53ba8e9222ce0b`、`FinishChallenge.tsx` = `5fc66b3bbd73d8016469cfd8c2d172d699893e01655aa381470c0e7f64243dbd`。
- 専用診断プロフィール `df4ce51d-5f12-4a32-a2f1-ed6836941287`。資格はfixtureで作成し、回答は画面の入力で実施した。通常利用からの資格獲得全体を証明するものではない。
- 19/20履歴 `cb43b1dd-b054-4d6c-b073-7d4dc0f1fd88`: `passed=false`, main=16。再挑戦は新予約・初回答0件を照合。20/20履歴 `d90e37cc-06f1-4d92-a2ee-8f17d8c597ae`: `passed=true`, main=17, newLevel=17。
- 初回ブラウザには停止済みサーバーの旧コードが残っていた。19/20で旧クリア画面になる診断失敗を保持し、サーバー再起動・reload・新プロフィール後に上記を確認した。旧結果を現在の証拠として扱わない。

## 個別の確認

- 見た目: 実画面で全問条件、二つのレベル印、未クリア時の練習/再挑戦をレビュー済み。前回の画面構成を維持した。
- 読み取り・安心: 未クリアでもできた記録を認め、次の行動を示す。子どもの観察・実機評価は未実施。
- 動作: 全4391 tests、typecheck、build/assets、lint（既存warning2件）、docs、current UI entry PASS。島全体のrelease gateの既存未認定範囲は前回記録のまま。本番反映は未実施。
