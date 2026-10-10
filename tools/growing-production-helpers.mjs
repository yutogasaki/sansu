import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { openGrowingMenu } from './island-e2e-helpers.mjs';

// Project saved cells with the actual candidate's camera/layout, without DEV imports
// or writing credits, clock or ownership into the production database.
let projection;
async function project() {
    if (!projection) {
        const compiled = await build({ stdin: { contents: `
            import * as T from 'three';
            import { createWorldScene } from './src/components/island/growing/worldScene.ts';
            import { buildObjectLayer } from './src/components/island/growing/objectLayer.ts';
            import { frameCamera, initialView } from './src/components/island/growing/growingCamera.ts';
            let world, layer, layout, stateKey;
            export function dispose(){layer?.dispose();world?.dispose();world=layer=layout=stateKey=undefined;}
            export function point(state, cell, width, height, elevation) {
                const next = JSON.stringify(state);
                if (next !== stateKey) {
                    dispose(); world = createWorldScene({}); layout = world.layout(state);
                    layer = buildObjectLayer(world.m, state, layout); world.scene.add(layer.root); stateKey = next;
                }
                const camera = new T.OrthographicCamera();
                frameCamera(camera, layout, initialView(), width / height);
                camera.updateMatrixWorld();
                const p = layout.point(cell, elevation).project(camera);
                return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
            }
        `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
        projection = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    }
    return projection;
}

export function disposeProductionProjection() { projection?.dispose(); projection = undefined; }

export async function productionCellPoint(page, state, cell, elevation = .04) {
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const point = (await project()).point(state, cell, box.width, box.height, elevation);
    return { x: box.x + point.x, y: box.y + point.y };
}

export async function plantProduction(page, kind, cell, state) {
    const seed = page.getByRole('button', { name: 'たね', exact: true });
    if (!await seed.isVisible()) await openGrowingMenu(page, { touch: true });
    await seed.waitFor();
    const hit = await seed.boundingBox(); assert(hit);
    await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await page.locator(`[data-growing-seed="${kind}"]`).tap();
    const point = await productionCellPoint(page, state, cell);
    await page.touchscreen.tap(point.x, point.y);
    await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
}
