// Static UI thumbnails from the same native meshes; no live canvas in learning.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5187';
const output = 'public/assets/park/three-v1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
    const page = await browser.newPage(); await page.goto(base);
    for (const kind of ['slide', 'trampoline', 'bubble']) {
        const data = await page.evaluate(async kind => {
            const THREE = await import('/node_modules/three/build/three.module.js');
            const { createToyScene } = await import('/src/components/park/three/scene.ts');
            const { sampleToy } = await import('/src/components/park/three/choreography.ts');
            const canvas = document.createElement('canvas');
            const scene = createToyScene(canvas, [kind, null, null], { alpha: true }); scene.resize(256, 256);
            scene.scene.background = null; scene.renderer.setClearColor(0, 0);
            for (const child of scene.scene.children) {
                if (!child.isLight && !['coral-slide', 'teal-trampoline', 'butter-yellow-open-gate'].includes(child.name)) child.visible = false;
            }
            const target = new THREE.Vector3(0, kind === 'bubble' ? .8 : kind === 'slide' ? .48 : .17, 0);
            scene.camera.position.copy(target).add(new THREE.Vector3(4.5, 4.8, 9)); scene.camera.lookAt(target);
            const span = kind === 'bubble' ? 1.05 : kind === 'slide' ? .9 : .73;
            Object.assign(scene.camera, { left: -span, right: span, top: span, bottom: -span }); scene.camera.updateProjectionMatrix();
            scene.draw(sampleToy([kind, null, null], undefined, 0)); scene.doll.root.visible = false; scene.renderer.render(scene.scene, scene.camera);
            const data = canvas.toDataURL('image/png'); scene.dispose(); return data;
        }, kind);
        await writeFile(`${output}/${kind}-icon.png`, Buffer.from(data.split(',')[1], 'base64'));
    }
} finally { await browser.close(); }
