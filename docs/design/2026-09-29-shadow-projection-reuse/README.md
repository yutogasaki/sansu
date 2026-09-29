# 変わらない住人の影を再利用

2026-09-29。姿勢・親変形・instance行列・元position属性と更新版が同じ部品は、影の頂点書込・upload・境界再計算を省く。変化した部品は従来と同じ投影式で更新する。表示状態は毎frame更新。製品仕様、ぽこもこの姿、影の形・手振り・当たり判定・発見条件、保存、学習は変更しない。

## 同一入力比較

[比較結果](comparison.json)と[監査コード](audit.mjs)。基準a55854e0と候補でresidentShadowだけを差し替え、3住人×通常/reduced×240 frameを比較。各frameの全出力頂点・表示状態・boundingBox/SphereのSHAが6条件とも完全一致。通常動作の書込頂点はぽこもこ1,241,760→56,225、うさぎ3,963,120→2,715,788、カワウソ3,629,040→2,886,476。reducedでは各99%以上削減。

同じ着座fixtureで半分は通常影、半分は手振り。実取得や自然発見の評価ではない。記録したNodeの実行時間は局所診断で、ブラウザーFPS・GPU・電池改善の測定ではない。全体33.3ms目標と実iPhone検証は継続する。再実行時はリポジトリルートで `mkdir -p output/garden-frame-20260929` 後 `node docs/design/2026-09-29-shadow-projection-reuse/audit.mjs`。

## 検証

[固定候補manifest](candidate-manifest.json): a55854e0基点のapp変更はresidentShadowと対象テストのみ。Island/Life/Discovery/Fantasy有効、Preview/NatureTown無効。production previewは5471、DEV影確認は5472。庭living-fantasy-garden-v2、家house-world-first-v1、学習pokomoko-pop-live-v8を保持。

[core](core.txt)は485 files / 4,300 tests、lint/typecheck/build/assets/docs PASS。既存IslandMilestoneのFast Refresh警告1件、chunkサイズ/Browserslist警告あり。追加3テストを含む影6テスト通過。

[影の実操作](shadow-ui.json)は390幅通常motion/768幅reduced motionでPASS。3住人の手振り・連打統合・通常復帰・滞在終了中断、本人保存・元場面再演・現在への復帰、収納後の記録/学習正本保持と学習入力への復帰を確認。20 QA creditからの実購入/呼び出しであり、通常学習での実獲得ではない。開始終了source一致、pageerror 0。初回は訪問操作の保存完了で自動閉鎖されたメニューをハーネスがもう一度clickしようとしてタイムアウト。保存・画面は正常、pageerrorなし。buy/move/visit後は自動閉鎖の完了を待つよう共通検査helperを修正。アプリの挙動を変更せず、最初の失敗は `output/garden-frame-20260929/shadow-ui/` に保持。

[本番形式の一周](community.json)も390/768幅でPASS。実初回3問→購入→来訪/入居→昼夕夜→室内/再読込→実SW offlineの庭/入室→同じ学習と追加回答。注入fixtureなし、app/dist SHA開始終了一致、pageerror 0。

## 個別判定

外観: 影の出力は上記6条件で同一。[実画面](index.html)でも既存モデルと影の手振りを確認。新しいデザインの採用ではない。

理解/安全: コピー・操作・学習条件の変更なし。子どもの無説明利用・意欲は未検証。

Runtime: 親変形、instance単位の更新、通常/interleaved頂点buffer編集と属性差替、可視性・raycastの回帰を検査する。実機・全release matrixは別範囲。

## main / 公開

実装 `8d57fc1192f59bcbca1be0f1585085cc9b328185` をmainへpush。[公開version](public-version.json)の同revisionと[公開実操作](production.json)を確認。390/768幅で実初回4問・購入/配置・夜の庭・実SW offline再読込・追加回答と保存保持がPASS。fixture注入なし、pageerror 0。[意図したcommitのexport照合](index-verification.json)でdocs検査と全app入力の一致を確認。

公開後の追記は記録とタスク/ポータルのみ。局所的な計算削減を全体FPSや実iPhoneの合格に置き換えない。
