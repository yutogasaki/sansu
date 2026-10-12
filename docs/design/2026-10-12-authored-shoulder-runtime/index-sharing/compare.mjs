import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const before = read('before/report.json'), after = read('after/report.json');
for (const report of [before, after]) {
    assert(report.completed && !report.error && !report.selfStopped, 'Both three-state diagnostics must finish');
    assert(report.inputsUnchanged && report.reviewedFilesUnchanged && report.c1InputsUnchanged && report.installedUnchanged);
    assert.deepEqual(report.steps.map(step => step.label), ['baseline32', 'preview-l33', 'commit-l33']);
}
for (const field of ['node', 'heapLimit', 'heapStopBytes', 'reserveBytes', 'scriptSha256', 'preparedInputsSha256'])
    assert.deepEqual(after[field], before[field], `Same diagnostic condition: ${field}`);
assert.deepEqual(after.initialInstalledDependencies, before.initialInstalledDependencies);
const entries = before.steps.map((step, index) => {
    const changed = after.steps[index];
    for (const field of ['label', 'frameRevision', 'worldRevision', 'waterPlanRevision', 'covePlanRevision', 'canonicalSha256',
        'ownerCount', 'drops', 'nextId', 'proof']) assert.deepEqual(changed[field], step[field], `${step.label}: ${field}`);
    return { label: step.label, proof: step.proof, frameRevision: step.frameRevision,
        before: { retained: step.afterGC.heapUsed, sampledAfterCall: step.afterNoGC.heapUsed, rss: step.afterGC.rss, operationMs: step.operationMs },
        after: { retained: changed.afterGC.heapUsed, sampledAfterCall: changed.afterNoGC.heapUsed, rss: changed.afterGC.rss, operationMs: changed.operationMs },
        retainedReductionBytes: step.afterGC.heapUsed - changed.afterGC.heapUsed,
        sampledAfterCallReductionBytes: step.afterNoGC.heapUsed - changed.afterNoGC.heapUsed };
});
const result = { scope: 'Three direct-domain states in separate processes. Exact payload/query parity plus retained/sample measurements; not application performance acceptance.',
    payloadAndQueryParity: true, sourceUnchanged: true, steps: entries,
    limits: ['Checkpoint GC affects scheduling', 'After-call heap is a sample, not true transient peak', 'No renderer/browser/actor full journey'] };
fs.writeFileSync(path.join(directory, 'comparison.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
