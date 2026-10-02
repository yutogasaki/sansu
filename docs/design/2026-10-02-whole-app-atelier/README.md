# Sansu 全画面の仕上げ

「島以外も全部」「全部世界最高のデザイナーとして仕事して」へのローカル実装。家と島のメニューから、初回設定・学習・記録・設定・保護者・しあげ・副モードの共通操作まで、紙、布色、藍の操作と用途ごとの階層を揃えた。世界の実モデルと既存の遊びを維持し、見た目だけで完了を判定せず、入力・保存・戻りを実アプリで確認した。今回のcommit・push・公開は行っていない。「世界最高」の客観的な認定や、仕様52全体の完成を意味しない。

[実画面一覧と比較](screens.html) · [接触シート](contact-sheet.jpg) · [対象・状態の一覧](inventory.md)

## 変更

- 初回設定は用紙と読みやすい選択行。プロフィール追加も同じ素材。初回の触れる島と既存の登録手順を保つ。
- 記録は今日の実回答数を主役にし、正解率・時間・日数と週の記録を小さく分けた。学習の道筋をその下の実DOMへ移し、しあげの準備条件も常時読めるままにした。空の記録を達成や架空の数字で埋めない。
- 設定は4項目の目次と詳細用紙。スマートフォンでは一枚、広い画面では目次と詳細を並べる。保護者とカリキュラムは見出し・実数値・履歴の帳面へ。
- 学習は問題と答えを主役に、紙面・輪郭・数字キーの素材を整えた。ぽこもこの同じモデル・演技・短いピーク、全数字/編集キー、採点と保存を維持。900px以上・高さ680px以下の横画面では既存の左右配置を使い、問題のはみ出しと閉じる操作の見切れを直した。
- しあげ・成功/再練習・確認ダイアログを同じ紙と操作へ。名前変更の古い`bg-primary`指定が白文字を消していたため除去し、実ボタンの藍背景/白文字を検査した。英文を聞く一回限りの入口が閉じた際は、消えた入口に代わって回答操作へfocusを戻す。
- 副モードの入口・2人遊びの準備と画面向き案内にも共通素材を適用。ライブの島、旧Exploreの絵、対向する2人の色は用途差として維持。島の2つの模型入口と家の用紙メニューは既存の仕上げを継承する。

正本は[07 UI方針](../../product/07_ui_design_guideline.md)。学習の出題/採点/報酬、route、保存schema、PWA更新規則は変えないため、学習仕様・保存ADR・運用runbookの追加は不要。共通CSSと既存UI部品へ集約し、新しいUIライブラリや生成美術は追加していない。

## 実際の対象と版

主対象はDEV `http://127.0.0.1:5275` のGrowing Islandと共有route。Island=true / NatureTown=false / Growing=true / fantasy=true / life preview=true、root delivery `snap-root-v1`、root style `whole-app-atelier-v1`。島世界は`growing-island-v1`、模型メニューは`island-play-diorama-v3`、家は`house-paper-atelier-v1`、学習は`pokomoko-pop-live-v8`。学習candidateが同じでも、今回の共通素材や横画面変更へ過去の見た目合格を自動継承しない。

DEVのrevisionは`development-local`。固定のGit commitと同一視せず、各reportに撮影URL・viewport・root/runtime identity、開始/終了SHAを残した。仕上げの最後に加えた名前変更ボタンと聴く画面のfocusは、他のrouteの絵を変えない限定変更。前の実画面の入力SHAと混同せず、[最終ダイアログ](dialogs-due-apple/report.json)、最終build/全tests、最終productionと速度測定で該当経路を再確認する。

[入力版の対応](integration-provenance.json)は各reportのSHAと最終1,777入力の差を記録する。sourceを持たないstockのナビ/Battle harnessへ、source一致を後付けで主張しない。数値・保存・画面・入力の検査と、未実施の実機/利用者判定を区別する。

`http://127.0.0.1:5277` はGrowing/Life/fantasy=falseを明示したnative Island回帰。共通学習のChromium/WebKit入力と既存の家/写真・履歴・2人遊びを確認する別対象で、Growing世界の見た目の合格には転用しない。旧Exploreのsmokeもclassic回帰として分ける。

`http://127.0.0.1:5276` はIsland/Life/Fantasy/Growingを明示したローカルproduction preview。最終buildの実version、全app/dist SHA、実SW制御とofflineを[production report](production-final-focus/report.json)へ記録する。公開サイト、実iOS、実two-build更新の証拠ではない。

## 確認結果

- [全画面5サイズ](current/report.json)：390×844、768×1024、320×568、568×320、1024×768。120撮影、実誤答/訂正/支援、回答後の記録・保護者表示、全数字キーと保存7store、開始/終了source一致PASS。
- [メニュー4サイズ](menu-current/report.json)：84撮影。種/収納/目印/住人/見せる/花/なぞる/本と旗、設定4項目・家・学習、Escape/focus、44px・実hit・模型と文字の分離、7store/しずく不変PASS。2人/200しずく等は明示表示fixture。
- [入力20ケース](inputs-current-contract/report.json)：Chromium/WebKit、数/数図/十進図/小数/分数/3種類の筆算/比較/英語。118撮影、実planner/入力/ヒント/お手本/続行、横/縦への回転と下書き・予約保持PASS。1024px近傍を含むviewport検査であり実iPadではない。
- [しあげ4ケース](finish-verified/report.json)：実20問と保存。筆算の再開、整数になる分数、帯分数、19/20の維持→実対象練習→新予約の再挑戦を確認。資格は純粋domainで生成した明示native fixtureで、実取得・学習効果の観察ではない。
- [確認/英文](dialogs-due-apple/report.json)：phone/tabletで名前変更の藍/白の実色、未保存の名前の取消、実英語回答から英文提示、音off、開いている間の物理キー遮断、閉じた後の回答focusと保存保持PASS。eligibleな文章のためdue appleを明示した隔離fixture。音声出力・実スピーカーは未計測。
- [ナビ回帰](navigation/report.json)：native Islandの3サイズ・64撮影。履歴、設定詳細、実写真、スクロール、入力下書き、7store、補助文字4.5:1を確認。[2人遊び](battle-supported/report.json)はphone、tablet縦の案内、tablet横の実開始/ラウンド/結果と退出を確認。
- [production/offline](production-final-focus/report.json)：両幅の実初回設定、家の種・色・畑の取得、通常5回答、実SW offline再読込、家の本と学習再開、保存保持。QAデータ注入なし。source/dist開始終了一致を検査。
- [core](core.log)と[最終全tests](tests-final.log)：519ファイル・4,603 tests PASS。[最終lint](lint-final-focus.log)、型checkを含む[最終build/assets](build-final-focus.log) PASS。既存Fast Refresh warning1、文書期限warning4、Browserslist/glob/build警告を保持。PWA precacheは180files・8.84MiB/12MiB。
- [classic smoke](smoke.log)：31/31、exit 0。旧Exploreの保存失敗/二重回答/再開等の回帰。現行Islandの見た目やPWA認定ではない。
- [固定10問の正式測定](throughput.json)と[入力固定manifest](throughput-source.json)：80run・全gate PASS。1,777入力を外のimmutable directoryへ保存し、他の検査が終了してから10反復・両幅・2シナリオ・2laneで測定。開始/終了source一致、全数字キー、実atomic receipts、誤答同問20samples/幅、区間移行も検査。Studyは既存非記録DEV fixture、Islandは実writerだが問題だけ明示fixture。子どもの操作速度や実plannerの出題効果とは別。実測は phone: 正答P95 209.3ms / 誤答 211.1ms / 区間 209.4ms / Study比 2.311、tablet: 正答P95 209.7ms / 誤答 210.5ms / 区間 209.2ms / Study比 2.312。

## 見た目と独立したゲート

接触シートと前後の実画面を並べて作者がレビューした。3つの設定のruntime CSS probeは、Aの目次/用紙、Bの色カード、Cの枠なし列。Aを採用した。Bは管理項目の強さが均等になり、Cは一覧の境界が弱かった。probeは同じ実データとrouteを使った一時CSSで、利用者の人気投票ではない。

- **見た目**：対象UIの素材・主従・本人の実数値・絵と文字・狭い画面を作者レビューでGO。数値の美術scoreや「世界最高」を自称する証拠はない。世界そのものを新しい美術へ置き換えた認定でもない。
- **無説明の理解/意欲/安全**：保存と誤操作防止、読みやすさ、焦りや架空の報酬を加えない境界は確認。子どもの観察N=0。好み・理解・再訪意欲のゲートはHOLD。
- **動作**：記載した実route/viewport/保存/入力とローカルSW旅程はGO。実機Safari/iPhone/Android、OS音量、長期利用、大規模な島、実two-build更新、公開URLは別ゲート。

## 診断の保存

最初の保護者gateを足し算とみなした前提、初回にnative島を作る通常初期化、誤ったプロフィール追加query、学習CSSの優先順位、古い入力helperのsubmit/candidateと整数分数の前提、聴く入口の重名・一回限り/eligible条件、短い横画面でunsupportedなのにBattle setupを待った前提を保持した。production中に後続CSS/focusが変わったrunはsource不一致のFAILのまま残す。最終結果への上書きや、途中PASSの流用はしない。

実際に直した問題は短横の問題欄/閉じるの寸法、名前変更の白文字、聴く入口が消えた後のfocus。sourceだけで色が入ったと扱わず、実computed styleと最新画像へ検査を追加した。終了時の[文書check](docs-final.log)と差分空白checkでcloseoutする。
