# 水庭支持再利用の局所性能計測 — 準備のみ

実行はまだ行っていない。rootのquiet window連絡後に、同じ固定c2/c3の27／32／35所有物入力で、無改変の `composeAuthoredWaterWorld(state, base)` だけを比較する。[封印した手順](raw/README.md.txt)・[runner](raw/run.py.txt)・[seal](raw/seal.json)・[入力SHA](raw/inputs.json)を保存した。

各入力で3独立process block、各processに2回のwarmupと2回の計測を行い、各版6測定とする。入力順を回し、各入力のc2/c3順はblockごとに交互にする。両版同じ計時外GCを用い、過去world／queryを保持しない。median・range・全raw値・3組のprocess内medianを報告し、P95や有意差へ一般化しない。

[cache監査](raw/cache-audit.json)で全結果のmemoized returnがなく、同じbaseの安全判定索引だけを両版同条件でwarmupすることを確認した。各呼出しはfresh world／plan、採用橋l24、復元辺、世界定義・計画・全site床／anchor・全元歩行辺支持のSHAを既存機能パリティと一致させる。本体へ計測処理を挿入せず、個々のcompile call数・self-timeを直接測ったとはしない。

予算見込みは10〜20分、全体2,700秒、各worker180秒、RSS4 GiBを実行前に固定。背景のBlender／browser／test／buildや高CPUの重複があれば棄却する。rootのViteとユーザーGUI Blenderはidle時に保持し、CPU活動を観測する。ユーザーprocessにsignalは送らない。記録はPID／実行名／CPU／RSS中心で、privateな全command argsを保存しない。

[静的確認](raw/static-checks.json)は両版24importのcore subset・6,460入力と6依存のSHA・syntax・順序・監視条件だけの検査であり、測定成功ではない。[原byte保存証明](archive-proof.json)を確認済み。旧機能パリティの時間は性能値に混ぜず、今回の結果もUI操作・描画・実機・美術／M1合格へ置き換えない。

封印SHA: `e6de08c031fa11c9be70fef0ed373692e75bd08fb48b161c8caa49d29d8a5120`。runner SHA: `ff5b9dc4a7a5937bc031ea5829f43f9a41157e0d24f2fd254b02b196627fed77`。
