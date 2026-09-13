import { useEffect, useRef } from 'react';
import * as T from 'three';
import { type Style } from '../../../domain/islandLife/model';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { tint } from './itemGeometry';
import { makeResidentRig } from '../three/residentRig';
import { buildHomeJourney } from '../homeJourney/scene';

const stills = new Map<string, string>();

/** Actual geometry and saved appearance, cached as stills without persistent WebGL contexts. */
export default function LifeResidentPortrait({ resident, style = 'original' }: { resident: 'pokomoko' | 'rabbit' | 'otter'; style?: Style }) {
    const image = useRef<HTMLImageElement>(null);
    const fallback = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const target = image.current;
        if (!target) return;
        target.hidden = true;
        if (fallback.current) fallback.current.hidden = false;
        const key = `${resident}:${style}`;
        const cached = stills.get(key);
        if (cached) { target.src = cached; target.hidden = false; if (fallback.current) fallback.current.hidden = true; return; }
        let home: ReturnType<typeof buildHomeJourney> | undefined;
        let renderer: T.WebGLRenderer | undefined;
        const materials = new IslandMaterials();
        const scene = new T.Scene();
        try {
            renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
            const width = 160, heightPixels = 160;
            const aspect = width / heightPixels;
            renderer.setSize(width, heightPixels);
            renderer.setPixelRatio(1);
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = T.SRGBColorSpace;
            renderer.toneMapping = T.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            home = buildHomeJourney();
            const root = resident === 'pokomoko' ? home.hero : resident === 'rabbit' ? home.rabbit.pose : makeResidentRig('otter', materials, 'natural').pose;
            if (resident === 'pokomoko') {
                const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), materials.surface(tint(style), .85));
                scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; root.add(scarf);
            }
            scene.add(root);
            scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
            const sun = new T.DirectionalLight('#fff6df', 3.1);
            sun.position.set(-3, 6, 5); scene.add(sun);
            const bounds = new T.Box3().setFromObject(root);
            const center = bounds.getCenter(new T.Vector3());
            // Frame the upper body so faces stay legible in the compact resident chooser.
            bounds.min.y += (bounds.max.y - bounds.min.y) * .22;
            bounds.getCenter(center);
            const camera = new T.OrthographicCamera(-1, 1, .65, -.65, .1, 20);
            camera.position.copy(center).add(new T.Vector3(.4, .35, 3.5));
            camera.lookAt(center);
            camera.updateMatrixWorld();
            const projected = [];
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                projected.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
            }
            const extentX = Math.max(...projected.map(p => Math.abs(p.x)));
            const extentY = Math.max(...projected.map(p => Math.abs(p.y)));
            const height = Math.max(extentY, extentX / aspect) * 1.08;
            camera.left = -height * aspect; camera.right = -camera.left;
            camera.top = height; camera.bottom = -height;
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
            target.src = renderer.domElement.toDataURL('image/png');
            if (stills.size >= 64) stills.clear();
            stills.set(key, target.src);
            target.hidden = false;
            if (fallback.current) fallback.current.hidden = true;
        } catch {
            // The adjacent name and activity remain readable without WebGL.
        } finally {
            disposeGeometry(scene);
            materials.dispose();
            home?.dispose();
            renderer?.dispose();
            renderer?.forceContextLoss();
        }
    }, [resident, style]);
    return <span className="life-resident-portrait" aria-hidden="true">
        <img ref={image} width="80" height="80" alt="" hidden />
        <span ref={fallback}>{resident === 'pokomoko' ? 'ぽ' : resident === 'rabbit' ? 'う' : 'カ'}</span>
    </span>;
}
