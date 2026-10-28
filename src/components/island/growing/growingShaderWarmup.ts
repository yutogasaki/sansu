import * as T from 'three';

/** Material.copy deliberately omits shader callbacks. A preview must use the
 * same authored shader and key, including keys which inspect their `this`. */
export function cloneGrowingPreviewMaterial<M extends T.Material>(source: M): M {
    const clone = source.clone();
    clone.onBeforeCompile = source.onBeforeCompile;
    clone.customProgramCacheKey = source.customProgramCacheKey;
    return clone;
}

/** Compile-only representatives of the currently owned models and the actual
 * selection/placement controls. They are never added to the visible world.
 * Materials stay alive after warming so clearPreview/dispose cannot evict the
 * last reference to a program between two edits. Borrowed geometry is released
 * from this bank after warming and is never disposed here. */
export function makeGrowingInteractionWarmBank(owners: T.Object3D) {
    const root = new T.Group(), materials = new Set<T.Material>(), geometry = new Set<T.BufferGeometry>();
    const opaque = new Map<T.Material, T.Material>(), preview = new Map<T.Material, T.Material>();
    const copy = (source: T.Material, transparent: boolean) => {
        const cache = transparent ? preview : opaque;
        let material = cache.get(source);
        if (!material) {
            material = cloneGrowingPreviewMaterial(source);
            if (transparent) { material.transparent = true; material.opacity = .5; material.depthWrite = false; }
            cache.set(source, material); materials.add(material);
        }
        return material;
    };
    owners.traverse(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        for (const transparent of [false, true]) {
            const mesh = object.clone(false);
            mesh.material = Array.isArray(object.material) ? object.material.map(material => copy(material, transparent)) : copy(object.material, transparent);
            mesh.castShadow = false; root.add(mesh);
        }
    });
    // Same material features as objectLayer's ring and allowed-cell plane. Their
    // colors, radii and opacity values are uniforms, not additional shader keys.
    const ring = new T.TorusGeometry(.44, .03, 8, 40), tile = new T.PlaneGeometry(.9, .9);
    const selected = new T.MeshBasicMaterial({ color: '#fff5ac' });
    const allowed = new T.MeshBasicMaterial({ color: '#fff4c1', transparent: true, opacity: .2, depthWrite: false });
    geometry.add(ring); geometry.add(tile); materials.add(selected); materials.add(allowed);
    root.add(new T.Mesh(ring, selected), new T.Mesh(tile, allowed));
    let disposed = false;
    const releaseMeshes = () => { root.clear(); geometry.forEach(item => item.dispose()); geometry.clear(); };
    return {
        root, releaseMeshes,
        dispose() { if (disposed) return; disposed = true; releaseMeshes(); materials.forEach(material => material.dispose()); materials.clear(); },
    };
}

type ParallelCompile = { COMPLETION_STATUS_KHR: number };
type PreparedProgram = NonNullable<T.WebGLRenderer['info']['programs']>[number];

function shaderLinkFailure(gl: WebGLRenderingContext | WebGL2RenderingContext, program: PreparedProgram, handle: WebGLProgram) {
    const log = (value: string | null) => value?.trim().slice(0, 2000) || '(empty)';
    return Error([
        `Growing shader failed to link: ${program.name || program.id}`,
        `program: ${log(gl.getProgramInfoLog(handle))}`,
        ...(program.vertexShader ? [`vertex: ${log(gl.getShaderInfoLog(program.vertexShader))}`] : []),
        ...(program.fragmentShader ? [`fragment: ${log(gl.getShaderInfoLog(program.fragmentShader))}`] : []),
    ].join('\n'));
}

const transmissive = (material: T.Material) => material instanceof T.MeshPhysicalMaterial && material.transmission > 0;
const meshMaterials = (root: T.Object3D) => {
    const materials = new Set<T.Material>();
    root.traverse(object => { if (object instanceof T.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); });
    return materials;
};

/** Isolated adapter for the installed Three 0.185.1 WebGLProgram interface.
 * compileAsync only waits each material's last program and does not run the
 * first-use diagnostics/reflection. Validate every live variant, including both
 * sides. A future Three revision must explicitly revalidate this adapter. */
async function validatePrograms(renderer: T.WebGLRenderer, signal?: AbortSignal) {
    requireReviewedShaderInterface(renderer);
    const gl = renderer.getContext(), parallel = gl.getExtension('KHR_parallel_shader_compile') as ParallelCompile | null;
    // Polling only keeps the page responsive. Some phones never report completion, so after
    // a short wait fall through to the blocking link check below instead of waiting behind 88%.
    const deadline = performance.now() + 8000;
    const liveHandles = () => (renderer.info.programs ?? []).map(program => {
        const handle = program.program as WebGLProgram;
        if (typeof program.getUniforms !== 'function' || !handle || !gl.isProgram(handle)) throw Error('Growing shader program interface or lifetime differs');
        return { program, handle };
    });
    let handles: ReturnType<typeof liveHandles>;
    for (;;) {
        signal?.throwIfAborted();
        if (gl.isContextLost()) throw Error('WebGL context lost during growing shader preparation');
        // Opening first shows the saved island, then sync may replace its scenery
        // while this wait yields. Three destroys unowned programs immediately.
        // Never poll a snapshot across an await: a deleted handle returns null,
        // which used to become a false "failed to link" at 88% on a slow start.
        handles = liveHandles();
        if (!parallel || handles.every(({ handle }) => gl.getProgramParameter(handle, parallel.COMPLETION_STATUS_KHR))) break;
        if (performance.now() >= deadline) break;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    for (const { program, handle } of handles) {
        signal?.throwIfAborted();
        // Keep Three's original onShaderError callback/log checks intact. This
        // also caches attributes. Without KHR this can block, while still loading.
        program.getUniforms();
        if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw shaderLinkFailure(gl, program, handle);
    }
}

function requireReviewedShaderInterface(renderer: T.WebGLRenderer) {
    if (T.REVISION !== '185') throw Error(`Growing shader validation requires reviewed Three revision 185; found ${T.REVISION}`);
    if (!renderer.debug.checkShaderErrors) throw Error('Growing shader validation requires shader error checks');
}

/** Register programs through public compile(), then use the abortable all-program
 * barrier below. Three's compileAsync only polls the last program per material
 * and its polling cannot be cancelled when this renderer is unmounted. Restore
 * target and sides synchronously, before any animation/React work can observe them. */
function compilePass(renderer: T.WebGLRenderer, root: T.Object3D, camera: T.Camera, scene: T.Scene, target: T.WebGLRenderTarget | null, sides: ReadonlyMap<T.Material, T.Side> = new Map()) {
    const previous = renderer.getRenderTarget(), cube = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const originalSides = new Map([...meshMaterials(root)].map(material => [material, material.side]));
    try {
        renderer.setRenderTarget(target);
        sides.forEach((side, material) => { material.side = side; material.needsUpdate = true; });
        renderer.compile(root, camera, scene);
    } finally {
        originalSides.forEach((side, material) => { if (material.side !== side) { material.side = side; material.needsUpdate = true; } });
        renderer.setRenderTarget(previous, cube, mip);
    }
}

function filteredMeshes(roots: readonly T.Object3D[], accept: (material: T.Material) => boolean) {
    const root = new T.Group();
    for (const source of roots) source.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const materials = (Array.isArray(object.material) ? object.material : [object.material]).filter(accept);
        if (!materials.length) return;
        const mesh = object.clone(false); mesh.material = materials.length === 1 ? materials[0] : materials; root.add(mesh);
    });
    return root;
}

/** Loading barrier under the final lights, environment, tone mapping and canvas
 * dimensions. Compilation does not resize or draw staged models. The actual
 * render registers Three's lazy shadow/background/transmission programs before
 * readiness; a second render confirms the warmed rendering paths. */
export async function warmGrowingShaders(renderer: T.WebGLRenderer, camera: T.Camera, scene: T.Scene, interaction: T.Object3D, signal?: AbortSignal) {
    signal?.throwIfAborted();
    requireReviewedShaderInterface(renderer);
    // Three 0.185 replaces this deprecated mode at its first shadow render.
    // Use that same effective mode before compiling detached preview variants.
    if (renderer.shadowMap.enabled && renderer.shadowMap.type === T.PCFSoftShadowMap) renderer.shadowMap.type = T.PCFShadowMap;
    const linear = new T.WebGLRenderTarget(1, 1), roots = [scene, interaction];
    const renderCanvas = () => {
        const target = renderer.getRenderTarget(), cube = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
        try { renderer.setRenderTarget(null); renderer.render(scene, camera); }
        finally { renderer.setRenderTarget(target, cube, mip); }
    };
    try {
        compilePass(renderer, scene, camera, scene, null);
        compilePass(renderer, interaction, camera, scene, null);
        const transmitted = filteredMeshes(roots, transmissive);
        if (transmitted.children.length) {
            // An ordinary target automatically uses linear output/NoToneMapping.
            // Changing global outputColorSpace would produce different keys.
            const opaque = filteredMeshes(roots, material => !material.transparent && !transmissive(material));
            compilePass(renderer, opaque, camera, scene, linear);
            if (!renderer.getContext().getExtension('WEBGL_multisampled_render_to_texture')) {
                const back = filteredMeshes([transmitted], material => material.side === T.DoubleSide);
                compilePass(renderer, back, camera, scene, linear, new Map([...meshMaterials(back)].map(material => [material, T.BackSide])));
            }
        }
        await validatePrograms(renderer, signal);
        signal?.throwIfAborted();
        renderCanvas();
        await validatePrograms(renderer, signal);
        renderCanvas();
        await validatePrograms(renderer, signal);
    } finally { linear.dispose(); }
}
