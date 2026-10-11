# 差分レビュー

完成像との差が最大の残件。深い湾・高い段泉・密度と家の並びは[実全景の比較](benchmark-comparison.jpg)で未到達と判定し、runtime PASSで美術HOLDを上書きしない。

- データ境界: 保存4、土地価格・所有・家のstyle・成熟、学習/SRS/clockの実装に変更なし。地形は絶対保存セルから作り、追加拡張による旧床の局所形状不変、全取得床のray/逆写像を検査した。描画の全体X再中心化は従来どおり。
- 足と操作: 描画床・道・分数の足・入口・回廊・橋・hit/previewを同じ写像へ通す。家・布の原本kit bufferは変形せず、足元を移す。曲げるのは自分のprocedural床/橋geometry。
- 視点: 実meshの外周から通常framing/panを決め、擬似的なuser zoomで初期manual modeにしない。全景と一覧から枠外の家へのfocusは12拡張ケースで確認した。
- 展示: 本体rendererと明示診断保存を使う。戸数を解放条件にせず、DBへ書かない。選択中のボタンで残る読込表示を実操作で再現し、DEV entryだけを最小補正した。
- 子どもの導線: 旧Exploreを現行導線へ復帰する変更はなし。新しい競争/罰/必須の目標は追加しない。
- source: A3と現在の差を二つのQA/DEV entryへ限定。全current source一致や新しいrelease合格とは言わない。[閉じ合わせ](source-closure.json)で元bytesへ正確に戻せる差か照合する。

Safety: OK（検査した所有・保存・実床の範囲）。Spec alignment: OK。Tone: OK。Over-change: なし。新しいDEV entryのfast-refresh警告と既存IslandMilestoneの警告は残るが、lint errorは0。独立した子どもの理解/安全と実機性能は未評価。

Gitのwhitespace確認はcode/文書でPASS。元bytesを保持した生ログ5件だけが末尾の空行を指摘されるため、生ログを除いた確認も別に行った。作業treeの文書ポータルを再生成すると初回stale4件は消えるが、外部index exportではmapに旧ignored資料73件の差が残った。別作業の資料をstageせず、意図したindexのexportから生成するmapへ揃えた。作業treeのignored資料を含む索引チェックと、最終indexだけのチェックを区別する。
