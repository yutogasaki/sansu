import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import * as THREE from 'three';
import { seedNative, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_HOME_CAMERA_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_HOME_CAMERA_OUTPUT;
assert(out, 'Use a new output directory'); await fs.mkdir(out, { recursive: false });
const inputs = ['src/components/island/three/homeCameraControls.ts', 'src/components/island/three/runtime.ts', 'src/components/island/IslandStage.tsx', 'src/components/island/HomeCameraToolbar.tsx', 'src/components/island/HomeCameraToolbar.css', 'tools/e2e-home-camera.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(inputs.map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const report = { at: new Date().toISOString(), base, inputs: await hashes(), scope: 'Disposable native profile, actual canvas gestures and buttons; no real-device or child-understanding claim.', cases: [], pass: false };
const engines = process.env.SANSU_HOME_CAMERA_ENGINE ? [process.env.SANSU_HOME_CAMERA_ENGINE] : ['chromium', 'webkit'];
try {
    for (const engine of engines) {
        const browser = await ({ chromium, webkit }[engine]).launch();
        let active;
        try {
            for (const width of (process.env.SANSU_HOME_CAMERA_WIDTH ? [Number(process.env.SANSU_HOME_CAMERA_WIDTH)] : engine === 'webkit' ? [390] : [390, 768, 320])) {
                const context = await browser.newContext({ viewport: { width, height: width === 768 ? 1024 : width === 320 ? 568 : 844 }, hasTouch: true, reducedMotion: width === 768 ? 'reduce' : 'no-preference', serviceWorkers: 'allow' });
                const page = active = await context.newPage(); page.setDefaultTimeout(30000);
                const errors = []; page.on('pageerror', error => errors.push(error.message));
                await page.goto(`${base}/#/island`); await page.locator('[data-onboarding-world="island"]').waitFor();
                const id = await seedNative(page, randomUUID()); await page.reload();
                const nav = page.locator('.island-shell-nav'); await nav.getByRole('button', { name: 'いえ', exact: true }).tap();
                const host = page.locator('.island-stage[data-keepsake-room=true] [data-home-camera-controls]');
                const ready = async () => { await host.waitFor({ timeout: 90000 }); await page.waitForFunction(() => JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-targets]')?.dataset.homeTargets || '[]').length > 0); };
                await ready(); await page.waitForTimeout(1200);
                const saved = await readNative(page, id);
                const view = async () => JSON.parse(await host.getAttribute('data-home-camera-controls'));
                const capture = async name => { await page.screenshot({ path: `${out}/${engine}-${width}-${name}.png`, timeout: 60000 }); };
                const metadata = await runtimeMetadata(page);
                assert.equal(metadata.appRoot.islandFeatureEnabled, true);
                await capture('entry'); assert.equal((await view()).manual, false);
                const rect = await host.boundingBox();
                const start = { x: rect.x + rect.width * .65, y: rect.y + rect.height * .75 };
                await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 25, start.y - 18, { steps: 4 }); await page.mouse.up();
                await page.waitForFunction(() => JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-camera-controls]').dataset.homeCameraControls).manual);
                assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
                const dragged = await view(); await page.waitForTimeout(700); assert.deepEqual(await view(), dragged, 'Resident motion must not reset manual framing');
                await page.getByRole('button', { name: 'ながめ', exact: true }).tap();
                const panel = page.getByRole('region', { name: 'いえの ながめ' });
                for (const button of await panel.getByRole('button').all()) {
                    const box = await button.boundingBox(); assert(box.width >= 48 && box.height >= 48);
                }
                await page.getByRole('button', { name: 'みぎに まわす', exact: true }).tap();
                await page.getByRole('button', { name: 'ちかくで みる', exact: true }).tap();
                await page.waitForFunction(zoom => JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-camera-controls]').dataset.homeCameraControls).zoom > zoom, dragged.zoom);
                const changed = await view(); assert(changed.zoom > dragged.zoom); assert.notEqual(changed.azimuth, dragged.azimuth);
                const panelBox = await panel.boundingBox(), roomBox = await host.boundingBox();
                assert(panelBox.y + panelBox.height <= roomBox.y + roomBox.height, 'View panel must fit within the room at narrow heights');
                await capture('controls');
                await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
                assert.equal(await page.getByRole('button', { name: 'ながめ', exact: true }).evaluate(e => document.activeElement === e), true);
                await capture('moved');
                const values = (await host.getAttribute('data-camera-frame')).split(',').map(Number);
                const camera = new THREE.PerspectiveCamera(); camera.matrixWorld.fromArray(values.slice(0, 16)); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(values.slice(16));
                const floor = new THREE.Vector3(0, .035, 3.6).multiplyScalar(.26).add(new THREE.Vector3(-2.6, .18, -2.25)).project(camera);
                const floorBounds = await host.boundingBox();
                assert(Math.abs(floor.x) < 1 && Math.abs(floor.y) < 1, 'A real floor destination stays on screen after manual view changes');
                await page.touchscreen.tap(floorBounds.x + (floor.x + 1) * floorBounds.width / 2, floorBounds.y + (1 - floor.y) * floorBounds.height / 2);
                await page.waitForFunction(() => {
                    const walker = JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-resident]').dataset.homeResident);
                    return Math.abs((walker.destination?.x ?? walker.position[0])) < .08 && Math.abs((walker.destination?.z ?? walker.position[2]) - 3.6) < .08;
                });
                assert.deepEqual(await view(), changed, 'Floor walking must leave the chosen camera alone');
                const album = await host.evaluate(e => JSON.parse(e.dataset.homeTargets).find(target => target.type === 'album'));
                const bounds = await host.boundingBox(); const point = { x: bounds.x + album.x, y: bounds.y + album.y };
                assert(point.x > 0 && point.x < width && point.y > bounds.y && point.y < bounds.y + bounds.height);
                await page.touchscreen.tap(point.x, point.y);
                await page.locator('.island-page[data-mode="album"]').waitFor(); console.log(`PASS ${engine} ${width}: drag/buttons/panel/Escape/floor/album hit`); await capture('album');
                assert.deepEqual(await readNative(page, id), saved, 'View and album must not change learning or ownership');
                await nav.getByRole('button', { name: 'いえ', exact: true }).tap(); await ready();
                assert.equal((await view()).manual, false, 'Re-entry resets the transient view');
                if (engine === 'chromium') {
                    const session = await context.newCDPSession(page);
                    const box = await host.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height * .7;
                    const touch = (type, points) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) });
                    await touch('touchStart', [[1, x - 35, y], [2, x + 35, y]]);
                    await touch('touchMove', [[1, x - 50, y - 20], [2, x + 50, y + 20]]);
                    await touch('touchEnd', []);
                    await page.waitForFunction(() => JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-camera-controls]').dataset.homeCameraControls).manual);
                    const pinched = await view(); assert(pinched.zoom > 1); assert(Math.abs(pinched.azimuth) > .1);
                    assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes', 'Pinch must not activate an object');
                    // Real browser pointer cancellation, then release: no accidental click.
                    await touch('touchStart', [[1, x, y]]); await touch('touchCancel', []);
                    assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'keepsakes');
                    await session.detach();
                } else {
                    await page.mouse.move(start.x, start.y); await page.mouse.wheel(0, -100);
                    await page.waitForFunction(() => JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-camera-controls]').dataset.homeCameraControls).zoom > 1);
                }
                await page.getByRole('button', { name: 'もとの ながめ', exact: true }).tap();
                await page.waitForFunction(() => !JSON.parse(document.querySelector('.island-stage[data-keepsake-room=true] [data-home-camera-controls]').dataset.homeCameraControls).manual);
                await page.getByRole('button', { name: 'ながめ', exact: true }).tap();
                await page.getByRole('button', { name: 'ひだりを みる', exact: true }).tap();
                await page.getByRole('button', { name: 'ながめを とじる', exact: true }).tap();
                await nav.getByRole('button', { name: 'しま', exact: true }).tap();
                await nav.getByRole('button', { name: 'いえ', exact: true }).tap(); await ready();
                assert.equal((await view()).manual, false); assert.deepEqual(await readNative(page, id), saved);
                assert.deepEqual(errors, []);
                await capture('returned'); report.cases.push({ engine, width, metadata, drag: dragged, rotated: changed, pass: true });
                console.log(`PASS ${engine} ${width}: view, gestures, real album hit, reset/re-entry, saved records`);
                await context.close();
            }
        } catch (error) { await active?.screenshot({ path: `${out}/${engine}-failure.png`, timeout: 10000 }).catch(() => {}); throw error; } finally { await browser.close(); }
    }
    assert.deepEqual(await hashes(), report.inputs); report.pass = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2)); }
