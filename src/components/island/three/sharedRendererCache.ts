import * as T from 'three';
import { releaseWonderPaintRendererReferences } from '../growing/wonderPaint';

// Three.js r185 keeps one DFG lookup texture for the whole module. Each renderer
// attaches a dispose listener to it, and WebGLRenderer.dispose() does not detach
// that listener. Keep the texture and wonder-paint caches, but release their old
// renderer listeners when the last registered renderer has gone away.
let activeRenderers = 0;
let dfgLut: T.Texture | undefined;
interface MaterialObservation {
    users: number;
    uniforms: Set<{ value: unknown }>;
    previous: T.Material['onBeforeCompile'];
    hook: T.Material['onBeforeCompile'];
}
const observedMaterials = new WeakMap<T.Material, MaterialObservation>();

function releaseSpriteGeometryRendererReferences() {
    // Sprite.js owns one module-wide geometry. Its dispose listeners also retain
    // renderers after WebGLRenderer.dispose(), while the geometry itself is reused.
    const probe = new T.Sprite();
    probe.geometry.dispose();
    probe.material.dispose();
}

// Register before a material's first draw. Three passes its public shader
// object to this hook, then fills the DFG uniform during rendering. Keep only
// that uniform reference, not the renderer, scene, or material.
export function retainSharedRendererCache(material?: T.Material) {
    activeRenderers++;
    let observation: MaterialObservation | undefined;
    if (material) {
        observation = observedMaterials.get(material);
        if (!observation) {
            const previous = material.onBeforeCompile, uniforms = new Set<{ value: unknown }>();
            const hook: T.Material['onBeforeCompile'] = (shader, renderer) => {
                previous.call(material, shader, renderer);
                if (shader.uniforms.dfgLUT) uniforms.add(shader.uniforms.dfgLUT);
            };
            // Three's default program key uses this string. Observation must not
            // split compatible shaders or merge distinct original shader hooks.
            hook.toString = () => previous.toString();
            observation = { users: 0, uniforms, previous, hook };
            observedMaterials.set(material, observation);
            material.onBeforeCompile = hook;
        }
        observation.users++;
    }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (material && observation) {
            // Different renderer/program compilations have different uniforms;
            // a later unrendered program must not hide an earlier live texture.
            for (const { value } of observation.uniforms) {
                if (value instanceof T.Texture && value.name === 'DFG_LUT') dfgLut = value;
            }
            if (--observation.users === 0) {
                if (material.onBeforeCompile === observation.hook) material.onBeforeCompile = observation.previous;
                observation.uniforms.clear();
                observedMaterials.delete(material);
            }
        }
        if (--activeRenderers !== 0) return;
        releaseWonderPaintRendererReferences();
        dfgLut?.dispose();
        releaseSpriteGeometryRendererReferences();
        dfgLut = undefined;
    };
}
