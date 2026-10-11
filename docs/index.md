# Sansu 文書の入口

2026-10-11 本人の島へ接続：[採用3Dを自分の島へ移す](design/2026-10-11-native-owned-island/README.md)。原本の家・樹種・扇葉・花弁・透ける殻を、本人の所有と成熟・配置・実床から描きます。制作模型の家や人物を所有へ取り込まず、学習・取得・保存・時計を保ちます。深い入り江と高い段泉の全地形は次の主課題です。[実装契約](product/island-native-owned-art.md)。

2026-10-11 全島の美術を制作：[小さな島・育ち途中・育った島の3D](design/2026-10-11-island-growth-art/index.html) · [編集素材と制作記録](design/2026-10-11-island-growth-art/README.md)。採用したnative-05を原本に、海岸線と丘、水路、道、若い大樹・花・貝を作り、本体の美術確認で切り替えます。家の尺度と主要な場所の位置を保ち、本人の保存や成長時計との接続は別工程です。

2026-10-10 制作順を改訂：[完成した全島から本体へ移す](design/2026-10-10-native-art-transfer/README.md)。採用native-05の原本を、本体の開発用美術確認として全景・4地区・昼夕で描きます。次は地形と実床、同じ部品から成長段階、最後に場所同士と暮らしを接続します。通常の所有島の到達や美術の再承認ではありません。

2026-10-10：採用した全島3Dを[育つ場所の目標と組み合わせ](product/island-place-goals.md)へ具体化。[目標・配置の設計ショーケース](design/2026-10-10-island-place-goals/index.html)で6目標、同じ材料の15配置、4つの場所の関係と実装順を確認できます。D1〜D4を本体へ統合し、実3D・目標・保存4を同じ規則へつなぎ、通常取得3旅程・成熟40組・coreと保存/更新のローカル検証を完了しました。[最新の実画面と検証](design/2026-10-10-growing-place-runtime/index.html)で目標との比較を見返せます。機能のローカル検証と美術の完成は別です。利用者の「全く届いてない」を受け、本体v3の美術はHOLDへ差し戻しました。実機・独立観察・公開は別ゲートです。

島全体の到達点を実物で確認：[編集可能な全島3D美術1案](design/2026-10-10-island-final-3d/README.md)。Blenderの実モデル・GLB・回転できる表示で、岸・起伏・水辺・森・庭・街区を同時に確認します。画像生成から実造形へ制作方式を変更。単調さと「白いだけ」の指摘を受け、青紫の大樹と枝の回廊、鉱石を源とする青い段泉、色を透かす貝殻状の集会所、傘屋根/葉屋根の家へ改訂しました。元の庭と同じ縮尺で切り替えられます。native-05を利用者の好評価に基づく美術方向として採用。配置から育つ場所の本体統合は[実装ショーケース](design/2026-10-10-growing-place-runtime/README.md)を参照。見本の森/庭の密度、深い入り江、段差と滝の構成は本体v3へ未再現です。[以前の全景生成画像](design/2026-10-10-whole-island-art-directions/index.html)は制作履歴。

島の根本再設計：[島構築戦略](product/island-construction-strategy.md) · [美術戦略](product/island-art-strategy.md) · [成長系列](product/island-place-growth-proposal.md) · [32枚の参考と戦略ショーケース](design/2026-10-10-island-design-strategy/index.html)。現行構造を監査し、土地・水辺・植物・集落・不思議を、同じ材料の置き方から育つ場所として設計します。

**島の現行実装はひとつ：[実装と保存の境界](architecture/island-runtime.md)。** 育つ島を本体にし、旧Life/Home Journey/Nature Townの独立画面を撤去。家・本・学習と旧保存の互換処理は共用して保持します。公開状態は現在のタスクを参照。

**2026-09-29 北極星を改訂：** [CONSTITUTION](../CONSTITUTION.md)の北極星を旧探索（地底）から「育つ島」（くふう・にぎわい・ふしぎ＋愛着）へ。人口は地区ごとに増やし、学習は材料と道具をもたらす。[決定の記録](adr/2026-09-29-north-star-growing-island.md)。仕様51の住人上限3などは無効で、[整合表](product/51_living_fantasy_island_spec.md#北極星との整合2026-09-29)に従う。次期の遊びの規則は[52 育つ島 ゲーム仕様](product/52_growing_island_game_spec.md)（しこむ→まなぶ→ひらく。実装・公開状況はタスク参照）。

更新: 2026-10-05。[現在のタスク](../.agents/tasks/TASKS.md)は、最新候補の統合・公開準備を先頭に、全体UX・性能・美術の4担当へ整理。[後続候補](tasks/backlog.md)と[実機・利用者の確認待ち](../.agents/tasks/BLOCKED.md)を分けました。10/1の育つ島初回本番切替は実施済みですが、その後の変更と橋/保護者設定/本人切替の最新候補の公開確認は別作業です。今回の整理ではアプリや本番を変更していません。


2026-09-27: [幻想の庭と自然の暮らしを本番へ統合](design/2026-09-27-fantasy-production/README.md)。元のぽこもこ、学習、持ち物を保持し、更新・オフライン・互換復旧を検証。全v1と実機確認は別。

[HTMLで見る](index.html) · [仕様と実装のマップ](../.agents/map.html) · [現在のタスク](../.agents/tasks/index.html) · [仕様書の地図](product/README.md)

このページは「どの文書を見れば何が分かるか」を人向けに案内する入口です。
最新情報を探すときは、長い完了ログや検証番号からではなく、下の分類から入ってください。

**次期の設計を読む：[51 幻想の暮らし・包括仕様](product/51_living_fantasy_island_spec.md)。** 2026-09-27策定。世界観・美術・遊び・学習・経済・発見・画面・保存移行・共有・検証を8章に整理。[現在のプレビュー](design/2026-09-27-living-fantasy-first-playable/index.html)は実アプリを直接表示します。ぽこもこは[元のデザインを維持](design/2026-09-27-pokomoko-restored/README.md)し、Nature Townの自然・物流は同じ島へ部分統合しています。[続きの範囲](tasks/active/2026-09-27-living-fantasy-first-playable.md)を残し、最終美術・v1全体の完成とは区別しています。庭と自然の第一弾は公開済みです。

**まず読む：[今の島に、自然と町の仕組みを取り込む](product/island-nature-integration.md)。** 今の島を本体にし、Nature Townを別作品としては進めません。何を残し、何を取り込むかを一枚にまとめました。

育つ島の経済・育成時間・出来事と保存互換：[バランスの契約](product/growing-island-balance.md)。

育つ島の任意の導きと記念：[スターターとアチーブメントv1](product/island-starter-achievements-proposal.md)。S1〜S5/A1〜A6・本・保存3をローカル実装し、[固定両幅の実画面と検証](design/2026-10-01-island-guidance/README.md)を残しています。公開・実機・子どもの観察は別の状態です。

## 今の全体像

| 分類 | 何のことか | 今の状態 |
|---|---|---|
| **今のアプリ** | 子どもが学習し、「不思議な島」で家や住人の暮らしを楽しむもの | 家庭内で使う標準版。画面の使いやすさを仕上げている |
| **不思議な島の改善版** | 発見、植物、地形、光や影をもっと魅力的にする計画 | 一部を実装済み。世界全体の美術と実際の子どもの確認が残る |
| **自然と町を育てる** | 水・植物・食べ物の運搬・入居・土地拡張を、今の島へ取り込む | 自然循環に好きな場所/共同食からの招待と明示入居を接続。同じ土地拡張を利用し、既存の住人・所有を保持。仕様51全体は継続 |
| **昔の遊び** | 旧探索ゲーム、2人ゲーム、遊園地など | 一部は今も選んで遊べる。今のアプリの標準画面ではない |

### 迷ったら、この3つだけ見る

1. [現在のタスク](../.agents/tasks/TASKS.md)：今どこまで進み、次に何をするか。
2. [仕様書の地図](product/README.md)：今の仕様、将来案、昔の仕様の区別。
3. [保留中](../.agents/tasks/BLOCKED.md)：人や実機の確認を待っているもの。

[仕様と実装のHTMLマップ](../.agents/map.html)では、主な機能の現在地、関連仕様とコード、仕様書や画像・3D素材のファイル容量をまとめて見られます。

## 目的から選ぶ

| 知りたいこと | 開く文書 |
|---|---|
| 今のアプリは何を目指しているか | [最上位の方針](../CONSTITUTION.md)と[アプリ全体の仕様](product/01_app_spec.md) |
| どの仕様が何の話か | [仕様書の地図](product/README.md) |
| 今、何を進めているか | [現在のタスク一覧](../.agents/tasks/TASKS.md) |
| 次に何をするか | [全体バックログ](tasks/backlog.md) |
| 人・実機・外部確認を待っているもの | [保留中の一覧](../.agents/tasks/BLOCKED.md) |
| 最近終わったこと | [完了一覧](../.agents/tasks/DONE.md)と[月別完了記録](done/) |
| 変更後に何を確認すべきか | [変更ごとの確認項目](ai/verification_matrix.md) |
| どの文書を更新すべきか | [話題と更新先の対応表](ai/ownership_map.md) |

## 文書の種類を混ぜない

| 種類 | 答える質問 | 置き場所 |
|---|---|---|
| 仕様 | 製品はどう動くべきか | `docs/product/` |
| 現在のタスク | 今、誰が何をどこまで進めているか | `.agents/tasks/TASKS.md` と `docs/tasks/active/` |
| バックログ | 次にやる候補と順番は何か | `docs/tasks/backlog.md` |
| 検証記録 | どの版を、何で、どこまで確認したか | `docs/design/` の日付付き監査 |
| 完了記録 | 過去に何が終わったか | `docs/done/` |
| 運用手順 | リリースや移行をどう安全に行うか | `docs/runbooks/` |
| 共有知識 | 複数の仕事で長く使う判断や用語 | `docs/wiki/` と `docs/adr/` |

仕様が存在しても、実装・検証・公開まで終わったとは限りません。
反対に、完了記録は過去の事実であり、現在の挙動を決める仕様ではありません。

## 製品・機能別の入口

### 現行の標準アプリ

- [親仕様01](product/01_app_spec.md)：アプリ全体と現在の標準入口。
- [不思議な島28](product/28_mystic_island_spec.md)：通常学習と島の基本ループ。
- [暮らす島48](product/48_island_life_spec.md)：家庭内で使う「暮らす島」、購入、配置、住人の行動。
- [ナビゲーション43](product/43_island_navigation_spec.md)：島、家、学習、記録、設定の行き来。
- [画面レイアウト44](product/44_display_layout_spec.md)：各画面で何を主役にするか。

### 学習

- [算数02](product/02_math_skills.md) / [英語03](product/03_english_skills.md)：教材と技能。
- [学習曲線29](product/29_learning_progression_spec.md)：初回難度と段階進行。
- [学習単元31](product/31_learning_units_spec.md)：単元と習得証拠。
- [教材の意味・種類・導入](product/learning-content-integrity.md)：語義・問題の型・基礎9教材と保存互換。
- [学習強化34](product/34_learning_reinforcement_spec.md)：独力正解、再学習、復習期限。

### 島の次の段階

- [不思議な島 v3・仕様50](product/50_mysterious_island_discovery_spec.md)：発見を中心にした段階導入。
- [地区・施設カタログ49](product/49_island_growth_catalog_spec.md)：次期の地区、品揃え、特殊施設。現行挙動ではない。
- [家から育つ島47](product/47_home_island_integration_spec.md)：家の外・室内・学習の統合と引継ぎ。

### 自然と町を育てる（今の島へ統合）

- [統合方針](product/island-nature-integration.md)：今の島に何を残し、何を取り込むか。
- [統合タスク](tasks/active/2026-09-22-island-nature-integration.md)：今どこまで進み、次に何をするか。
- [Nature Townの仕組み資料](product/nature-town/00_START_HERE.md)：再利用する自然・運搬・入居の計算。

旧試作の別画面と検証履歴は[過去の資料](product/archive/README.md)へ分けています。コードと保存データは保持し、統合後の完成・合格とは区別します。

### 残っている旧モード・試作

- 旧探索モード（Explore）は[探索仕様10](product/10_exploration_game_spec.md)から[旧Explore検証15](product/15_mvp_rollout_verification_spec.md)まで。現在の「不思議な島」の標準入口ではない。
- 2人ゲームは[バトル仕様09](product/09_battle_spec.md)。任意のレガシーモード。
- 旧遊園地（Park）は[遊園地仕様22](product/22_shared_subject_build_and_play_spec.md)。公開終了後の保守・保存契約。
- 終了した試作「ぴったり連鎖」は[過去の資料](product/archive/README.md)に保管しています。

詳しい分類と「現行／旧モード／試作／提案」の区別は[仕様書の地図](product/README.md)を参照してください。

## 現在の作業を読む

話題は「学ぶ」「島で暮らす・つくる」「自然と町を育てる」「見た目・使いやすさ」「記録・保存・安心」「過去の案・試作」に分けます。
進み具合は別に「今使える／改善中／これから作る／過去の資料」で示します。アプリ名や開発用の略語だけで分類しません。

[現在のタスク一覧](../.agents/tasks/TASKS.md)には「何の話か／現在地／次の一手」だけを載せます。
検証回数、画面番号、長い経緯は各詳細タスクに置き、一覧を作業ログにしません。

## 状態を読むときの注意

- `実装済み`：コードや文書へ反映した。
- `検証済み`：明記した範囲の検査に通った。
- `公開済み`：利用する配布先へ反映した。
- `実機確認済み`：対象の物理端末で確認した。
- `参加者確認済み`：子どもや保護者など対象者の観察を行った。

これらは別々の状態です。「自動テスト合格」を「子どもが楽しめることの確認」として扱いません。

## 開発・運用の入口

| 文書 | 用途 |
|---|---|
| [共有エージェントガイド](../.agents/agent-guide.md) | 日々の作業ルールと読む順番 |
| [検証マトリクス](ai/verification_matrix.md) | 変更種類ごとの必須確認 |
| [育つ島の検証入口](runbooks/growing-verification.md) | `npm run verify:growing` で隔離候補の自動検査と結果集約 |
| [差分から検証を選ぶ](runbooks/verification-plan.md) | Git差分から必要チェック・仕様・手動確認を案内 |
| [育つ島の固定検証データ](runbooks/growing-fixtures.md) | 初期/育ち途中/混雑を同じ保存から再現してUIを比較 |
| [リリース手順](runbooks/release-checklist.md) | リリース前の確認 |
| [PWAリリース手順](runbooks/pwa-release.md) | 更新、オフライン、データ保持 |
| [保存移行手順](runbooks/schema-migration.md) | Dexieや保存形式を変えるとき |
| [HTMLポータルの更新](runbooks/repository-portal.md) | この一覧をブラウザで見るための生成方法 |

## 更新ルール

- 挙動を変えるときは、先に親仕様または該当する子仕様を更新する。
- 現在地はタスクへ、過去の事実は完了記録へ、長く残す判断はwikiまたはADRへ書く。
- 状態メモを仕様の代わりにしない。完了ログから現行挙動を推測しない。
- 文書だけの変更でも `npm run docs:check` を実行する。
- HTMLは生成物。Markdownを更新後、`npm run agent:index` で再生成する。

## 宣伝用Webサイト

[仕様53](product/53_promotion_website_spec.md) · [完成画面と制作記録](design/2026-10-10-promotion-website/README.md)。島の成長差・家・算数と英語を紹介する独立サイト。
