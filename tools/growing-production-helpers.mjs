import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Project saved cells with the actual candidate's camera/layout, without DEV imports
// or writing credits, clock or ownership into the production database.
let projection;
async function project() {
    if (!projection) {
        const compiled = await build({ stdin: { contents: `
            import * as T from 'three';
            import { sceneLayout } from './src/components/island/growing/sceneLayout.ts';
            import { frameCamera, initialView } from './src/components/island/growing/growingCamera.ts';
            export function point(state, cell, width, height) {
                const layout = sceneLayout(state), camera = new T.OrthographicCamera();
                frameCamera(camera, layout, initialView(), width / height);
                camera.updateMatrixWorld();
                const p = layout.point(cell).project(camera);
                return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
            }
        `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false });
        projection = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    }
    return projection;
}

export async function plantProduction(page, kind, cell, state) {
    const seed = page.getByRole('button', { name: 'たね', exact: true });
    if (!await seed.isVisible()) await page.getByRole('button', { name: 'メニュー', exact: true }).tap();
    await seed.waitFor();
    const hit = await seed.boundingBox(); assert(hit);
    await page.touchscreen.tap(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await page.locator(`[data-growing-seed="${kind}"]`).tap();
    const box = await page.locator('[data-growing-world] canvas').boundingBox(); assert(box);
    const point = (await project()).point(state, cell, box.width, box.height);
    await page.touchscreen.tap(box.x + point.x, box.y + point.y);
    await page.getByRole('button', { name: 'ここに おく', exact: true }).tap();
}
