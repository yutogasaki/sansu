import assert from 'node:assert/strict';
import { model, plain, checkVendor } from './standard-portal.mjs';
import {checkIntegration} from '../tools/check-portal-integration.mjs';

const board = `# 今進めていること

**採用レビュー待ち。**

## 次の一手

[比較](../../docs/example.md)を確認する。

## 関連する仕事（同時に開始しない）

| 分類 | 仕事 | 現在地 | 次 |
|---|---|---|---|
| 1・体験 | [体験](../../docs/tasks/active/example.md) | ローカル確認 | 実機待ち |

## 実装済みとして扱うもの

- [過去](../../docs/tasks/active/old.md)：完了。
`;
const blocked = '# 確認条件\n\n| 起動 | [実機](example.md) | 未確認 | 端末を用意 |\n';
const data = model({ slug: 'sansu', title: 'Sansu', lastChecked: '2026-10-15' }, board, blocked);
assert.equal(data.tasks.length, 1); // Completed references must not become live tasks.
assert.equal(data.tasks[0].id, 'example');
assert.equal(data.tasks[0].owner, '未設定（要相談）');
assert.equal(data.decisions.length, 2);
assert.equal(data.lastChecked, '2026-10-15');
assert.equal(plain('**説明** [資料](file.md)'), '説明 資料');
assert.throws(() => model({ tasks: [] }, board, blocked), /canonical ledger/);
assert.throws(() => model({}, board.replace('## 実装済みとして扱うもの', '| 1・体験 | [重複](../../docs/tasks/active/example.md) | 現在 | 次 |'), blocked), /Duplicate/);
assert.throws(() => model({}, '# 壊れた形式 docs/tasks/active/example.md', blocked), /Unrecognized live/);
assert.throws(() => model({}, board, '| 壊れた確認表 |'), /Unrecognized blocked/);
checkVendor();
console.log('PASS: adapter membership, unknown ownership/deadline, malformed/duplicate rejection, fixed date and vendor SHA');
checkIntegration();
