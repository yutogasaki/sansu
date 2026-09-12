import { useEffect, useRef } from 'react';
import * as T from 'three';
import { CATALOG, type ItemKind } from '../../../domain/islandLife/model';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { buildLifeItem } from './itemGeometry';

/** A still of the actual item at purchase, with no persistent WebGL context. */
export default function LifeProductPreview({ kind }: { kind: ItemKind }) {
    const image = useRef<HTMLImageElement>(null);
    const fallback = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const target = image.current;
        if (!target) return;
        target.hidden = true;
        if (fallback.current) fallback.current.hidden = false;
        let renderer: T.WebGLRenderer | undefined;
        const materials = new IslandMaterials();
        const scene = new T.Scene();
        try {
            renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
            renderer.setSize(320, 208);
            renderer.setPixelRatio(1);
            renderer.setClearColor(0x000000, 0);
            renderer.outputColorSpace = T.SRGBColorSpace;
            renderer.toneMapping = T.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            const model = buildLifeItem({ id: 'catalog', kind, growth: 0, style: 'original' }, materials);
            scene.add(model.root);
            scene.add(new T.HemisphereLight('#fff7df', '#698f71', 2.4));
            const sun = new T.DirectionalLight('#fff6df', 3.1);
            sun.position.set(-3, 6, 5); scene.add(sun);
            const bounds = new T.Box3().setFromObject(model.root);
            const center = bounds.getCenter(new T.Vector3());
            const camera = new T.OrthographicCamera(-1, 1, .65, -.65, .1, 20);
            camera.position.copy(center).add(new T.Vector3(2.4, 2, 3.5));
            camera.lookAt(center);
            camera.updateMatrixWorld();
            const projected = [];
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                projected.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
            }
            const extentX = Math.max(...projected.map(p => Math.abs(p.x)));
            const extentY = Math.max(...projected.map(p => Math.abs(p.y)));
            const height = Math.max(extentY, extentX / (320 / 208)) * 1.2;
            camera.left = -height * (320 / 208); camera.right = -camera.left;
            camera.top = height; camera.bottom = -height;
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
            target.src = renderer.domElement.toDataURL('image/png');
            target.hidden = false;
            if (fallback.current) fallback.current.hidden = true;
        } catch {
            // The adjacent product name and price keep the catalog usable without WebGL.
        } finally {
            disposeGeometry(scene);
            materials.dispose();
            renderer?.dispose();
            renderer?.forceContextLoss();
        }
    }, [kind]);
    return <span className="life-product-preview" aria-hidden="true">
        <img ref={image} width="160" height="104" alt="" hidden />
        <span ref={fallback}>{CATALOG[kind].label}</span>
    </span>;
}
