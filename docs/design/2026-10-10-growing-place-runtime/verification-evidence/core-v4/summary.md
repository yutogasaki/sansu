# Growing verification

Checks: FAIL
Release: PARTIAL

- core: PASS
- classic-smoke: FAIL
- growing-guidance-production: NOT_RUN
- growing-balance-production: NOT_RUN

Error: npm run e2e:smoke failed (1); see classic-smoke.log
    at ChildProcess.<anonymous> (file:///Users/yutogasaki/Projects/sansu/tools/verify-growing.mjs:160:29)
    at Object.onceWrapper (node:events:631:26)
    at ChildProcess.emit (node:events:509:28)
    at maybeClose (node:internal/child_process:1124:16)
    at Socket.<anonymous> (node:internal/child_process:481:11)
    at Socket.emit (node:events:509:28)
    at Pipe.<anonymous> (node:net:351:12)

## Not verified

- Growing実two-build更新・更新中断復旧・旧writer/rollback
- 既存利用者の実保存引き継ぎ・本人切替の故障診断
- 実iOS/Android・音/写真・人口と物が増えた島の性能
- 採用美術とのcritical-path比較・子どもの無説明理解/安全・翌日の再訪
