# ぴったり連鎖の独立試作

対象は5・10の正の数の合成／補数。元の添付HTMLは未受領のため、盤面とソースは新作 `pittari-positive-v1`。

## 遊ぶ

- リポジトリで `npm run dev:pittari`。`http://127.0.0.1:5197/prototypes/pittari/` を開く。
- `npm run build:pittari` で `output/pittari/pittari_chain.html` を出力する。ブラウザへドラッグするか直接開く。外部素材・フォント・パッケージの通信は不要。
- 通常の本体buildには組み込まれない。公開URL、本体ルート、初回登録、PWA登録、学習DBを変更するエントリではない。

「保護者・制作担当向け」から「10をつくる・3」を選ぶ。中央3→右7で1連鎖、ひとつもどす→左7→中央3で2連鎖。4は反転。6は4列で、別の手動ペアを選んで全部つなぐ。

## ソースと検証

- `src/prototypes/pittari/engine.ts`: 隣接判定・落下・自動連鎖・全到達状態検査。
- `boards.ts`: 新規12盤面。配列は各列の下から上。
- `state.ts`: 版付き手動履歴からの再構成・専用保存・セッションログ。
- `main.ts` / `view.ts` / `style.css`: 操作、因果の表示、音、2D盤面。
- `npx vitest run src/prototypes/pittari/engine.test.ts`: 算術・盤面・保存・ログ契約。
- `npm run build:pittari` 後、5197でDEVを起動し `npm run e2e:pittari`: 全面実クリック、左右比較、取消・再開、保存不能、表示サイズ、単一HTML起動。

ルール・観察方針は [製品仕様](../../docs/product/27_gameplay_first_pittari_spec.md)、実証拠と制限は [監査記録](../../docs/design/audits/2026-09-06-pittari/README.md) を参照。
