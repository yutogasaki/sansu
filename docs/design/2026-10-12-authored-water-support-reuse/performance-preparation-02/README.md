# 水庭支持の局所性能計測 — 修正版準備のみ

実測はまだ行っていない。[初回preflight停止](../performance-attempt-01/README.md)と[旧封印](../performance-preparation/README.md)を保持し、新しい [protocol](raw/README.md.txt)／[runner](raw/run.py.txt)／[seal](raw/seal.json)を用意した。[差分](raw/attempt-01-to-02.diff)は外側の競合判定・基準未取得時の扱い・新しい出力先に限定する。アプリ、計測worker bundle、入力state／base、18worker、warmup／測定回数、GC、180秒／2,700秒／4 GiBの上限は変えていない。

既存GUI browser／OS helper、ユーザーGUI Blender、rootのViteと実descendantのesbuild待機serviceは、存在だけで拒否しない。累積CPU時間の差分が1coreの10%を超えたら棄却する。初回は `cpu:null` と `cpuBaselineAvailable:false` を記録し、0やidleと評価しない。10回のpreflight観測末尾で、活動監視対象の差分基準が3回連続で揃うことを要求する。runtime中も同じ監視を続ける。

背景Blender／test／build／他benchmark／headless test browserは禁止を維持する。無関係なesbuildはVite例外に入らない。全private command argsは保存せず、PID／実行名／CPU／RSSを中心に記録し、ユーザーprocessへsignalを送らない。最初の失敗を保持し、自動retryや実行中の条件緩和は行わない。

[静的確認](raw/static-checks.json)で、GUI／background分類、Vite実祖先の限定、初回null／10%境界、測定順序、旧seal／同byte worker、core入力一致を確認した。これは実測成功ではない。[保存証明](archive-proof.json)は新準備ファイルの原byteを照合する。

起動はrootのquiet window指定後に `python3 /private/tmp/sansu-water-support-perf-c2-c3/prepared-02/run.py --start`。新規出力は `actual-02`。局所domain処理の比較に限定し、UI操作・個別compile self-time・P95・実機・M1合格へ転用しない。

seal SHA: `67d4e765af1b8d8192c6f540be21aab7b0781d1f40ad5176816a9c28d6d65d4a`。runner SHA: `9ed7a86618fd4c9be8f1f699f8061ac969785b2e637ef5eed710606c21e60c2c`。
