import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Continue the original wave field beyond the archived water's edge. */
export function extendNativeSea(geometry: T.BufferGeometry) {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const inner = [[bounds.min.x, bounds.min.z], [bounds.max.x, bounds.min.z], [bounds.max.x, bounds.max.z], [bounds.min.x, bounds.max.z]];
    const outer = [[-240, -240], [240, -240], [240, 240], [-240, 240]];
    const position = geometry.getAttribute('position'), color = geometry.getAttribute('color');
    const colors: number[][] = [];
    for (const [x, z] of inner) {
        let nearest = 0, distance = Infinity;
        for (let i = 0; i < position.count; i++) {
            const d = (position.getX(i) - x) ** 2 + (position.getZ(i) - z) ** 2;
            if (d < distance) { nearest = i; distance = d; }
        }
        const rgba = [color.getX(nearest), color.getY(nearest), color.getZ(nearest)];
        if (color.itemSize === 4) rgba.push(color.getW(nearest));
        colors.push(rgba);
    }
    const along = 160, layers = 100, ringSize = along * 4;
    const vertices: number[] = [], rgba: number[] = [], indices: number[] = [];
    for (let ring = 0; ring <= layers; ring++) {
        const t = ring / layers;
        for (let side = 0; side < 4; side++) {
            const next = (side + 1) % 4;
            for (let step = 0; step < along; step++) {
                const u = step / along;
                const ix = T.MathUtils.lerp(inner[side][0], inner[next][0], u), iz = T.MathUtils.lerp(inner[side][1], inner[next][1], u);
                const ox = T.MathUtils.lerp(outer[side][0], outer[next][0], u), oz = T.MathUtils.lerp(outer[side][1], outer[next][1], u);
                const x = T.MathUtils.lerp(ix, ox, t), z = T.MathUtils.lerp(iz, oz, t);
                vertices.push(x, -.026 + .014 * Math.sin(x * 3.1 - z * 1.7) + .006 * Math.cos(x * 6.1 + z * 3.2), z);
                for (let channel = 0; channel < color.itemSize; channel++) rgba.push(T.MathUtils.lerp(colors[side][channel], colors[next][channel], u));
            }
        }
    }
    for (let ring = 0; ring < layers; ring++) for (let i = 0; i < ringSize; i++) {
        const next = (i + 1) % ringSize, a = ring * ringSize + i, b = (ring + 1) * ringSize + i;
        const an = ring * ringSize + next, bn = (ring + 1) * ringSize + next;
        indices.push(a, bn, b, a, an, bn);
    }
    const skirt = new T.BufferGeometry();
    skirt.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    skirt.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(vertices.length / 3 * 2), 2));
    skirt.setAttribute('color', new T.Float32BufferAttribute(rgba, color.itemSize));
    skirt.setIndex(indices); skirt.computeVertexNormals();
    const merged = mergeGeometries([geometry, skirt]);
    geometry.dispose(); skirt.dispose();
    if (!merged) throw new Error('Original water attributes differ from the native sea extension.');
    return merged;
}

/** Reflect the current 3D scene, including the same original orthographic camera. */
export function reflectNativeSea(mesh: T.Mesh<T.BufferGeometry, T.MeshPhysicalMaterial>, renderer: T.WebGLRenderer,
    scene: T.Scene, camera: T.OrthographicCamera, targetPoint: T.Vector3) {
    const target = new T.WebGLRenderTarget(1024, 1024, { type: T.HalfFloatType });
    const reflectionMatrix = new T.Matrix4(), reflectedCamera = camera.clone();
    const material = mesh.material;
    material.onBeforeCompile = shader => {
        shader.uniforms.islandReflection = { value: target.texture };
        shader.uniforms.islandReflectionMatrix = { value: reflectionMatrix };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform mat4 islandReflectionMatrix;\nvarying vec4 islandReflectionCoord;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nislandReflectionCoord = islandReflectionMatrix * modelMatrix * vec4(transformed, 1.0);');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform sampler2D islandReflection;\nvarying vec4 islandReflectionCoord;')
            .replace('#include <opaque_fragment>', `
                vec2 reflectedUV = islandReflectionCoord.xy / islandReflectionCoord.w;
                vec3 reflectedColor = texture2D(islandReflection, reflectedUV).rgb;
                float waterFresnel = 0.10 + 0.30 * pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.0);
                outgoingLight = mix(outgoingLight, reflectedColor, waterFresnel);
                #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'native05-reflected-tide';
    // A separate reflection prepass avoids re-entering a transmission draw.
    const update = () => {
        const height = -.025;
        reflectedCamera.copy(camera); reflectedCamera.position.y = 2 * height - camera.position.y;
        const reflectedPoint = targetPoint.clone(); reflectedPoint.y = 2 * height - reflectedPoint.y;
        reflectedCamera.up.copy(camera.up); reflectedCamera.up.y *= -1;
        reflectedCamera.lookAt(reflectedPoint); reflectedCamera.updateMatrixWorld();
        reflectionMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1)
            .multiply(reflectedCamera.projectionMatrix).multiply(reflectedCamera.matrixWorldInverse);
        const plane = new T.Plane(new T.Vector3(0, 1, 0), -height).applyMatrix4(reflectedCamera.matrixWorldInverse);
        const clip = new T.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
        const q = new T.Vector4(Math.sign(clip.x), Math.sign(clip.y), 1, 1).applyMatrix4(reflectedCamera.projectionMatrix.clone().invert());
        clip.multiplyScalar(2 / clip.dot(q));
        const e = reflectedCamera.projectionMatrix.elements;
        e[2] = clip.x - e[3]; e[6] = clip.y - e[7]; e[10] = clip.z - e[11]; e[14] = clip.w - e[15];
        const previous = renderer.getRenderTarget(), tone = renderer.toneMapping;
        mesh.visible = false; renderer.toneMapping = T.NoToneMapping;
        try { renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, reflectedCamera); }
        finally { renderer.setRenderTarget(previous); renderer.toneMapping = tone; mesh.visible = true; }
    };
    return { update, dispose: () => target.dispose() };
}
