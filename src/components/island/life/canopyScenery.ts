import { canopyClearanceStudy, canopyClearanceHeights } from './canopyClearanceStudy';
import * as T from 'three';
import { batch } from '../three/primitives';
import { canopySculptStudy, loadCanopySculpt } from './canopySculptStudy';
import { canopyMaterialStudy, makeCanopyStudyWood } from './canopyMaterialStudy';

/** Sculptural world geometry only. Coordinates stay behind the playable grid;
 * residents, paths, objects and hit targets are owned by the existing scene. */
export function buildCanopyScenery(center: number) {
    const root = new T.Group(); root.name = 'life-canopy-c3';
    root.userData.worldStyle = 'canopy-dots-c3-v1';
    const wood = new T.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
    root.userData.visualCandidate = canopyMaterialStudy ? 'canopy-bark-runtime-study-v1' : 'canopy-dots-c3-v1';
    const disposeStudy = canopyMaterialStudy ? makeCanopyStudyWood(wood, root) : undefined;
    const paints: T.Material[] = [wood];
    const branch = (points: number[][], radius: number, tip: number, cool = false) => {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        const steps = 56, sides = 24, geometry = new T.TubeGeometry(curve, steps, radius, sides, false);
        const positions = geometry.getAttribute('position'), colors: number[] = [];
        for (let i = 0; i <= steps; i++) {
            const at = i / steps, axis = curve.getPointAt(at), taper = 1 + (tip / radius - 1) * at;
            for (let j = 0; j <= sides; j++) {
                const index = i * (sides + 1) + j;
                const vertex = new T.Vector3().fromBufferAttribute(positions, index).sub(axis).multiplyScalar(taper * (1 + .035 * Math.sin(j / sides * Math.PI * 22 + at * 8))).add(axis);
                positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
                const shade = .5 + .5 * Math.sin(j / sides * Math.PI * 16 + at * 8);
                const color = canopyMaterialStudy ? new T.Color(cool ? '#75a89b' : '#e2d4b7')
                    : new T.Color(cool ? '#255b60' : '#765134').lerp(new T.Color(cool ? '#549985' : '#bc8851'), shade * .7);
                colors.push(color.r, color.g, color.b);
            }
        }
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
        const mesh = new T.Mesh(geometry, wood); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
    };
    // Two asymmetrical arms leave daylight and a cool recess behind the cottage.
    branch([[2.9, 0, -3.35], [2.8, 1.4, -3.55], [2.1, 2.6, -3.9], [.9, 3.1, -3.8], [-1.7, 3.2, -3.4], canopyMaterialStudy ? [-3.65, 4.1, -4.6] : [-3.5, 3.9, -3.3]], .92, canopyMaterialStudy ? .03 : .35);
    branch([[2.8, .25, -3.5], [3.15, 1.9, -3.75], [2.9, 3.65, -4], [3.5, 4.9, -4.4]], .62, canopyMaterialStudy ? .035 : .25);
    branch([[2.9, .15, -3.4], [1.5, .70, -3.4], [.4, 1.7, -3.65], [-1.3, 1.35, -3.4], [-2.9, -.04, -3.1]], .48, .19);
    branch([[2.4, .05, -3.8], [1.9, 1.2, -4.3], [.9, 2.3, -4.5], [-.8, 2.5, -4.4]], .52, .22, true);
    branch([[2.8, .03, -3.6], [3.4, .25, -3.45], [4.1, -.04, -3.3]], .26, .10);

    const leaf = (position: number[], scale: number[], rotation: number[], color: string, dot: string) => {
        // Closed, curved lamina. Both pointed ends converge to a single height;
        // an unscaled edge curl at v=0/1 would form a torn fan of triangles.
        const across = 28, along = 24, vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
        for (const underside of [false, true]) for (let j = 0; j <= along; j++) for (let i = 0; i <= across; i++) {
            const u = i / across * 2 - 1, v = j / along, envelope = Math.max(0, Math.sin(v * Math.PI));
            const width = Math.pow(envelope, .72);
            const bend = .34 * (1 - u * u) * envelope + .42 * u ** 4 * envelope - .46 * v * v;
            vertices.push(u * width, bend - (underside ? .065 * width : 0), v * 2 - 1);
            uvs.push(i / across, v);
        }
        const layer = (across + 1) * (along + 1);
        for (let j = 0; j < along; j++) for (let i = 0; i < across; i++) {
            const a = j * (across + 1) + i, b = a + 1, c = a + across + 1, d = c + 1;
            indices.push(a, c, b, b, c, d);
            indices.push(a + layer, b + layer, c + layer, b + layer, d + layer, c + layer);
        }
        for (let j = 0; j < along; j++) for (const i of [0, across]) {
            const a = j * (across + 1) + i, b = a + across + 1;
            if (i === 0) indices.push(a, a + layer, b, b, a + layer, b + layer);
            else indices.push(a, b, a + layer, b, b + layer, a + layer);
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
        const material = new T.MeshPhysicalMaterial({ color, roughness: .48, clearcoat: .28, clearcoatRoughness: .4, side: T.DoubleSide });
        const dotColor = new T.Color(dot);
        material.onBeforeCompile = shader => {
            shader.uniforms.canopyDot = { value: dotColor };
            shader.vertexShader = 'varying vec2 canopyUv;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\ncanopyUv=position.xz;');
            shader.fragmentShader = 'varying vec2 canopyUv; uniform vec3 canopyDot;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
                vec2 p=(canopyUv+1.0)*vec2(1.3,1.15); p.x+=mod(floor(p.y),2.0)*.5;
                float disk=1.0-smoothstep(.205,.22,length(fract(p)-.5));
                diffuseColor.rgb=mix(diffuseColor.rgb,canopyDot,disk);
                diffuseColor.rgb*=mix(.77,1.0,smoothstep(0.0,.10,abs(canopyUv.x)));
            `);
        };
        material.customProgramCacheKey = () => 'canopy-c3-solid-leaf-v2'; paints.push(material);
        const mesh = new T.Mesh(geometry, material); mesh.position.set(...position as [number, number, number]);
        mesh.scale.set(...scale as [number, number, number]); mesh.rotation.set(...rotation as [number, number, number]);
        mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'life-canopy-leaf'; root.add(mesh);
    };
    leaf([-2.7, 4.0, -4.6], [1.3, 1, 1.8], [.1, -.5, -.3], '#834496', '#f0b45e');
    leaf([-.8, 4.3, -4.1], [1.3, 1, 1.55], [.3, .6, .15], '#267f79', '#edc360');
    leaf([1.1, 4.25, -4.8], [1.45, 1, 1.65], [.2, -.3, -.2], '#95529f', '#ed9283');
    leaf([3.2, 4.8, -4.1], [1.4, 1, 1.7], [.4, .8, .2], '#6b498d', '#e6b969');
    leaf([3.65, 2.65, -3.85], [.95, 1, 1.25], [.5, -.5, -.6], '#2a817a', '#dfbc66');
    leaf([-1.6, 2.75, -4.1], [1.1, 1, 1.05], [.45, -.65, -.18], '#398f85', '#e8c974');
    root.position.x = 2.5 - center;
    root.scale.y = canopyClearanceStudy ? canopyClearanceHeights[canopyClearanceStudy] : .67;
    // Leaves need their own shader; batch only the opaque timber geometry.
    const timber = new T.Group();
    [...root.children].filter(child => child instanceof T.Mesh && child.material === wood).forEach(child => timber.add(child));
    batch(timber); root.add(timber);
    const disposeSculpt = canopySculptStudy ? loadCanopySculpt(root, timber, wood, canopySculptStudy) : undefined;
    return { root, dispose: () => { disposeSculpt?.(); disposeStudy?.(); paints.forEach(material => material.dispose()); } };
}
