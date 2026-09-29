# 庭の描画頂点を共有

2026-09-29。「次のやることを実装」の依頼に対し、性能タスクの残件を一段進めた。静的な地形/家具の結合時に頂点indexを捨てずに保持し、同じ頂点を三角形ごとに複製しない。non-indexedな部品だけに連番indexを付ける。近い頂点を丸めたり結合する処理ではなく、元の法線・UVの継ぎ目・頂点色を保つ。範囲別raycastも同じindexと三角形順序を使う。

製品の仕様変更なし。ぽこもこの姿、庭、照明、影、解像度、動き、保存21・学習v8は維持。[実画面比較](index.html)。

## 数値と限界

[同一入力の全三角形属性監査](geometry.json): 同じ30品・3住人・同一論理時刻・夜・reduced poseのsceneを、変更した3モジュールだけ旧版/新版へ差し替えて比較。layer 1の196 meshesについて三角形順の位置・法線・UV・頂点色等が完全一致。頂点244,096→191,864（21.4%減）、indexを含むgeometry属性bufferの合計8,920,004→7,090,624 bytes（20.5%減）。これはCPU上の集計でありGPU使用量の実測ではない。

[ブラウザー計測](comparison.json): 各build/各幅1回、先頭5フレームを除く120 samples。P95は390幅41.8→38.2ms、768幅62.4→55.6ms。双方127 draw calls / 149,716 rendered triangles / 96 geometries / 8 texturesで同じ。33.3msは未達。Desktop Chromiumのviewport測定であり実スマホのFPSや電池改善を証明しない。

前後で同じネイティブDBを復元し、壁時計anchorのみ調整。30品は明示した旧保存20・200 creditの合法購入fixture、通常学習の実獲得とは区別する。基準buildには別作業の未commit進捗カードが入っていたため、全app差分が3モジュールだけだったとは扱わない。正確な属性/データ量比較は他のsourceを固定した別監査である。

## 固定候補と確認

[候補manifest](candidate-manifest.json): a9b661b5を基点とする隔離checkoutへ今回の5ファイルのみを適用。別作業の進捗カード編集は含めない。本番形式preview http://127.0.0.1:5461/#/island、version development-local:b5090489-5d18-4d39-9c14-7561ec8b578d。Island/Life/Discovery/Fantasy有効、Life Preview/Nature Town無効。庭living-fantasy-garden-v2、家house-world-first-v1、学習pokomoko-pop-live-v8。

- [core](core.txt): 485 files / 4,297 tests、lint/typecheck/build/assets/docs PASS。
- [対象テスト](focused.txt): indexed/non-indexedの1,107 raysずつ、親の回転/非一様scale/near/far/隙間、順序付き属性、色/UV/法線の継ぎ目、65535を超えるindex、元の品へのhit、解放を確認。
- [30品の前](before/report.json) / [後](after/report.json): 同じ学習予約への復帰、pageerror 0。
- [水と発見の実画面](fantasy.json): 通常学習→購入→再読込→同じ学習、水のタップ→星→本人保存→再演を両幅で確認。hidden/overlay/context-loss/menuの非計上も通過。DEVの明示fixtureを含む。
- [実初回からの一周](community.json): 390/768幅で実3問→購入→来訪/入居→昼夕夜の庭→室内/再読み込み→実SW offlineの庭/入室→同じ次問と追加回答までPASS。開始/終了のapp/dist hash一致、pageerror 0。初回は購入先を住民が歩いているという既存の拒否案内で停止。保存を読むとclear-placementのみでbuyなし。住民の移動後に実UIの「もういちど」を押す最大3回の回復をハーネスへ追加。他のerrorは許容せず、失敗記録はローカル community/ に残す。最終runでは拒否案内が再発せず、再試行分岐そのものの実行成功を主張しない。

## 個別判定

外観: 390/768幅を前後比較し同じ庭/家具/キャラクター/光を保持。新たな美術採用ではない。撮影時刻が異なるためpixel一致とは言わない。

理解/安全: 子どもの無説明利用・意欲の確認は未実施。既存のルール・コピー・UI・学習条件の変更なし。

Runtime: 上記の範囲で確認。全release matrix、実iPhoneの30秒待ち解消、実機GPU/電池の合格ではない。

## main / 公開

実装dbcf85decbeaba8298f109cf69acc1035b54c47cをmainへpush。Vercel READYと[公開version](public-version.json)の同revisionを確認。[公開版の実操作](production.json)は390/768幅で実初回4問・花の購入/配置・夜の庭・実SW offline再読込・追加回答と保存保持を通過。fixture注入なし、pageerror 0。公開前のexportで、意図したcommit treeと全app入力が隔離core/build候補に一致することを検査。別作業の未commit変更は含めていない。

公開後の追記は証拠・タスク/ポータルのみ。実iPhoneの起動/電池と33.3ms目標は継続。
