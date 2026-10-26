import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const output = process.env.SANSU_RESIDENT_OUTPUT;
assert(output, 'Specify a fresh SANSU_RESIDENT_OUTPUT');
await fs.mkdir(output, { recursive: false });
const base = process.env.SANSU_RESIDENT_URL || 'http://127.0.0.1:5296';
const paths = ['src/components/island/growing/GrowingSheet.tsx', 'src/components/island/growing/houseGuests.ts', 'src/components/island/growing/growingLife.ts', 'tools/fixtures/resident-audit.html', 'tools/e2e-resident-audit.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const report = { at: new Date().toISOString(), scope: 'Isolated real GrowingSheet with synthetic props. Component diagnostics, not full-app/PWA acceptance; no user DB.', inputs: await hashes(), scenarios: [], pass: false };
const browser = await chromium.launch();
let page;
try {
 for (const width of [390, 768, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/tools/fixtures/resident-audit.html`);
  const names = () => page.getByTestId('names').textContent().then(JSON.parse);
  const edit = async () => {
   const details = page.locator('.growing-sheet-details');
   if (await details.getAttribute('open') === null) await details.locator('summary').click();
   await page.getByRole('button', { name: 'なまえを つける', exact: true }).click();
  };
  await edit(); await page.getByRole('textbox', { name: 'なまえ', exact: true }).fill('Aだけの下書き');
  await page.getByRole('button', { name: '住人bを選ぶ', exact: true }).click();
  const leaked = await page.getByRole('textbox', { name: 'なまえ', exact: true }).count();
  await page.screenshot({ path: `${output}/${width}-switch.png` });
  if (leaked) {
   const draft = await page.getByRole('textbox', { name: 'なまえ', exact: true }).inputValue();
   await page.getByRole('button', { name: 'きめる', exact: true }).click();
   report.scenarios.push({ width, leakedDraft: draft, saved: await names(), pass: false });
   assert.fail('Draft from resident a was submitted as resident b');
  }
  await edit(); assert.equal(await page.getByRole('textbox', { name: 'なまえ', exact: true }).inputValue(), 'つき');
  await page.getByRole('textbox', { name: 'なまえ', exact: true }).fill('そら');
  await page.getByRole('button', { name: 'きめる', exact: true }).click();
  assert.deepEqual(await names(), [{ id: 'a', name: 'ほし' }, { id: 'b', name: 'そら' }]);
  await edit(); await page.getByRole('textbox', { name: 'なまえ', exact: true }).fill('別島へ持ち越さない');
  await page.getByRole('button', { name: '別の本人へ', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'なまえ', exact: true }).count(), 0);
  await edit(); assert.equal(await page.getByRole('textbox', { name: 'なまえ', exact: true }).inputValue(), 'そら');
  await page.screenshot({ path: `${output}/${width}-own-name.png` });
  assert.deepEqual(errors, []);
  report.scenarios.push({ width, targetSwitch: true, ownerSwitch: true, distinctNames: await names(), errors, pass: true });
  await context.close();
 }
 assert.deepEqual(await hashes(), report.inputs);
 report.pass = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally { await fs.writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, scenarios: report.scenarios, error: report.error }));
