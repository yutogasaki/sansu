# 途中の造形と失敗を保持する

採用候補は親folderのv6。draft 01〜05は差し戻した作者稿で、最終候補へ昇格させない。各draftに当時のbuilder・manifest・レンダーを保持する。前稿の全GLBは保持していないため、旧稿を最終bytesの検査済み候補とは扱わない。

- draft 01: ベンチと木の比率、空洞入口の塞がり。
- draft 02: 原本courtの上面を床検査へ含めず、家具の足が埋もれた。
- draft 03: p26を崖に置き、閉じた接地台が高くなりすぎた。実BVH位置probeを保持。
- draft 04: 道の端が丘へ埋没。最初のQAは大きなresponse.bodyをCDP cacheから読めず、未処理の例外で終了。reportは作れず、実行logと当時のrunnerを保持。
- draft 05: 道の両端だけを床へ沿わせても、幅のあるquadの中央が凸の丘へ食い込み黒い欠けを生んだ。v6は幅方向にも細分して明示triangleで地面へ沿わせる。

QA v5の最初はdata-viewがmainとbuttonの2個へ一致した検査selector不足。[FAILと原runner](../verification-v5/report.json)を保持。修正後v5-r2は404でFAIL。[局所診断](../verification-logs/favicon-diagnosis.txt)でfavicon.icoと特定し、ページ内のfaviconを明示した。v6はそれを黙って無視せず、HTTPとconsoleの失敗も確認してPASSした。
