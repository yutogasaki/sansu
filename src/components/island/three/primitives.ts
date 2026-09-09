import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentIslandArtDirection, islandWorldColor, makeWorldPattern, type IslandWorldAppearance } from './worldPalette';
import { createResidentFabric } from './residentFabric';

// A small, material-specific palette. World geometry never contains UI text.
export class IslandMaterials {
    constructor(readonly artDirection: IslandWorldAppearance = currentIslandArtDirection()) {}
    private readonly colors = new Map<string, THREE.MeshStandardMaterial>();
    private readonly patterns = new Map<string, THREE.DataTexture>();
    private cloth?: ReturnType<typeof createResidentFabric>;
    readonly painted = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .87, metalness: 0 });
    get(color: string, glow = false) {
        return this.surface(color, .87, 0, glow);
    }
    surface(color: string, roughness: number, metalness = 0, glow = false) {
        const key = `${color}:${roughness}:${metalness}:${glow}`;
        let material = this.colors.get(key);
        if (!material) {
            let pattern = this.patterns.get(color);
            if (!pattern) {
                pattern = makeWorldPattern(color, this.artDirection);
                if (pattern) this.patterns.set(color, pattern);
            }
            const paint = this.color(color);
            material = new THREE.MeshStandardMaterial({ color: pattern ? '#ffffff' : paint, roughness, metalness,
                ...(pattern ? { map: pattern } : {}),
                ...(glow ? { emissive: paint, emissiveIntensity: .65 } : {}) });
            this.colors.set(key, material);
        }
        return material;
    }
    color(source: string) { return islandWorldColor(source, this.artDirection); }
    residentFabric() { return (this.cloth ??= createResidentFabric()).material; }
    dispose() {
        for (const material of this.colors.values()) material.dispose();
        for (const texture of this.patterns.values()) texture.dispose();
        this.painted.dispose();
        this.cloth?.dispose();
    }
}

export function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
    position: [number, number, number] = [0, 0, 0], scale?: [number, number, number]) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    if (scale) object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
}
export function ellipsoid(parent: THREE.Object3D, material: THREE.Material,
    position: [number, number, number], scale: [number, number, number], detail = 16) {
    return mesh(parent, new THREE.SphereGeometry(1, detail, 12), material, position, scale);
}
export function box(parent: THREE.Object3D, material: THREE.Material,
    position: [number, number, number], size: [number, number, number]) {
    return mesh(parent, new THREE.BoxGeometry(...size), material, position);
}
export function cylinder(parent: THREE.Object3D, material: THREE.Material,
    position: [number, number, number], radius: number, height: number, top = radius, detail = 12) {
    return mesh(parent, new THREE.CylinderGeometry(top, radius, height, detail), material, position);
}
export function pole(parent: THREE.Object3D, material: THREE.Material,
    start: [number, number, number], end: [number, number, number], radius: number, top = radius) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a);
    const object = cylinder(parent, material, [0, 0, 0], radius, direction.length(), top);
    object.position.copy(a.add(b).multiplyScalar(.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
}
export function curve(parent: THREE.Object3D, material: THREE.Material, points: [number, number, number][], radius: number) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
        Math.max(8, points.length * 4), radius, 5, false), material);
}
export function star(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], size: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? size * .47 : size;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const object = mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: size * .23,
        bevelEnabled: true, bevelSize: size * .1, bevelThickness: size * .1, bevelSegments: 2, steps: 1 }), material, position);
    object.rotation.y = .18;
    return object;
}

/** Merge static pieces by material, retaining tactile geometry without hundreds of draw calls. */
export function batch(group: THREE.Group, painted?: THREE.MeshStandardMaterial) {
    group.updateMatrixWorld(true);
    const worldInverse = group.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const originals: THREE.Mesh[] = [];
    group.traverse(object => {
        if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
        const geometry = object.geometry.clone().applyMatrix4(worldInverse.clone().multiply(object.matrixWorld));
        // Solid pieces need no UVs. Authored procedural paint keeps its coordinates when batched.
        const mapped = object.material instanceof THREE.MeshStandardMaterial && (object.material.map || object.material.bumpMap);
        if (!mapped) geometry.deleteAttribute('uv');
        else if (!geometry.attributes.uv) {
            geometry.computeBoundingBox();
            const bounds = geometry.boundingBox!, size = bounds.getSize(new THREE.Vector3());
            const positions = geometry.attributes.position, uv = new Float32Array(positions.count * 2);
            for (let i = 0; i < positions.count; i++) {
                uv[i * 2] = (positions.getX(i) - bounds.min.x) / Math.max(.001, size.x);
                uv[i * 2 + 1] = (positions.getY(i) - bounds.min.y) / Math.max(.001, size.y);
            }
            geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        }
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        if (flat !== geometry) geometry.dispose();
        let material = object.material;
        if (painted && material instanceof THREE.MeshStandardMaterial && material.emissive.getHex() === 0
            && !material.map && !material.bumpMap && material.roughness === painted.roughness && material.metalness === painted.metalness) {
            // Solid color multiplication is identical in the shader. Bake the original
            // linear material color into vertices so one item needs one solid draw call.
            // Emissive bulbs remain separate to preserve their actual light response.
            const color = material.color, colors = new Float32Array(flat.attributes.position.count * 3);
            for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
            flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            material = painted;
        }
        const list = buckets.get(material) ?? [];
        list.push(flat);
        buckets.set(material, list);
        originals.push(object);
    });
    for (const object of originals) { object.removeFromParent(); object.geometry.dispose(); }
    for (const [material, geometries] of buckets) {
        const merged = mergeGeometries(geometries);
        for (const geometry of geometries) geometry.dispose();
        if (merged) mesh(group, merged, material);
    }
    return group;
}

export function disposeGeometry(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), owned = new Set<THREE.Material>();
    object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
            if (material.userData.islandOwned) owned.add(material);
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    owned.forEach(material => material.dispose());
}
