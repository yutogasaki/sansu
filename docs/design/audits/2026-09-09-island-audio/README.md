# 固定20・実音出力と停止境界の有限確認

同じ固定20に対する **QA05の主音出力** と **QA06の停止・学習復帰** を、別々の実行として合成した記録。phone 390×844（touch／通常motion）とtablet 768×1024（reduced motion）で選定経路を通過した。元03・04・05のrun全体はFAILのまま保持し、06だけが境界限定PASS。最新版や全Goalへ遡及しない。

対象は `http://127.0.0.1:5406/`、revision `workshop-20260909-0db80c949ca3`、source hash `0db80c949ca3eebc5efb410e05846c2f48da2f1d678c45aef4ab559d5b341d61`、candidate `mystic-island-living-v5`。実served versionと有効なisland flagを確認した。Chromium `145.0.7632.6` のheaded実行で、全1032元入力・929app入力・共有helpers・QA／Node／Playwright runtimeを前後照合した。[verification.json](verification.json) に各runのclosure、report SHA、境界を記録する。

## 元の失敗と変更したQA

| Run | 両幅の結果 | 原因と次の差分 |
| --- | --- | --- |
| 03 | 最初の必須音窓でFAIL | sourceの同期符号化が開始後約47msを占有し、録音開始がphone 72ms／tablet 66.667msへ遅れた。50–150ms窓の不足分を推定で埋めず失敗とした。 |
| 04 | 三音×2周を通過後、夕方でFAIL | PCMを一度だけ保持し、符号化を最初の実録音block後／保存時へ移した。夕方の全帯域call／gap RMS比 `>2` は仕様にないQA条件で、連続する低音背景も混ぜていた。原音の比は約1.983896。 |
| 05 | 主音出力を通過後、callerのDB連鎖でFAIL | 夕方を虫帯域・2秒周期・無声区間・隣接帯域で独立評価した。次の失敗は、JSONから読み戻したpairでown-propertyの `undefined` が消え、native structured-clone baselineとのstrict比較が不成立になったこと。 |
| 06 | 停止・復帰の選定経路PASS | 既存exact deltaが通ったnative pairだけを最大128件のmemoryへ保持し、入出力をstructuredClone。JSON正規化はせず、全DB・予約のstrict比較を維持。main測定は再実行していない。 |

アプリ原音・gain・周波数・native再生schedule・三音の50–150ms必須窓は変更していない。夕方のQAは2700Hz carrierを含む2400–3000Hz帯域と、1500–2100／3300–3900Hzの対照帯域を使う。各2秒の0.08–0.50秒／0.90–1.60秒を固定して比較し、虫なし・風水・連続高音・誤周期・隣接帯域音・広帯域pulseを拒否する。数値は識別用の検査条件であり、実聴の音量基準ではない。

音のpure／fake-native 53件、全DB連鎖等のfocused 12件を合わせた **65件がPASS**。新規3件はundefined維持、copy隔離、実値／予約差拒否、上限／cursor境界を検査する。構文と変更3fileの専用lintもPASS。新規fixtureの所持前提欠如による初回3FAILは、fixtureだけを正してから再確認した。

## 通過した実境界

- **05・主音出力:** 実試聴／置換、三音2周の6必須音窓、native frameから導くsource対応、計測区間のframe／sequence連続性、loop間の無音、OFF／ON、無料3音の実source PCM識別と対応gainの非零出力、解除による無料音復帰。loopの未収録先頭はphone 29.333ms／tablet 24msで、元50–150ms窓は両方すべて採れている。未収録部分そのものは未検証。
- **06・停止と保存:** 実同window別tabで `hidden=true / visibility=hidden / focused=false`、試聴の再演なし、装備loopの停止・復帰、SettingsへのSPA退出と同document再入場、学習開始で島音停止。同じ予約の非最終1問を実回答し、全islands・他store保持とreloadを確認した。各幅49 caller DB checksと9 native module pairsが通過。
- **実到達:** 各runは空DBから実初回3問、3標本の実操作、実通水のbell観察、0ほしの明示取得へ進んだ。保存状態・所持・資格の注入はない。読取／試用は不変、確定操作は指定されたactionとcanonical receiptだけを許可する。

05は停止境界へ入る前に失敗したため、05の主音結果と06の停止結果を分ける。同一のapp20、変更QAの有限差分、同じ音probe／分析であることをclosureで追える。単一runの全通過とはしない。

## 証拠と限界

raw PCM、WAV、native全DB、実画像、browser traceは `output/island-experience/audio-focused-03`、`audio-focused-04`、`audio-focused-05`、`audio-focused-06` に保持する。各 `report.json`、`cleanup.json`、05の `first-failure-diagnostic.json`、immutable `audio-focused-qa-03`〜`06` と各preparationを参照する。大きなrawをこの監査へ複製していない。05・06はbrowser終了、focus driver復元、sourceStableを確認し、各8 PID／両process groupの残存0・一時profile削除も記録した。

**Runtime integrityは上記範囲のみPASS。** 実スピーカー・音量・音色の好み・学習回答cueの実聴、未収録onset、blocked writer／profile race、他版の動作はこの証拠では未検証。視覚の画風一致・全場面の洗練度を音の成功で代替しない。Silent comprehension／楽しさ／学習意欲はHuman N=0で未確認。全仕様41・全Goalの完了ではない。
