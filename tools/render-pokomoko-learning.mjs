// Reproducible full-body poses from the app's original model, not a new character.
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.goto(process.env.SANSU_FEEDBACK_URL || 'http://127.0.0.1:5230');
    const data = await page.evaluate(async () => {
        const T = await import('/node_modules/.vite/deps/three.js');
        const { buildHomeJourney } = await import('/src/components/island/homeJourney/scene.ts');
        const model = buildHomeJourney(undefined, { residentsOnly: true });
        const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        const width = 192, height = 224;
        renderer.setSize(width, height); renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
        const scene = new T.Scene(); scene.add(model.hero);
        const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), model.m.surface('#eb8f9e', .85));
        scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; model.heroBody.add(scarf);
        const arms = [-1, 1].map(side => {
            const arm = model.heroBody.children.find(child => Math.abs(child.position.x - side * .27) < .001 && child.position.y === .46);
            if (!arm) throw new Error('Original Pokomoko arm changed; review model before rendering.');
            const pivot = new T.Group(); pivot.position.set(side * .25, .58, .025); model.heroBody.add(pivot);
            model.hero.updateMatrixWorld(true); pivot.attach(arm); return pivot;
        });
        scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
        const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
        const half = .72, camera = new T.OrthographicCamera(-half * width / height, half * width / height, half, -half, .1, 20);
        camera.position.set(.22, .87, 4); camera.lookAt(0, .62, 0);
        const atlas = document.createElement('canvas'); atlas.width = width * 8; atlas.height = height;
        const ctx = atlas.getContext('2d');
        const poses = [
            { turn: .06, left: -.12, right: .12 }, // ready
            { turn: 0, y: -.06, squash: .91, left: -.4, right: .4 }, // crouch
            { turn: -.14, left: -2.3, right: 2.3, feet: .12 }, // jump
            { turn: -.35, left: -1.5, right: .5 }, // catch
            { turn: .25, left: -.4, right: 2.1 }, // wave
            { turn: -.22, tilt: -.12, left: -1.6, right: 1.5, feet: .12 }, // ride
            { turn: .3, tilt: .08, left: -.7, right: .3, step: .065 }, // step
            { turn: -.08, y: -.025, squash: .96, left: -.7, right: .7 }, // land
        ];
        poses.forEach((pose, index) => {
            model.hero.rotation.y = pose.turn;
            model.heroBody.position.y = pose.y ?? 0; model.heroBody.scale.y = pose.squash ?? 1;
            model.heroBody.rotation.z = pose.tilt ?? 0;
            arms[0].rotation.z = pose.left; arms[1].rotation.z = pose.right;
            model.heroFeet.forEach((foot, i) => {
                foot.position.y = .10 + (i === 1 ? pose.step ?? 0 : 0);
                foot.rotation.z = (i === 0 ? -1 : 1) * (pose.feet ?? 0);
            });
            renderer.render(scene, camera); ctx.drawImage(renderer.domElement, index * width, 0);
        });
        const result = atlas.toDataURL('image/webp', .95);
        renderer.dispose(); renderer.forceContextLoss(); scarf.geometry.dispose(); model.dispose();
        return result;
    });
    await fs.mkdir('src/assets', { recursive: true });
    const target = 'src/assets/pokomoko-learning-poses.webp';
    await fs.writeFile(target, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${target}: ${(await fs.stat(target)).size} bytes; 8 × 192 × 224, original geometry.`);
} finally { await browser.close(); }
