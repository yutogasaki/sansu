# Authored cove shore v4 — focused tests

2026-10-12 の既存 focused 実行は **5 files / 30 tests PASS**（62.36s）。[raw stdout/stderr](focused-v4.log.txt) を byte 不変で保存し、[report.json](report.json) に各 test と入力 SHA を収録した。証拠の保存にあたり test を再実行していない。

今回の visual candidate は `native05-authored-cove-shore-v4`。殻 GLB は変更しておらず、source ID は `native05-authored-cove-corner-v3`、source SHA は `f08ada4907c76a617e2c22090049b9b2880dde2d75fa11ad61f6e76c7eec7146` のまま。曲がった岸に合わせた apron と、その範囲を含む localGround / clearCourt の適用条件を検査する。

| Test file | Tests | 対象 |
| --- | ---: | --- |
| `nativeAuthoredCove.test.ts` | 6 | 実 source 頂点・normal・material・rigid transform・共有資源 |
| `authoredCoveWorld.test.ts` | 6 | 実 P04 の役割・所有物・地面条件、曲がった岸の追加物、walk-only apron、自己成立の拒否 |
| `authoredWorldFrame.test.ts` | 5 | water → cove の合成、編集・復元、cache と disabled mode |
| `authoredCoveIntegration.test.ts` | 7 | 実床の単一描画、79,384 triangle guard、所有物の編集、preview/cancel/confirm |
| `authoredCoveLife.test.ts` | 6 | 公開操作からの実歩行・p9 利用 receipt・退場、床消失時の退避、初期 preview 中の committed guard |

5 test と Vite config の相対 static import/export・literal dynamic import・`new URL`、明示 file 入力、source GLB、package/lock を追跡した **284 ファイル**が、current root、c2 snapshot manifest、candidate の実ファイル、core 開始時・終了時の SHA と一致した。Vite config 自身の相対 import も含め、未解決の local import は 0。追跡方法は [archive-focused.py](archive-focused.py) に保存した。

focused 実行開始時・終了時の入力 manifest は未取得だったため、事後の hash 一致だけで過去の入力を独立に証明したとは扱わない。root の継続記録では、最終 source/profile/test 編集を終えてから focused を開始し、PASS 後に c2 snapshot を取得、以降 app/source 編集なし。さらに c2 の **terminal core PASS / exit 0 / sourceFixed=true** が同じ 5 files / 30 tests を独立に再検証した。[core の該当結果行](core-focused-excerpt.txt) は全文 raw ではなく、元 log の SHA を付けた抜粋として保存する。core の固定入力は 2,137 ファイル。

これは Node/Vitest の実 geometry、domain command、公開 life API による focused 診断であり、ブラウザ表示、美術承認、子どもの理解、実取得、保存・offline・端末性能の合格ではない。c1 の 13 test 証拠や初回失敗は上書きしない。
