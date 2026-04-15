# Doc Sync

コード変更に伴い、更新すべき spec・memory・ADR・runbook を判定してdocs更新漏れを減らす。

## 参照順

1. `CONSTITUTION.md`
2. `docs/ai/ownership_map.md`
3. `docs/product/01_app_spec.md`
4. `docs/ai/verification_matrix.md`
5. `docs/wiki/memory.md`
6. 対象差分（`git diff --stat` / `git diff`）

## 判定フロー

### A. 変更タイプを分類
- 仕様変更 / UI・トーン変更 / 検証・運用変更 / データ・移行変更 / 純粋な内部整理

### B. 更新先を決定
- SSOTが変わる → まずその正本docを更新
- statusだけ変わる → status docだけ更新
- 高コストで再発しそうな判断 → `docs/wiki/memory.md` か ADR を検討
- 手順変更 → `docs/runbooks/` を更新

### C. 追加確認
- `docs/wiki/risk_register.md` の緩和策に影響するか
- `docs/ai/verification_matrix.md` の要求に影響するか
- `docs/done/` に残すべき完了事実があるか

## 出力フォーマット

```
## Doc Sync Report
### Summary
- Change type:
- SSOT update needed: Yes / No

### Required Updates
- file: reason

### Optional Updates
- file: reason

### No-Change Justification
- file: reason
```

## 禁止
- status docだけ更新してSSOTを放置しない
- docs/wiki/memory.md に一時メモを入れない
- done logを現行仕様の根拠にしない
