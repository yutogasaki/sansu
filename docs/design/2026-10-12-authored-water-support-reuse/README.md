# 水庭の支持床の再利用

2026-10-12。固定c3の[統合core](../2026-10-12-authored-shoulder-runtime/c3/core/README.md)は**610 files／5,302 tests・lint・型・build PASS**。[配布境界](../2026-10-12-authored-shoulder-runtime/c3/build-boundary/README.md)も通過し、6,460 source＋6依存が前後一致。[対象実画面回帰](../2026-10-12-authored-shoulder-runtime/c3/affected-regressions/README.md)は水庭14画面／6操作とclassic32がPASS。水庭の全画面で橋を含む計画がc2と一致した。速度改善は未計測。全8回帰が通った固定c2は変更していない。

橋を採用するときに生成済みの支持床を、直後の元歩行辺の判定へ渡す。これまで同じ定義をもう一度compileしていた1回を省く。後続の不採用候補は最後に採用した床を置き換えず、橋がなければ元のcutWorldを返す。返した床は後で行うedges／shoreAccess等の編集から独立したsnapshotであり、新しいcacheや床・権利・形状の変更はない。

[変更差分](change.patch)と[入力SHA・対象確認](focused-checks.json)を保存した。通常・回転・非線形の床／歩行queryを従来の再compile結果と比較し、全不採用、採用後の別owner不採用、呼び出し側の定義編集後も支持床が変わらないことを確認した。変更前後のソースは同byteの写し。コマンド結果はtool返却値から記録し、保存した生stdoutとは区別する。

[実27／32／35所有物の限定比較](real-input-parity/README.md)でも、世界定義・橋を含む水庭計画・全siteの床／anchor・元の全歩行辺の支持結果がc2とc3で完全一致した。35入力は外側検証のRSS上限で止まった最初の2回も保持し、同じ入力で上限を別実行前に4 GiBへ設定した比較が完走した。この時間・メモリから速度改善を主張しない。

差分は3ファイルのみで、固定候補の独立コードレビューにも具体的な不具合はなかった。実画面では既存の水庭全編集旅程とclassic回帰をc3で完走し、6,460 source＋6依存の前後一致と証拠79ファイルの原byte同一を確認した。形・rendererを変えていない今回の対象範囲を明示し、c3で肩の全取得や全8回帰を実施したとはしない。操作待ちの実測と美術HOLDの解消は別に残り、この確認をM1や製品性能の合格へ置き換えない。

局所の速度比較は[2回目も計測前の静穏確認で棄却](performance-attempt-02/README.md)した。既存ブラウザー等の実CPU活動が事前条件を超え、workerは0・計測値も0。条件を緩めたりユーザーのアプリを止めたりせず、この単位は性能未測定で閉じる。機能回帰の合格は維持し、改善率は主張しない。

## Verification and document scope

This is an internal reuse of an already validated compiled support snapshot. Placement, water, walking, ownership, save, learning and delivery rules are unchanged, so no product-spec, ADR, migration or durable-memory change is needed. The implementation evidence and active task records carry the current status.

The fixed c3 core, affected runtime, functional 27/32/35 comparison and independent review are linked above. Root also inspected desktop whole, bridge close and phone whole in the [scoped water contact sheet](../2026-10-12-authored-shoulder-runtime/c3/affected-regressions/visual-contact-sheet/index.html). The newer shoulder/cove whole-art configuration is outside that driver. Art remains HOLD, independent observers remain N=0, and performance is a separate measurement.

Repository documentation and whitespace checks passed at 2026-10-12 06:08 UTC (`npm run docs:check`, `git diff --check`), with the existing expired Review By warnings. These are working-tree checks, not a staged-commit or deployment claim.
