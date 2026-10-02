import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import { seedDev, waitMode, runtimeMetadata, appRootMetadata } from '../../../tools/island-e2e-helpers.mjs';
const out = 'docs/design/2026-10-02-island-play-menu';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
try {
 const page = await context.newPage(); await page.goto('http://127.0.0.1:5274/#/island');
 const id = await seedDev(page, { name: 'Yu', familiar: true });
 await page.evaluate(async id => {
  const { growingDb } = await import('/src/domain/growingIsland/repository.ts');
  const { newIsland } = await import('/src/domain/growingIsland/island.ts');
  const state = newIsland(id, Date.now()); state.tutorial = 'done'; state.guidance.starter.automatic = false;
  state.villagers = ['rabbit', 'otter'].map((species, i) => ({ id: `direction-${i}`, species, trait: 'mellow', home: 'pokomoko', arrivedAt: i, variant: { color: i, accessory: 0, sparkle: false } }));
  await growingDb.islands.put({ profileId: id, version: 3, revision: 1, createdAt: Date.now(), updatedAt: Date.now(), state });
 }, id);
 await page.reload(); await waitMode(page, 'home'); await page.locator('.growing-loading--overlay').waitFor({state:'hidden'});
 await page.locator('.growing-menu-button').tap();
 const variants = { A: '', B: '.growing-pocket-primary>button{background:transparent!important;box-shadow:none!important}.growing-pocket-primary>button::after{display:none}', C: '.growing-pocket-primary{grid-template-columns:1fr}.growing-pocket-primary>button{flex-direction:row;align-items:center;min-height:72px;padding:0}.growing-pocket-model{width:116px;height:72px}.growing-pocket-main-copy{text-align:left}' };
 const report = [];
 for (const [name, css] of Object.entries(variants)) {
  const style = await page.addStyleTag({ content: css || '/* A: cloth dioramas */' }); await page.waitForTimeout(300);
  await page.screenshot({path:`${out}/direction-${name}.png`}); report.push({name, css, ...await runtimeMetadata(page), appRoot: await appRootMetadata(page), menuCandidate: await page.locator('[data-menu-candidate]').getAttribute('data-menu-candidate'), viewport: page.viewportSize(), evidence:'Actual runtime with explicit temporary CSS direction override; author comparison, not approved final UI or independent child observation'}); await style.evaluate(e=>e.remove());
 }
 await fs.writeFile(`${out}/directions.json`,JSON.stringify(report,null,2));
} finally { await context.close(); await browser.close(); }
