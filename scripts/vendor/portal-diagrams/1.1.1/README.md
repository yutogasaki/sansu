# Portal diagrams 1.1.1

JISHUの2026-10-19時点のMermaid/図/同義HTMLと根拠照合から抽出した固定部品。由来と元ファイルのSHAは `origin.json`。教材・個別仕事・正式状態・承認エンジンは含めない。

初回準備はこのフォルダーで `npm ci --ignore-scripts`。Node.jsと固定した `@viz-js/viz 3.31.0` を使う。JISHUのnode_modules、ネットワーク、CDN、ブラウザー内Mermaid実行に依存せず生成する。

`build({root, definition})` は相対パスの根拠を照合し、`{model, files, html}` を返す。filesは呼出側が所有する出力へ保存する。定義のschemaVersionは1、sourcesにはid/path/href/sha256と任意のMarkdown headingを置く。LF正規化した指定節または全文をpinする。recordsはJSONのcollection/key/valueとfieldsの投影hashを照合し、関係のない行追加で失効しない。pinを自動更新しない。

diagramsはid/title/intro/nodes/edges/noteと任意のdirection/sequence。各nodeはid/label/sourceRefと任意のnote/href。edgeはid/from/to/label/kind。kindはrelated（無向の関連）、dependency、procedure、evidence_for_decision。後3つは有向。状態や未承認の注意は呼出側の正本から与える。元定義の未知フィールドはJSONに保持する。

Mermaidはflowchart TD/TB/LR/RL/BT、角括弧付きノード、ラベル付き `-->` / `---` の明示的な部分集合。孤立ノードも保持。対応しない構文は省略せず失敗する。生成後の逆解析で全ノード・線の方向・ラベル・多重度を照合する。SVGとHTMLも同じモデルから作る。全文の意味や人の理解の検証を代替しない。

出力はdata/diagramsのSVG、Mermaidソース(.mmd)、モデルと根拠(JSON)、CSS/JS。人向け本文は常時表示し、狭幅の縮小図を読む前提にしない。原寸表示、Escape、操作元へのフォーカス復帰を提供。sequenceは本文の表示順であり、状態更新や作業開始を表さない。

同一パスやファイル名の誤り、根拠/状態の変更、部品ファイルの変更で停止する。root外のパスやsymlinkを読まない。固定版の変更には別版を作る。取り消すときは呼出側の追加合成だけを外して再生成し、正本・既存の仕事/判断/旧URLは保持する。

## 1.1.0で追加した適用

`coverage.cjs` は公開済みレジストリのMarkdownと呼出側が列挙した正本だけを読む。全文探索・private探索・ブラウザ保存の読取は行わない。既存の専門表示・判断エンジンを保持し、一覧への導線、同じモデルの図/本文/原文/JSON、対象全件の台帳を追加する。図がない案件はcoverageのみを記録し、見本の図は作らない。

実在する構文に対応：graph/flowchart、単独宣言、ラベル省略、途中のノードID参照、双方向 `<-->`、仮説の点線 `-.->`、stateDiagram-v2の日本語状態と開始/終了。原文とsourceIdを保持して安全な表示IDに写す。日本語表示の読み替えは呼出側の明示設定。subgraph・sequenceDiagram・任意のstyle等は未対応として失敗する。JISHU docs/maps/index.mdの既存の余分な末尾endは、そのファイルだけ理由付き互換設定を明示した場合に限り除外し原文を保持する。

JSONの仕事グラフは目標/段階/仕事/成果/検査の所属と仕事間の依存を区別する。sourceDataに全fieldを保持し、状態と停止理由を本文に残す。経路のguard/event等もJSONに保持する。既存の正式状態・修正回数・承認は更新しない。

著者が編集する定義のpinは従来どおり変更を検出する。現在の正本から毎回投影するcoverageでは、その時の入力hashと出力hashを記録し、通常verifyの再生成比較で古い出力を検出する。これを人の採用や原文の正しさの証明とは扱わない。

## 1.1.1 初回の依存準備

通常の生成/verifyでnode_modules自体がない場合だけ、全固定ソースとnpm lockのhashを確認してから、このフォルダー内でnpm ci --ignore-scripts --no-audit --no-fundを実行する。既存の部分欠落や改変は自動修復せず停止する。npm scriptsは実行せず、導入後もruntime3ファイルの固定hashを照合する。ネットワーク/registryに接続できない初回は明示停止し、手元で同じciを実行する。既存1.1.0は変更しない。

並列の初回生成は専用の一時ロックで準備を直列化する。中断したロックやnode_modules自体のsymlinkは明示停止する。ロックがある間は途中のruntimeを使用しない。著者データのCRLFを正規化して根拠照合し、入力台帳には元のbyte版を保持する。
