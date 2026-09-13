import { useEffect, useRef } from 'react';
import * as T from 'three';
import { CATALOG, growthStage, type ItemKind, type Style } from '../../../domain/islandLife/model';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { buildLifeItem, tint } from './itemGeometry';
import { buildHomeJourney } from '../homeJourney/scene';

const stills = new Map<string, string>();

/** Actual geometry and saved appearance, cached as stills without persistent WebGL contexts. */
export default function LifeProductPreview({ kind, growth = 0, style = 'original' }: { kind?: ItemKind; growth?: number; style?: Style }) {
    const stage = growthStage({ kind: kind ?? 'bench', growth });
    const image = useRef<HTMLImageElement>(null);
    const fallback = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const target = image.current;
        if (!target) return;
        target.hidden = true;
        if (fallback.current) fallback.current.hidden = false;
        const key = `${kind ?? 'pokomoko'}:${stage}:${style}`;
        const cached = stills.get(key);
        if (cached) { target.src = cached; target.hidden = false; if (fallback.current) fallback.current.hidden = true; return; }
        let home: ReturnType<typeof buildHomeJourney> | undefined;
        let renderer: T.WebGLRenderer | undefined;
        const materials = new IslandMaterials();
        const scene = new T.Scene();
        try {
            renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
            const width = kind ? 320 : 240, heightPixels = kind ? 208 : 280;
            const aspect = width / heightPixels;
            renderer.setSize(width, heightPixels);
            renderer.setPixelRatio(1);
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = T.SRGBColorSpace;
            renderer.toneMapping = T.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            let root: T.Group;
            if (kind) root = buildLifeItem({ id: 'preview', kind, growth, style }, materials).root;
            else {
                home = buildHomeJourney(); root = home.hero;
                const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), materials.surface(tint(style), .85));
                scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; root.add(scarf);
            }
            scene.add(root);
            scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
            const sun = new T.DirectionalLight('#fff6df', 3.1);
            sun.position.set(-3, 6, 5); scene.add(sun);
            const bounds = new T.Box3().setFromObject(root);
            const center = bounds.getCenter(new T.Vector3());
            const camera = new T.OrthographicCamera(-1, 1, .65, -.65, .1, 20);
            camera.position.copy(center).add(new T.Vector3(kind ? 2.4 : .6, kind ? 2 : .7, 3.5));
            camera.lookAt(center);
            camera.updateMatrixWorld();
            const projected = [];
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                projected.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
            }
            const extentX = Math.max(...projected.map(p => Math.abs(p.x)));
            const extentY = Math.max(...projected.map(p => Math.abs(p.y)));
            const height = Math.max(extentY, extentX / aspect) * 1.2;
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
            // The adjacent product name and price keep the catalog usable without WebGL.
        } finally {
            disposeGeometry(scene);
            materials.dispose();
            home?.dispose();
            renderer?.dispose();
            renderer?.forceContextLoss();
        }
    }, [kind, growth, stage, style]);
    return <span className="life-product-preview" aria-hidden="true">
        <img ref={image} width="160" height="104" alt="" hidden />
        <span ref={fallback}>{kind ? CATALOG[kind].label : 'ぽこもこ'}</span>
    </span>;
}
