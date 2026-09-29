import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { partitionStaticRaycast } from './staticRaycast';

export type V3 = [number, number, number];
/** Deterministic variation: presentation must not consume a simulation random seed. */
export const variation = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export class GardenGeometry {
    readonly root = new T.Group();
    private materials = new Map<string, T.MeshStandardMaterial>();
    paint(color: string, roughness = .88, glow = 0) {
        const key = `${color}:${roughness}:${glow}`;
        let material = this.materials.get(key);
        if (!material) {
            material = new T.MeshStandardMaterial({ color, roughness, emissive: color, emissiveIntensity: glow });
            this.materials.set(key, material);
        }
        return material;
    }
    mesh(geometry: T.BufferGeometry, material: T.Material, at: V3 = [0, 0, 0], parent: T.Object3D = this.root) {
        const mesh = new T.Mesh(geometry, material); mesh.position.set(...at);
        mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    pebble(color: string, at: V3, scale: V3, parent: T.Object3D = this.root, segments = 12) {
        const mesh = this.mesh(new T.SphereGeometry(1, segments, Math.max(3, Math.floor(segments / 2))), this.paint(color), at, parent);
        mesh.scale.set(...scale); return mesh;
    }
    box(color: string, at: V3, size: V3, parent: T.Object3D = this.root, radius = .06) {
        return this.mesh(new RoundedBoxGeometry(...size, 1, Math.min(radius, Math.min(...size) / 3)), this.paint(color), at, parent);
    }
    branch(points: V3[], radius: number, color: string, parent: T.Object3D = this.root) {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        return this.mesh(new T.TubeGeometry(curve, points.length === 2 ? 1 : 16, radius, 7, false), this.paint(color), [0, 0, 0], parent);
    }
    taperedBranch(points: V3[], base: number, tip: number, color: string, parent: T.Object3D = this.root) {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        const geometry = new T.TubeGeometry(curve, 64, 1, 12, false), positions = geometry.attributes.position;
        for (let i = 0; i <= 64; i++) {
            const t = i / 64, center = curve.getPointAt(t), radius = T.MathUtils.lerp(base,tip,t);
            for (let j = 0; j <= 12; j++) {
                const index = i * 13 + j, p = new T.Vector3().fromBufferAttribute(positions,index).sub(center).multiplyScalar(radius).add(center);
                positions.setXYZ(index,p.x,p.y,p.z);
            }
        }
        geometry.computeVertexNormals();
        return this.mesh(geometry,this.paint(color),[0,0,0],parent);
    }
    /** Static meshes share a few draw calls; animate only the containing group. */
    batch(parent: T.Group = this.root) {
        parent.updateMatrixWorld(true);
        const groups = new Map<T.Material | 'vertex-paint', T.Mesh[]>();
        for (const child of [...parent.children]) if (child instanceof T.Mesh && !Array.isArray(child.material)) {
            const material = child.material;
            const key = material instanceof T.MeshStandardMaterial && material.roughness === .88 && material.emissiveIntensity === 0
                && material.onBeforeCompile === T.Material.prototype.onBeforeCompile ? 'vertex-paint' : material;
            const group = groups.get(key) ?? []; group.push(child); groups.set(key, group);
        }
        for (const [key, meshes] of groups) {
            if (meshes.length < 2) continue;
            const material = key === 'vertex-paint' ? this.paint('#ffffff') : key;
            if (key === 'vertex-paint') (material as T.MeshStandardMaterial).vertexColors = true;
            const geometries = meshes.map(mesh => {
                mesh.updateMatrix(); const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
                if (key === 'vertex-paint') {
                    const color = (mesh.material as T.MeshStandardMaterial).color, colors = new Float32Array(geometry.attributes.position.count * 3);
                    for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
                    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
                }
                // Retain authored vertices, seams and normals. Only non-indexed
                // parts need sequential indices so every part can share one draw.
                if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
                return geometry;
            });
            const merged = mergeGeometries(geometries, false);
            geometries.forEach(g => g.dispose());
            if (!merged) continue;
            meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.removeFromParent(); });
            const combined = this.mesh(merged, material, [0, 0, 0], parent);
            partitionStaticRaycast(combined, geometries.map(geometry => ({ count: geometry.index!.count })));
            combined.castShadow = meshes.some(mesh => mesh.castShadow);
            combined.receiveShadow = meshes.some(mesh => mesh.receiveShadow);
        }
    }
    dispose() { this.materials.forEach(material => material.dispose()); this.materials.clear(); }
}

export function leafGeometry() {
    const shape = new T.Shape(); shape.moveTo(0, -.02);
    shape.bezierCurveTo(-.37, .13, -.28, .61, 0, .88);
    shape.bezierCurveTo(.31, .57, .33, .16, 0, -.02);
    const geometry = new T.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: false, curveSegments: 4, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for(let i=0;i<positions.count;i++) positions.setY(i,positions.getY(i)+.13*Math.sin(Math.abs(positions.getZ(i))*Math.PI/.88)-.12*Math.abs(positions.getX(i)));
    geometry.computeVertexNormals(); return geometry;
}
