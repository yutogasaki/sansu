# リポジトリ標準 1.0（H-015、2026-10-15）

各リポジトリは同じ入口・役割・ポータル契約を持つ。既存の正本、スキル、技術構成、検証条件を置き換えない。hubは共通契約と生成部品の正本で、各製品のソースや個人情報を集めない。

この文書は採用する標準なので`common-ai/`に置く。比較調査・観測・推測は`knowledge/repo-standard/`に分離した。これはH-015で決めた移行先の契約であり、他repoへの変更や公開を実施・承認した記録ではない。

## 基本構造と正本

```text
README.md                     人向けの目的・開始方法・文書とportalへの案内
AGENTS.md                     AI向けの短い入口（対象・正本・検証・禁止境界）
CLAUDE.md                     必要なツールの薄いアダプタ（重複する規則を書かない）
docs/
  index.md                    正本と読む順の索引・旧パスとの対応表
  strategy/                   目的・対象・優先順位・仮説・判断理由
  maps/                       製品/業務/データ/学習などの関係図と生成元の説明
  adr/                        重要な設計判断、状態・日付・選択肢・結果
  tasks/                      新規repoのタスク正本（下記）
    backlog.md                優先順位付き一覧
    active/                   ID単位の実行記録
    done/                     完了・検査・残課題
  portal/project.json         標準ポータル入力（正本から作る小さなアダプタ出力も可）
qa/
  evidence/<task-id>/          検査ログ・撮影・対象版・コマンド・結果
scripts/                      固有の生成/検証アダプタ
portal/                       すべて生成物（手編集しない）
  index.html                  標準5節
  data/project.json           共通スキーマのデータ
  portal.css                  共通スタイル
  references/*.html           明示した資料・AI入口のエスケープ済み閲覧コピー
  .generated-by-hub-standard  共通builderの所有マーカー
```

これは役割の標準である。内容がない任意フォルダを空で大量に作る必要はない。新規文書はlowercase-kebab-case、日付はYYYY-MM-DD、AGENTS.md等の外部慣習は例外とする。

既存repoは`docs/index.md`から実際の正本を示せば段階適合とする。`.agents/tasks/`、`quality/`、`reports/`、ルート`adr/`、番号付きdocs、製品固有の`plans/`等は移動しない。とくにAYAMIの戦略HTMLは現行契約上の正本なのでそのまま扱う。生成物かどうかは拡張子ではなく正本契約で決める。

タスクのID・状態・担当・範囲・依存・完了条件・検証・根拠を正本に記す。同じrepoに2つの実行台帳を新設しない。既存`.agents/tasks/TASKS.md`等を維持し、`docs/tasks/`を作る場合は正本へ案内するだけにする。hubの横断タスクは`tasks.md`、横断決定は`decisions.md`のまま。

QA証拠には対象commitまたは入力hash、日時、コマンド、期待/実結果、限界を残す。ファイルの存在をPASS、mtimeを内容確認日、過去のPASSを現候補のPASSと読み替えない。機密・実際の個人情報は共通ポータルやhubへ持ち込まない。

AGENTS.mdには目的、変更境界、正本の場所、最小の検証コマンド、完了条件、外部操作の承認境界を短く示す。仕様本文・ログ・全スキルを複製しない。ツールの自動読込は利用版で確かめる。共通規約は各repoへ固定版で取り込み、プロジェクト固有の規約を優先する。

## ポータルの契約

`portal/index.html`に以下を順に設ける。

| ID | 見出し | 内容 |
| --- | --- | --- |
| overview | 概要 | 何を作るか、状態、担当、次の行動、内容確認日、記録更新日 |
| decisions | 判断待ち | ID・判断・状態・担当・期限・リスク・根拠 |
| tasks | タスク | ID・タイトル・状態・担当・実行・期限・成果物 |
| documents | 資料 | 正本・戦略・地図・決定・必要な版の記録 |
| ai | AI の入口 | AGENTS.mdと必要な正本の閲覧コピーへの導線 |

未登録を「0件確認済み」と見せない。担当・期限が不明なら未確認と表示する。「期日なし（設定不要）」と「未設定（要相談）」を正本で区別する。生成してもlastCheckedを更新しない。確認した本人が内容確認の根拠を持って更新する。

### 共通データ

JSON Schema正本は`common-portal/standard/project.schema.json`（Draft 2020-12）。`common-portal/publish/projects/*.json`とrepoの`portal/data/project.json`に**同じスキーマ**を使う。

- 必須は`slug`（小文字英数字・ハイフン）と`title`。段階移行のため既存metadataをそのまま受け入れる。
- 任意：`schemaVersion`（指定するなら`1.0`）、`summary`、`note`、`owner`、`status`、`nextAction`、`lastChecked`（日付）、`updated`（日付/時差付き日時）、`localPath`、`commits`、`docs`、`ai`、`tasks`、`decisions`。
- `tasks[]`はid/title/status必須、owner/executor/started/deadline/output/notes任意。`decisions[]`はid/title/status必須、owner/deadline/risk/notes任意。未知フィールドや誤った型は失敗する。
- 新規の入力では概要・担当・状態・次の行動・内容確認日・判断・タスク・資料・AI入口を明示することを推奨する。ただし不明な値を作らない。
- `docs[]`・`ai[]`・task.outputはrepo相対の実在するMarkdown/TXT/JSON**ファイル**。ディレクトリ・URL・`..`・絶対パス・機密設定・symlinkを拒否。`ai`省略時はAGENTS.md。`ai:[]`は未登録表示。既存metadataのdocsにディレクトリがある場合、移行アダプタで入口ファイルに解決する。
- メタデータに書かれたコマンドや文章は実行しない。正本の抜粋と明示した資料だけを閲覧面にする。localPathはローカル用の任意ヒントであり、配布JSONから除く。

`docs/portal/project.json`はアダプタの境界である。タスク等の正本が別にあるrepoでは、固有スクリプトが正本からこの入力を生成する。手作業で同じ状態を2か所更新しない。アダプタの同期検査と製品固有の検証は各repoで持つ。

### build / verify

依存追加なし、Node.js 24以上。任意cwdから呼べる。

```sh
node /Users/yutogasaki/Projects/hub/common-portal/standard/build.cjs /path/to/repo
node /Users/yutogasaki/Projects/hub/common-portal/standard/verify.cjs /path/to/repo
# 任意のrepo相対入力を第3引数に指定できる（hub自動取り込みは既定入力を使う）
node /path/to/common-portal/standard/build.cjs /path/to/repo docs/portal/project.json
```

移行先では、固定した共通部品を取り込み`portal:build` / `portal:verify`（npmでないrepoは同名のjust等）を設ける。既存build/verifyや公開コマンドを置換しない。共通`standard/`は従来KeepGoing向けv1.0.0のpayloadとは独立した版1.0.0。導入時はhubのcommit SHAとstandard内の実行ファイルSHAをlockに記録し、repo内vendorへ固定コピーする。更新は別版として比較・検査する。H-015では他repoへコピーしない。

buildは全入力を検証してから`portal/`を再生成する。初回はportal/が存在しない状態を使う。既存の独自portal/は移行タスクで退避・導線互換を設計し、builderに上書きさせない。所有マーカーのない既存portal/やsymlinkは拒否する。マーカー以後のportal/全体は生成専用で、手書き資料は入れない。

verifyは入力と正本からメモリ内で再生成し、全出力のバイト一致と余分なファイルを検査する。入力、資料、AGENTS、共通renderer/CSSの変化で再生成が必要になる。書込みやrepoスクリプトの実行はしない。外部リンク・実機・アクセシビリティ適合・人による内容鮮度はこの一致検査の保証に含まれない。

### hubの集約

`common-portal/publish/sites.cjs`に列挙した7repoだけを調べる。既定入力から生成され共通verifyが通る`portal/index.html`＋`portal/data/project.json`を優先する。標準データも所有マーカーもない独自portal/は未移行として扱う（N-001との互換）。標準導入を示すデータ/マーカーがあるのに片方欠損・型違反・slug不一致・古い場合は停止する。

未移行のkeep-going/MMmindは既存`.agents`経路を維持。他は概要のみ。Businessも標準導入後にローカル集約可能だが移行は最後。Ballet-Managementは別repoであり、恒久的にallowlist外。未知の兄弟ディレクトリやJSON内のlocalPathを自動探索・実行しない。

assembleはrepoに書かず`publish/dist/`の配布コピーだけを作る。HTMLを伏せ字にし、JSONの構文を保って文字列を伏せ字化、localPathを除去。取り込み対象repoの実.env値も照合する。`node verify.cjs`はリンクと秘密情報様文字列を最終検査する。これは認証や全個人情報不存在の証明ではない。

Cloudflare Pages 1サイトの`/`→各専用パス、サイト全体をYuだけのAccessで保護する既存決定を維持。ローカル自動集約と公開承認は別。URL作成・公開・Access変更は`publish/DEPLOY_PLAN.md`に従いYuへ再確認する。

## 段階移行と順番

1. **Jishu**：AGENTS入口と正本地図を先に整備。internal portalの資料・戦略地図・採点/履歴の境界を固有アダプタへ。reportsを消さず互換導線を設計。
2. **keep-going**：既存v1固定vendor・判断モデル・H-005の鮮度と差分・図鑑等を保持。標準入口から既存の深いページへ到達できる構成を固有タスクで設計。
3. **sansu**：agent:index経路を利用。画像webp変換の失敗をまず再現し原因別に修正。trial6の証拠を別候補に流用しない。
4. **ayami-ballet**：web cwdとルートscriptsの関係を維持。戦略HTML正本・共有タスクを移さず入口を接続。
5. **MMmind**：task policy・番号付きdocs・portal-evidence・既存deploy設定を維持。公開は実行しない。
6. **noren-studio**：N-001の成果確定後、portal/build.py・catalog.jsonとdocs/mapsの正本関係を整理。既存portal/を無条件上書きしない。
7. **Business**：Git管理と復元方法をYuが決めてから最後に着手。plans/benchmarksを維持。Ballet-Managementと混同しない。

mmwave-layoutは別マシンへ移したため、このMac上の移行対象とhub掲載から外す（過去の調査記録は残す）。

各段階は①正本/生成元/旧URLの棚卸し ②変更用ブランチと基準証拠 ③固有アダプタと固定部品 ④build・verify・既存検査 ⑤hub assemble/verify・リンク切れ0・1440/390px撮影・必要な実機確認 ⑥差分と未確認の記録 ⑦そのタスクの任せ方に従うcommit、公開は別承認、の順。

旧ファイルは先に消さず互換案内を作る。QAコマンドはhub/AGENTS.mdの一覧および各repoの最新契約を参照し、共通verifyだけで代替しない。H-002の既存依存順と食い違う箇所は本H-015の移行順を後続タスクで反映する（今回他repoは変更しない）。

## 根拠

[ベンチマーク](../knowledge/repo-standard/2026-10-15-benchmark.md)、[現状表](../knowledge/repo-standard/2026-10-15-current-state.md)、[既存決定](../decisions.md)、[共通部品](../common-portal/standard/README.md)。
