/** Development-only baker. Reuses the approved meshes; never imported by the app. */
import * as T from 'three';
import { buildHomeJourney } from '../src/components/island/homeJourney/scene';
import { IslandMaterials, disposeGeometry } from '../src/components/island/three/primitives';
import { makeStarTree } from '../src/components/island/three/scenery';
import { makeResidentRig } from '../src/components/island/three/residentRig';

export function bakeTownPoses() {
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(160, 192); renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const images: Record<string, string> = {};
    try {
        for (const species of ['pokomoko', 'rabbit', 'otter'] as const) {
            const home = buildHomeJourney(), materials = new IslandMaterials();
            const rig = species === 'pokomoko' ? undefined : makeResidentRig(species, materials, 'natural');
            const root = rig?.pose ?? home.hero;
            const body = rig?.body ?? home.heroBody;
            const shoulders = rig?.shoulders ?? home.heroBody.children.filter(o => Math.abs(Math.abs(o.position.x) - .27) < .001 && Math.abs(o.position.y - .46) < .001).map(arm => {
                // Joint around the original arm's shoulder; preserve neutral mesh placement.
                const joint = new T.Group(); joint.position.set(arm.position.x, .60, arm.position.z);
                body.add(joint); arm.position.sub(joint.position); joint.add(arm); return joint;
            });
            if (shoulders.length !== 2) throw new Error('Canonical arm geometry changed');
            root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.setScalar(1);
            root.updateMatrixWorld(true);
            const bounds = new T.Box3().setFromObject(root);
            root.scale.setScalar(1.5 / (bounds.max.y - bounds.min.y));
            root.position.y = -bounds.min.y * root.scale.x;
            const scene = new T.Scene(); scene.add(root);
            scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
            const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
            const camera = new T.OrthographicCamera(-.8, .8, .96, -.96, .1, 20);
            camera.position.set(.28, 1.06, 4); camera.lookAt(0, .76, 0); camera.updateMatrixWorld();
            const originals = shoulders.map(s => s.rotation.clone());
            try {
                for (const pose of ['idle', 'receiving', 'carrying', 'giving'] as const) {
                    shoulders.forEach((s, i) => { s.rotation.copy(originals[i]); if (pose !== 'idle') {
                        s.rotation.x = pose === 'carrying' ? -1.2 : pose === 'giving' ? -1.7 : -.75;
                        s.rotation.z = (s.position.x < 0 ? -1 : 1) * (pose === 'carrying' ? -.3 : .35);
                    }});
                    body.rotation.x = pose === 'receiving' ? .20 : pose === 'giving' ? .12 : 0;
                    renderer.render(scene, camera);
                    images[`${species}-${pose}`] = renderer.domElement.toDataURL('image/png');
                }
            } finally { disposeGeometry(scene); materials.dispose(); home.dispose(); }
        }
        for (const kind of ['home', 'bench', 'flowers', 'tree'] as const) {
            const home = buildHomeJourney();
            const root = kind === 'tree' ? makeStarTree(home.m) : home.world.getObjectByName(kind === 'flowers' ? 'flower' : kind)!;
            if (!root) throw new Error(`Missing canonical prop: ${kind}`);
            const scene = new T.Scene(); scene.add(root); root.position.set(0, 0, 0);
            scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
            const sun = new T.DirectionalLight('#fff6df', 3.1); sun.position.set(-3, 6, 5); scene.add(sun);
            const bounds = new T.Box3().setFromObject(root), center = bounds.getCenter(new T.Vector3());
            const camera = new T.OrthographicCamera(-1, 1, 1.2, -1.2, .1, 100);
            camera.position.copy(center).add(new T.Vector3(3, 2.8, 5)); camera.lookAt(center); camera.updateMatrixWorld();
            const points: T.Vector3[] = [];
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
            const extent = Math.max(...points.map(p => Math.max(Math.abs(p.x), Math.abs(p.y) / 1.2))) * 1.06;
            camera.left = -extent; camera.right = extent; camera.top = extent * 1.2; camera.bottom = -extent * 1.2; camera.updateProjectionMatrix();
            try { renderer.render(scene, camera); images[`prop-${kind}`] = renderer.domElement.toDataURL('image/png'); }
            finally { disposeGeometry(scene); home.dispose(); }
        }
    } finally { renderer.dispose(); renderer.forceContextLoss(); }
    return images;
}
