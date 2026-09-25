# Sansu 文書の入口

[HTMLで見る](index.html) · [現在のタスク](../.agents/tasks/index.html) · [仕様書の地図](product/README.md)

このページは「どの文書を見れば何が分かるか」を人向けに案内する入口です。
最新情報を探すときは、長い完了ログや検証番号からではなく、下の分類から入ってください。

**まず読む：[今の島に、自然と町の仕組みを取り込む](product/island-nature-integration.md)。** 今の島を本体にし、Nature Townを別作品としては進めません。何を残し、何を取り込むかを一枚にまとめました。

## 今の全体像

| 分類 | 何のことか | 今の状態 |
|---|---|---|
| **今のアプリ** | 子どもが学習し、「不思議な島」で家や住人の暮らしを楽しむもの | 家庭内で使う標準版。画面の使いやすさを仕上げている |
| **不思議な島の改善版** | 発見、植物、地形、光や影をもっと魅力的にする計画 | 一部を実装済み。世界全体の美術と実際の子どもの確認が残る |
| **自然と町を育てる** | 水・植物・食べ物の運搬・入居・土地拡張を、今の島へ取り込む | 統合方針を採用。仕組みの移植はこれから。別の絵の町は作り続けない |
| **昔の遊び** | 旧探索ゲーム、2人ゲーム、遊園地など | 一部は今も選んで遊べる。今のアプリの標準画面ではない |

### 迷ったら、この3つだけ見る

1. [現在のタスク](../.agents/tasks/TASKS.md)：今どこまで進み、次に何をするか。
2. [仕様書の地図](product/README.md)：今の仕様、将来案、昔の仕様の区別。
3. [保留中](../.agents/tasks/BLOCKED.md)：人や実機の確認を待っているもの。

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
- ぴったり連鎖は[仕様27](product/27_gameplay_first_pittari_spec.md)。限定範囲の独立試作。

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
