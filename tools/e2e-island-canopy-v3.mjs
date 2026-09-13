import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { inventory, closeMenu } from './island-life-ui-helpers.mjs';
import { seedDev, readNative, waitForAsync } from './island-e2e-helpers.mjs';
const out = process.env.SANSU_CANOPY_OUTPUT, base = process.env.SANSU_CANOPY_URL ?? 'http://127.0.0.1:5223';
const candidate = process.env.SANSU_CANOPY_CANDIDATE ?? 'canopy-dots-c3-v1';
assert(out, 'Specify a fresh SANSU_CANOPY_OUTPUT'); await mkdir(out, { recursive: false });
async function sourceHash() {
    const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'src', 'public', 'package.json', 'package-lock.json', 'vite.config.ts'], { encoding: 'utf8' }).trim().split('\n'))].sort();
    const hash = createHash('sha256'); for (const file of files) hash.update(file).update('\0').update(await readFile(file)).update('\0'); return hash.digest('hex');
}
const clearance = candidate.startsWith('canopy-clearance-') ? candidate.split('-')[2] : undefined;
const atmosphere = clearance ? 'shelter' : candidate.startsWith('canopy-atmosphere-') ? candidate.split('-')[2] : undefined;
const sculpt = atmosphere ? 'buttress' : candidate.startsWith('canopy-sculpt-') ? candidate.split('-')[2] : undefined;
const baseline = process.env.SANSU_CANOPY_BASELINE_URL;
if (atmosphere) assert(baseline, 'Specify the matching non-atmosphere DEV target for camera comparison');
const report = { startHash: await sourceHash(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: base,
    candidate, flags: `DEV VITE_ISLAND_LIFE_PREVIEW=true; material study ${candidate === 'canopy-bark-runtime-study-v1' || (candidate.startsWith('canopy-ground-') || (candidate.startsWith('canopy-shore-') || Boolean(sculpt)))}; ground variant ${(candidate.startsWith('canopy-shore-') || Boolean(sculpt)) ? 'turf' : candidate.startsWith('canopy-ground-') ? candidate.split('-')[2] : 'off'}; shore variant ${(candidate.startsWith('canopy-shore-') || Boolean(sculpt)) ? (sculpt ? 'lagoon' : candidate.split('-')[2]) : 'off'}; sculpt ${sculpt ?? 'off'}; atmosphere ${atmosphere ?? 'off'}; clearance ${clearance ?? 'off'}`, cache: 'fresh DEV context; no production SW claim',
    fixture: 'three connected flowers and an explicitly simulated old-world saved memory; no earned acquisition or historical user activity claim', humanN: 0, cases: [], pass: false };
if ((candidate.startsWith('canopy-ground-') || (candidate.startsWith('canopy-shore-') || Boolean(sculpt)))) report.groundAtlasSha256 = createHash('sha256').update(await readFile('docs/design/2026-09-14-canopy-ground/material-atlas.png')).digest('hex');
if (sculpt) report.sculptMeshSha256 = createHash('sha256').update(await readFile(`docs/design/2026-09-14-canopy-sculpt/meshes/${sculpt}.json`)).digest('hex');
const cameraMatrices = raw => { const {projection,view}=JSON.parse(raw); return {projection,view}; };
const browser = await chromium.launch();
try {
    for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }]]) {
        const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: device === 'tablet' ? 'reduce' : 'no-preference' });
        const page = await context.newPage(), errors = []; page.setDefaultTimeout(25000);
        page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
            await page.goto(base); const profileId = await seedDev(page, { familiar: false });
            const original = await page.evaluate(async profileId => {
                const { lifeDb } = await import('/src/domain/islandLife/repository.ts');
                const { newLife, learningDay } = await import('/src/domain/islandLife/model.ts');
                const { commandLife, replayLife } = await import('/src/domain/islandLife/simulation.ts');
                const { evaluateDiscovery } = await import('/src/domain/islandLife/discovery.ts');
                const { createDiscoveryScene, appendPresentedScene, emptyDiscoveryJournal, saveDiscoveryMemory } = await import('/src/domain/islandLife/discoveryJournal.ts');
                if (lifeDb.name !== 'SansuIslandLifePreviewV1') throw new Error('DEV only');
                const at = Date.now(); let record = newLife(profileId, at);
                record.credits = Array.from({ length: 3 }, (_, i) => ({ id: `qa-${i}`, at, day: learningDay(at) }));
                for (let x = 0; x < 3; x++) record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x, z: 3 } }, `qa-flower-${x}`, at);
                const state = replayLife(record), rule = evaluateDiscovery(state, profileId).find(rule => rule.ruleId === 'G0');
                const old = await createDiscoveryScene(profileId, state, rule, 'simulated', 'qa-old-world', at);
                record.discoveryJournal = saveDiscoveryMemory(appendPresentedScene(emptyDiscoveryJournal(), old, {
                    eventId: old.eventId, firstVisibleAt: at, visibleDurationMs: 1000, coreShown: true, presentationKind: 'simulated' }), old.eventId);
                await lifeDb.worlds.put(record); return old;
            }, profileId);
            await page.reload(); await page.locator('.life-world[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            assert.equal(await page.locator('.life-world').getAttribute('data-life-visual-candidate'), candidate);
            if ((candidate.startsWith('canopy-ground-') || (candidate.startsWith('canopy-shore-') || Boolean(sculpt)))) await page.locator('.life-world[data-life-ground-material-status="ready"]').waitFor();
            if (sculpt) await page.locator('.life-world[data-life-sculpt-status="ready"]').waitFor();
            const delivery = await page.evaluate(() => ({ builds: [...document.querySelectorAll('[data-build-revision]')].map(n => ({...n.dataset})), world: {...document.querySelector('.life-world').dataset}, shellBackground: getComputedStyle(document.querySelector('.island-life')).backgroundColor }));
            if (candidate === 'canopy-shore-lagoon-study-v3' || sculpt) assert.equal(delivery.shellBackground, 'rgb(32, 134, 181)');
            const native = await readNative(page, profileId);
            const read = () => page.evaluate(async profileId => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return lifeDb.worlds.get(profileId); }, profileId);
            const before = await read();
            // A close composition can crop the flower relation; record exposure only after showing it in overview.
            if (atmosphere) { await page.locator('.life-camera-tools summary').click(); await page.getByRole('button',{name:'しま全体を みる',exact:true}).click(); await page.locator('.life-camera-tools summary').click(); }
            await waitForAsync(page, async profileId => { const { lifeDb } = await import('/src/domain/islandLife/repository.ts'); return (await lifeDb.worlds.get(profileId))?.discoveryJournal?.entries.some(e => e.event.source === 'live' && e.event.snapshot.scene.worldStyle === 'canopy-dots-c3-v1'); }, profileId);
            if (atmosphere) { await page.locator('.life-camera-tools summary').click(); await page.getByRole('button',{name:'くらしを みる',exact:true}).click(); await page.locator('.life-camera-tools summary').click(); }
            await page.screenshot({ path: `${out}/${device}-current.png` });
            await page.getByRole('button', { name: 'しまの ようす', exact: true }).click();
            await page.getByRole('button', { name: 'しまの おもいで', exact: true }).click();
            await page.locator('[data-life-memory="qa-old-world"]').click();
            await page.locator('.life-relation-view[data-life-world-style="moon-garden-v1"][data-rendered="true"]').waitFor();
            if (atmosphere) assert.deepEqual(JSON.parse(await page.locator('.life-relation-view').getAttribute('data-life-study-lighting')), {sky:'fff7ea',ground:'63806c',hemi:1.15,sun:'fff4e0',strength:2.3,direction:[-3,8,4],fill:0});
            await page.screenshot({ path: `${out}/${device}-old-memory.png` });
            await page.getByRole('button', { name: 'いまの島でみる', exact: true }).click();
            await page.locator('.life-relation-view[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            if (sculpt) await page.locator('.life-relation-view[data-life-sculpt-status="ready"]').waitFor();
            if (atmosphere) assert.deepEqual(JSON.parse(await page.locator('.life-relation-view').getAttribute('data-life-study-lighting')), JSON.parse(delivery.world.lifeStudyLighting));
            await page.screenshot({ path: `${out}/${device}-current-observation.png` });
            await page.reload(); await page.locator('.life-world[data-life-world-style="canopy-dots-c3-v1"][data-rendered="true"]').waitFor();
            if (sculpt) await page.locator('.life-world[data-life-sculpt-status="ready"]').waitFor();
            const closeCamera = await page.locator('.life-world').getAttribute('data-life-camera');
            await page.locator('.life-camera-tools summary').click();
            if (atmosphere) {
                await page.getByRole('button',{name:'しまを おおきく',exact:true}).click();
                assert.notDeepEqual(cameraMatrices(await page.locator('.life-world').getAttribute('data-life-camera')),cameraMatrices(closeCamera));
                await page.screenshot({path:`${out}/${device}-camera-zoom.png`});
                await page.getByRole('button',{name:'もとの ながめ',exact:true}).click();
                assert.deepEqual(cameraMatrices(await page.locator('.life-world').getAttribute('data-life-camera')),cameraMatrices(closeCamera));
            }
            await page.getByRole('button', { name: 'しま全体を みる', exact: true }).click(); await page.locator('.life-camera-tools summary').click();
            await page.screenshot({ path: `${out}/${device}-overview.png` });
            let cameraComparison;
            if (atmosphere) {
                const overviewCamera = await page.locator('.life-world').getAttribute('data-life-camera');
                await page.locator('.life-camera-tools summary').click();await page.getByRole('button',{name:'くらしを みる',exact:true}).click();await page.locator('.life-camera-tools summary').click();
                assert.deepEqual(cameraMatrices(await page.locator('.life-world').getAttribute('data-life-camera')),cameraMatrices(closeCamera));
                const itemId=await page.evaluate(async record=>{const{replayLife}=await import('/src/domain/islandLife/simulation.ts');return replayLife(record).items.find(i=>i.cell).id;},before);
                await inventory(page,itemId);await page.getByRole('button',{name:'うごかす',exact:true}).click();
                const placementCamera=await page.locator('.life-world').getAttribute('data-life-camera');
                const tap=await page.locator('.life-world').evaluate(n=>{
                    const{projection,view}=JSON.parse(n.dataset.lifeCamera),r=n.getBoundingClientRect();
                    const mul=(m,v)=>[0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);
                    const p=mul(projection,mul(view,[4-2.5,.045,4-2,1]));return{x:r.left+(p[0]/p[3]+1)*r.width/2,y:r.top+(1-p[1]/p[3])*r.height/2};
                });
                await page.touchscreen.tap(tap.x,tap.y);assert.equal(await page.locator('.life-placement').getAttribute('data-life-placement-cell'),'4,4');
                await page.screenshot({path:`${out}/${device}-placement-preview.png`});await page.getByRole('button',{name:'やめる',exact:true}).click();await closeMenu(page);
                const baselineContext=await browser.newContext({viewport,hasTouch:true,reducedMotion:device==='tablet'?'reduce':'no-preference'});
                try {
                    const bp=await baselineContext.newPage();bp.setDefaultTimeout(25000);await bp.goto(baseline);
                    await bp.evaluate(async record=>{
                        const{lifeDb}=await import('/src/domain/islandLife/repository.ts');const{createInitialProfile}=await import('/src/domain/user/profile.ts');const{saveProfile,setActiveProfileId}=await import('/src/domain/user/repository.ts');
                        if(lifeDb.name!=='SansuIslandLifePreviewV1')throw Error('DEV fixture only');const p=createInitialProfile('比較',2,0,1,'math');p.id=record.profileId;p.soundEnabled=false;await saveProfile(p);await setActiveProfileId(p.id);await lifeDb.worlds.put({...record,realAt:Date.now()});
                    },before);
                    await bp.reload();await bp.locator('.life-world[data-rendered="true"][data-life-sculpt-status="ready"]').waitFor();
                    assert.equal(await bp.locator('.life-world').getAttribute('data-life-visual-candidate'),'canopy-sculpt-buttress-study-v2');
                    await bp.locator('.life-camera-tools summary').click();await bp.getByRole('button',{name:'しま全体を みる',exact:true}).click();await bp.locator('.life-camera-tools summary').click();
                    const baselineOverview=await bp.locator('.life-world').getAttribute('data-life-camera');assert.deepEqual(cameraMatrices(overviewCamera),cameraMatrices(baselineOverview));
                    await inventory(bp,itemId);await bp.getByRole('button',{name:'うごかす',exact:true}).click();
                    const baselinePlacement=await bp.locator('.life-world').getAttribute('data-life-camera');assert.deepEqual(cameraMatrices(placementCamera),cameraMatrices(baselinePlacement));
                    cameraComparison={baseline,overviewCamera,baselineOverview,placementCamera,baselinePlacement,previewCell:'4,4',cancelled:true};
                } finally {await baselineContext.close();}
            }
            const after = await read();
            assert.deepEqual(after.discoveryJournal.entries.find(e => e.event.eventId === original.eventId).event, original);
            assert.deepEqual(after.actions, before.actions); assert.deepEqual(after.credits, before.credits);
            assert.deepEqual(await readNative(page, profileId), native);
            await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('.island-learning[data-input-ready="true"]').waitFor(); await page.screenshot({ path: `${out}/${device}-learning.png` });
            assert.deepEqual(errors, []); report.cases.push({ device, viewport, pass: true, errors, delivery, cameraComparison, originalHash: original.snapshot.immutableHash });
        } catch (error) { await page.screenshot({ path: `${out}/${device}-failure.png` }); report.cases.push({ device, viewport, pass: false, errors, error: error.stack }); throw error; }
        finally { await context.close(); }
    }
    report.endHash = await sourceHash(); assert.equal(report.startHash, report.endHash); report.pass = true;
} finally { await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
