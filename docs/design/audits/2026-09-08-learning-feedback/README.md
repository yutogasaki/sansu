# 学習の音・判定・英語読み上げ

効果音6ファイルが空で、Islandでは英語の読み上げが接続されていなかった。短い効果音を実体のある音源へ置換し、○／×と文字で結果を示し、単語の横へ「きく」を追加した。正解時の印は短く弾み、次の問題の入力を待たせない。

[実画面と音の試聴](review.html) · [音声・判定の実測](feedback-report.json) · [オフライン音声](offline-audio.json) · [固定した入力ファイル](build-source.json)

## 対象

- ローカル production: `http://127.0.0.1:5574/#/island`
- Base: `9300ea0b5e965a4ca4d6679fc3cf85ba9ec10aa5`、revision: `9300ea0-feedback-d41177df441c`
- Build version: `9300ea0-feedback-d41177df441c:89372285-8058-4d4a-8c24-ad0b76e243c0`
- Delivery: `mystic-island-v1`、world: `mystic-island-living-v3`、learning: `mystic-island-learning-v2`、art: `moon-garden`
- `VITE_ISLAND_ENABLED=true` / `VITE_BUILD_PLAY_ENABLED=false`。Phone 390×844、tablet 768×1024。
- Baseに本件の変更だけを加えた外部固定コピー。共有作業中の土地・節目・教科選択・学習進行の変更は保持し、本件の測定対象へ混ぜていない。公開デプロイ・commit・pushは含まない。

`build-source.json` は751入力ファイルのSHA-256を保持する。QA2は短い音の測定前に前面・可視状態を確認し、失敗時の生の測定値を先に保存するハーネス補正だけで、productionアプリはV3から変わっていない。

## 操作と音

- 入力75ms、正解380ms、答え直し220ms、筆算の途中段200ms、区間完了580ms。開始・レベル到達の既存音も実体へ置換。7ファイル計36,041 bytes、MP3 decode後の最大振幅は0.685未満。再生音量は入力0.24、答え直し0.38、その他0.55。
- 保存済みのreceiptで正解・答え直し・途中段を鳴らす。音や動きを待つ追加操作はなく、入力開始で前の判定を消す。独力正答、支援完了、筆算の途中段を混同しない。
- `soundEnabled` はSE、`englishAutoRead` は英語の自動読み上げを制御。「きく」は自動読み上げOFFでも使用可能。英語は新しい問題につき一度、600ms後に自動で読み、再試行・ヒントで重ねて自動再生しない。
- 手動再生はクリック内で開始し、再生中・自動再生が拒否された状態を表示する。回答・問題変更・帰島・画面非表示で旧音声を止める。利用可能な端末内の英語音声を優先する。
- 音源は `tools/generate-sounds.py` で再生成できる独自の短い音。新しい依存パッケージや外部音声サービスは追加していない。

## 独立した判定

| ゲート | 本件の評価と限界 |
| --- | --- |
| 見た目・手応え | 作成者レビューで○／×、文字、短い弾みを視認。従来の世界を保持。音の鳴り分けを実測したが、子どもが楽しいと感じるかの独立観察は未実施。 |
| 無音の理解・安全 | 作成者レビューと実UIで、無音・reduced motionでも記号と文字が残り、赤い叱責・画面の揺れ・入力を塞ぐ演出がないことを確認。子どもの無説明理解はN=0、未評価。 |
| Runtime | 固定V3のローカル機能検査PASS。固定10問の数値基準もPASSだが、並行負荷があったためホスト独占での公開速度認定は未実施。Mac Chromeのデジタル音声出力とnative speechイベントは、実機iPhone／Androidのスピーカー可聴性の証明には用いない。 |

16枚のcontact sheetは検証用の通常プロフィールから、ホーム→学習→誤答→正答→区間継続→英語→帰島を撮影したもの。各画像のrevision・delivery・candidate・viewportを実DOMで照合し、音声拒否だけは明示的なfault injection。描画画像はSW無効、オフラインは別の実SW試験で区別する。

## 検証

- `verify:core` PASS: docs、lint、typecheck、170 test files / 1,977 tests、production build、asset budget。Precache 144ファイル、9.69MiB / 12MiB。全SEの非空・precache収録を継続検査へ追加。
- Native Chromeの音声・判定8ケースPASS。正解／誤答／区間完了の実AudioBuffer出力、消音時の出力0、reduced motion、英語の手動・自動・キャンセル・再生拒否、聞き直し前後の保存状態一致を確認。英語はSamanthaの実start/endを取得。
- [全形式のproduction学習](learning-report.json)23ケースPASS。図の多い十の棒、数直線、図形、比較、分数、複数欄、筆算、英語、renderer fallbackと回復を含む。Phoneのヒント・全キーが画面内に残ることを確認。
- [Islandの既存導線](island-report.json)11ケースPASS。25区間を実UIで解いて全4地区が育つことをphone/tabletで確認。Classic PWA4ケース、[Island PWA](island-pwa-report.json)7保護フローと実SWのオフライン回答・再開もPASS。
- [実SW・オフライン音声](offline-audio.json)PASS。ネットワークをOFFにしてreload後、7種類のMP3をキャッシュからdecodeし、端末内のSamantha音声のstart/endを取得した。
- [Smoke再実行](smoke-report.json)31ケースPASS。開始時は他の検査がなかったが、後半に別作業のテストが起動したため、実行全体の単独性は主張しない。
- [固定10問](throughput.json)80 run・各10反復で全数値基準PASS、ハーネスの`evidence.eligible=true`。入力混入0、通常問題間の追加操作0、区間自動継続を含む。751入力ファイルが測定前後で一致した。

| 自動キーボード測定 | Phone | Tablet |
| --- | --- | --- |
| 正解→次入力 P95 | 193.5ms | 194.3ms |
| 誤答→再入力 P95 | 192.5ms | 192.0ms |
| 区間継続→次入力 P95 | 192.0ms | 202.7ms |
| Study比の全問正解throughput | 2.208 | 2.198 |

固定10問はreduced motion・音OFFの明示fixture。音ON・通常の動き・タッチ・通常plannerは別の機能検査で確認している。これは自動操作の応答時間であり、子どもの解答速度ではない。開始前に他の検査がないことを確認したが、途中で別作業のbenchmark/E2Eが起動した。[5秒間隔のprocess census](execution-isolation.json)88サンプル中81に並行ジョブがあり、`exclusive=false`。ハーネスのeligibleはsourceと反復数等を評価し、ホスト独占性を評価しない。この結果を独占環境での公開速度認定には用いない。

共有workspaceとの[所有差分照合](workspace-comparison.json)は25ファイルが固定コピーと完全一致。共有の`Island.tsx`と`IslandLearningPanel.tsx`は別作業の節目・教科選択のみが追加され、本件の音と読み上げの接続は保持されている。共有workspaceでもtypecheck、`eslint src`がPASS（別作業のFast Refresh warning 1件）。共有作業中の全機能を本件のruntime証拠へ含めない。

生ログと固定source archiveは `output/playwright/learning-feedback-final-v3/`。原稿の復元、音声イベント、測定条件を記録し、共有作業中の全変更の検証済み宣言へ広げない。

## 発見して直した点

1. 最初の判定表示を44px高にした際、図の多い問題でヒント操作の下端が画面外へ10px出た。判定の26px記号・17px文字を保ち、もとの30px／34pxの枠内へ納めた。最終V3の全形式で再確認した。
2. 既存学習ハーネスに、通常区間後の古い報酬画面と乱数で変わる特定の足し算への固定期待が残っていた。現行仕様の区間継続と、実際に予約された問題に対する支援の正しさを検査する形へ修正。アプリの保存や判定を検査に合わせて変更していない。
3. V3初回の短い入力音の測定でpeak=0になった。原因は断定せず失敗を保持し、可視状態の明示と生の測定値保存を追加。同じアプリで全8ケースを再実行しPASS。旧V1/V2・V3初回ログを最終成功ログで上書きしていない。
4. 最初のsmokeで既存Exploreの連続入力が一度`12`→`1`になった。アプリ・ハーネスを変更せず全31ケースを再実行してPASS。負荷との因果は断定せず、失敗ログと再実行のprocess censusを保持した。本件が変更するIsland共通入力とは異なるExplore入力経路の検査である。

## Diff Review Report

### Findings

上記の表示領域の問題を修正後、本件の所有差分に重大な残件は見つからなかった。共有のIslandページ・パネルに追加された別作業の差分は、本件の固定コピーとの違いとして記録する。

### Summary

- Safety: OK（本件のローカル差分）。保存・回答guardを維持し、読み上げの聞き直しは学習記録を増やさない。
- Spec alignment: OK。親仕様01と島仕様28へ音・判定・読み上げの契約を反映。
- Tone: OK。短い「せいかい」「もういちど」と記号を用い、支援完了を独力正解として表示しない。
- Over-change: None。世界・出題・SRS・schema・routingの契約は本件で変更しない。

### Verification Plan

上記の固定sourceに対する検査、実画像、音声出力とnative speechを用いる。子どもの独立観察と物理端末の可聴性は未実施として区別する。

## Doc Sync Report

### Summary

- Change type: UI・音声・判定の明確化と、その継続検証。
- SSOT update needed: Yes。

### Required Updates

- `docs/product/01_app_spec.md`: 音・読み上げ・結果の意味を親仕様から接続。
- `docs/product/28_mystic_island_spec.md`: 効果音、○／×、手動／自動読み上げ、待ち時間と設定の契約。
- `docs/ai/verification_matrix.md`: native Chrome音声チェックの実行方法。

### No-Change Justification

保存形式や学習規則を変更しないため、migration・ADRは追加しない。今回の一時的なQA経緯はこの監査に置き、durable memoryへ重複させない。

ローカル実装として完了。実機可聴性・独立した子どもの体験観察・公開速度認定・公開先への反映は、この記録の完了範囲に含まない。
