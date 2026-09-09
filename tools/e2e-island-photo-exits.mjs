import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { button, seedNative, readNative, waitReady, waitMode, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_BASE_URL || 'http://127.0.0.1:5390';
const out = process.env.SANSU_PHOTO_EXITS_OUTPUT || 'output/playwright/photo-exit/run-v1';
const sizes = JSON.parse(process.env.SANSU_PHOTO_EXITS_VIEWPORTS || '[{"width":390,"height":844},{"width":320,"height":568},{"width":768,"height":1024},{"width":844,"height":390}]');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const report = { target: base, scope: 'Native fresh profile; real rendered photo capture/save; explicit one-shot native read failures and delayed deletion completion.', scenarios: [], captures: [], pass: false };
async function photoRows(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('SansuDatabase');
        const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
        const read = name => new Promise((resolve, reject) => { const req = db.transaction(name).objectStore(name).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        const rows = await read('islandPhotos'); db.close(); return rows;
    });
}
async function failOneRead(page, table) {
    await page.evaluate(table => {
        const original = IDBObjectStore.prototype.get;
        IDBObjectStore.prototype.get = function(...args) {
            if (this.name === table && (table !== 'islandPhotoAlbums' || ![...this.transaction.objectStoreNames].includes('islandPhotoBlobs'))) {
                IDBObjectStore.prototype.get = original;
                throw new DOMException('Photo exits diagnostic: one read failure', 'UnknownError');
            }
            return original.apply(this, args);
        };
    }, table);
}
try {
    for (const viewport of sizes) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
        const page = await context.newPage(); page.setDefaultTimeout(18000);
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const hash = () => new URL(page.url()).hash;
        const capture = async name => {
            const file = `${viewport.width}-${name}.png`;
            await page.waitForTimeout(120); await page.screenshot({ path: `${out}/${file}` });
            report.captures.push({ file, ...(await runtimeMetadata(page)) });
        };
        const house = () => page.locator('[data-keepsake-section=home]').waitFor();
        const gallery = () => page.locator('.island-photo-gallery').waitFor();
        const exposed = async target => {
            await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            const hit = await target.evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height,
                inside: r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth,
                hit: [r.top+4,r.top+r.height/2,r.bottom-4].every(y=>el.contains(document.elementFromPoint(r.x+r.width/2,y))) }; });
            assert(hit.width>=44 && hit.height>=44 && hit.inside && hit.hit, `Visible 44px target: ${JSON.stringify(hit)}`);
        };
        try {
            await page.goto(base); await page.waitForURL('**/#/onboarding');
            const id = await seedNative(page, randomUUID());
            await page.goto(base); await waitReady(page); await capture('island');
            const unchanged = await readNative(page,id);
            await page.locator('.island-shell-nav').getByRole('button',{name:'いえ',exact:true}).click(); await house();
            const camera = button(page,'しゃしんに のこす'); await exposed(camera); await camera.click(); await waitMode(page,'camera'); await waitReady(page);
            await exposed(page.locator('[data-photo-action=capture]')); await capture('camera-ready');
            await page.locator('[data-photo-action=capture]').click(); await page.locator('[data-photo-saved=true]').waitFor();
            await exposed(button(page,'しゃしんを みる')); await capture('saved-room-photo');
            await button(page,'しゃしんを みる').click(); await gallery();
            await button(page,'しゃしんの アルバムから もどる').click(); await house();
            assert.equal(hash(),'#/island?view=keepsakes','Photo gallery returns to the house, not the completed camera');
            await page.locator('[data-keepsake-action=photos]').click(); await gallery();
            await button(page,'しゃしんを とる').click(); await waitMode(page,'camera'); await waitReady(page);
            await page.locator('[data-photo-action=capture]').click(); await page.locator('[data-photo-saved=true]').waitFor();
            await button(page,'しゃしんを みる').click(); await gallery();
            const saved = await photoRows(page); assert.equal(saved.length,2);
            await button(page,'しゃしんの アルバムから もどる').click(); await house();
            // Error in an album read, while a detail URL has hidden ordinary navigation.
            await failOneRead(page,'islandPhotoAlbums');
            await page.evaluate(photo => { location.hash=`/island?view=photos&photo=${encodeURIComponent(photo)}`; },saved[0].id);
            await page.locator('.island-album-binding [role=alert]').waitFor();
            await exposed(button(page,'とじる')); await capture('album-read-failure');
            await button(page,'もういちど ひらく').click(); await page.locator('.island-photo-detail img').waitFor();
            await button(page,'とじる').click(); await gallery();
            assert.equal(hash(),'#/island?view=photos');
            // The full-resolution read fails once; the same detail can retry it.
            await page.locator('.island-photo-card img').first().waitFor();
            await failOneRead(page,'islandPhotoBlobs');
            const card = page.locator('.island-photo-card').first();
            const selectedId = await card.getAttribute('data-photo-id'); await card.click();
            await button(page,'しゃしんを ひらきなおす').waitFor(); await exposed(button(page,'とじる')); await capture('image-read-failure');
            await button(page,'しゃしんを ひらきなおす').click(); await page.locator('.island-photo-detail img').waitFor();
            await button(page,'この しゃしんを はずす').click();
            await page.waitForFunction(() => document.activeElement?.textContent==='のこしておく');
            await capture('delete-confirm'); await page.keyboard.press('Escape');
            await page.locator('.island-photo-delete').waitFor({state:'hidden'});
            assert.equal(await button(page,'この しゃしんを はずす').evaluate(el=>el===document.activeElement),true);
            assert.deepEqual(await photoRows(page),saved);
            // Hold delivery of the native commit-completion event, not the actual delete.
            await page.evaluate(() => {
                const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');
                window.__photoDeleteHeld=false; window.__holdPhotoDelete=true;
                Object.defineProperty(IDBTransaction.prototype,'oncomplete',{...descriptor,set(handler){
                    if (typeof handler !== 'function') { descriptor.set.call(this,handler); return; }
                    descriptor.set.call(this,function(event){
                        if(window.__holdPhotoDelete && this.mode==='readwrite' && [...this.objectStoreNames].includes('islandPhotoBlobs')) {
                            window.__holdPhotoDelete=false; window.__photoDeleteHeld=true;
                            window.__releasePhotoDelete=()=>handler.call(this,event); return;
                        }
                        handler.call(this,event);
                    });
                }});
            });
            await button(page,'この しゃしんを はずす').click(); await button(page,'はずす').click();
            await page.waitForFunction(()=>window.__photoDeleteHeld);
            assert.equal(await button(page,'とじる').isDisabled(),true);
            await page.goBack(); await gallery(); assert.equal(hash(),'#/island?view=photos');
            await page.evaluate(()=>window.__releasePhotoDelete());
            await page.waitForFunction(()=>document.querySelector('.island-photo-gallery .island-panel-back')?.disabled===false);
            await page.waitForTimeout(150); assert.equal(hash(),'#/island?view=photos','Late delete cannot navigate again after browser Back');
            await capture('after-delayed-delete');
            assert.equal((await photoRows(page)).some(photo=>photo.id===selectedId),false);
            // The ordinary delete path still closes only the selected detail.
            await page.locator('.island-photo-card').first().click(); await page.locator('.island-photo-detail').waitFor();
            await button(page,'この しゃしんを はずす').click(); await button(page,'はずす').click();
            await page.waitForFunction(()=>location.hash==='#/island?view=photos');
            await page.locator('.island-photo-empty').waitFor(); assert.deepEqual(await photoRows(page),[]);
            await page.goto(`${base}/#/island?view=photos&photo=missing`); await page.getByText(/いま たなに ないよ/).waitFor();
            await exposed(button(page,'とじる')); await capture('missing-photo');
            await button(page,'とじる').click(); await page.locator('.island-photo-empty').waitFor();
            await page.goto(`${base}/#/island?view=reward`); await page.getByText('いまは うけとる おくりものは ないよ。',{exact:true}).waitFor();
            await exposed(button(page,'おくりものを とじる')); await capture('empty-gifts');
            await button(page,'おくりものを とじる').click(); await waitMode(page,'home');
            const after = await readNative(page,id);
            for (const table of ['islands','islandPlans','logs','memoryMath','memoryVocab','exploreRuns']) assert.deepEqual(after[table],unchanged[table],`Photo actions preserve ${table}`);
            assert.deepEqual(after.islandEvents.filter(event=>event.type!=='photo_changed'),unchanged.islandEvents);
            const receipts=after.islandEvents.filter(event=>event.type==='photo_changed');
            assert.deepEqual(receipts.map(event=>event.photoReceipt.result),['saved','saved','deleted','deleted']);
            assert.deepEqual(receipts.map(event=>event.photoReceipt.albumRevision),[0,1,2,3]);
            await fs.writeFile(`${out}/${viewport.width}-native.json`,JSON.stringify({before:unchanged,after},null,2));
            assert.deepEqual(errors,[]);
            report.scenarios.push({viewport,pass:true,errors}); console.log(`PASS photo exits ${viewport.width}x${viewport.height}`);
        } catch(error) {
            await capture('failure').catch(()=>{}); report.scenarios.push({viewport,pass:false,url:page.url(),error:String(error),errors}); throw error;
        } finally {await context.close();}
    }
    report.pass=true;
} finally {await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
