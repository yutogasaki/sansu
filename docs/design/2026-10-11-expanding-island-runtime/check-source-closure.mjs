import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.argv[2] ?? path.resolve(here, '../../..'));
const build = JSON.parse(fs.readFileSync(path.join(here, 'builds/new.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const allowed = {
  'tools/e2e-smoke.mjs': {
    scope: 'QA runner only: use the existing one-input readiness helper at the next problem boundary.',
    restore: text => text.replace('await typeExploreNumericOnce(page, rapidAnswer);', 'await page.keyboard.type(String(rapidAnswer));'),
  },
  'src/prototypes/placeQa/expansion.tsx': {
    scope: 'DEV-only comparison entry: do not restart a loading label when the displayed island is unchanged.',
    restore: text => text
      .replace("if (size !== 8 && direction !== item.id) setStage('scene'); setDirection(item.id); setFocus(undefined);", "setDirection(item.id); setFocus(undefined); setStage('scene');")
      .replace("if (size !== count) setStage('scene'); setSize(count); setFocus(undefined);", "setSize(count); setFocus(undefined); setStage('scene');"),
  },
};
const deltas = [];
for (const [relative, built] of Object.entries(build.inputs)) {
  const bytes = fs.readFileSync(path.join(repo, relative));
  const current = hash(bytes);
  if (current === built) continue;
  assert(allowed[relative], `Unexpected post-build input change: ${relative}`);
  assert.equal(hash(allowed[relative].restore(bytes.toString('utf8'))), built, `Delta exceeds the reviewed correction: ${relative}`);
  deltas.push({ path: relative, builtSha256: built, currentSha256: current, scope: allowed[relative].scope });
}
assert.equal(deltas.length, 2, 'Both documented post-build QA/DEV corrections must be explicit.');
const smoke = JSON.parse(fs.readFileSync(path.join(here, 'classic/smoke-report.json'), 'utf8'));
assert.equal(smoke.harnessHash, deltas.find(item => item.path === 'tools/e2e-smoke.mjs').currentSha256);
assert.equal(smoke.pass, true);
assert.equal(smoke.scenarios.length, 32);
// Both exceptions have separate entry points; neither is imported by the app entry.
const appInputs = Object.keys(build.inputs).filter(file => file.startsWith('src/') && !file.startsWith('src/prototypes/'));
for (const relative of appInputs) {
  const text = fs.readFileSync(path.join(repo, relative), 'utf8');
  assert(!text.includes('placeQa/expansion') && !text.includes('tools/e2e-smoke'), `QA entry imported by app: ${relative}`);
}
const result = {
  schema: 'sansu-expanding-source-closure-v1', buildVersion: build.version.version,
  buildSourceSha256: build.sourceHash, checkedInputs: Object.keys(build.inputs).length,
  byteIdenticalInputs: Object.keys(build.inputs).length - deltas.length,
  appRuntimeInputsUnchanged: true, appInputCount: appInputs.length, postBuildCorrections: deltas,
  classic: { report: 'classic/smoke-report.json', pass: true, scenarios: 32, target: smoke.target, harnessSha256: smoke.harnessHash },
  devComparison: { target: 'http://127.0.0.1:5334/prototypes/place-qa/expansion.html', screenshot: 'showcase-preview.png',
    manualChecks: ['Repeated selected 16 button', 'Repeated selected direction', '8-home common centre direction change', '32 forest to garden', 'Return to bay 16'],
    browser: 'Codex in-app browser, tab 14', verdict: 'PASS' },
  limitation: 'The full current source tree is not identical to the A3 build snapshot. Only the listed QA/DEV entries differ; production runtime input bytes remain identical.',
  pass: true,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
