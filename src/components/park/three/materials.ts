import * as THREE from 'three';

export function createMaterials() {
    const resin = (color: string, roughness = .3) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: .45, clearcoatRoughness: .24 });
    // Deterministic low-contrast wood grain, shared on the plinth and supports.
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e6c99f'; ctx.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 45; i++) {
        ctx.strokeStyle = i % 3 ? 'rgba(147,98,49,.075)' : 'rgba(255,246,214,.19)'; ctx.lineWidth = i % 3 ? .8 : 1.5;
        ctx.beginPath();
        for (let x = 0; x <= 256; x += 4) {
            const y = i * 3 + Math.sin(x * .028 + i * 1.7) * 1.3;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        } ctx.stroke();
    }
    const grain = new THREE.CanvasTexture(canvas); grain.colorSpace = THREE.SRGBColorSpace;
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    return { coral: resin('#df5a49'), coralEdge: resin('#c94338'), teal: resin('#17756f'), yellow: resin('#eabb38'),
        violet: resin('#4d4995', .34), cream: resin('#fff0cd', .48), sole: resin('#b9b4d1', .65),
        ink: resin('#283d51', .48), membrane: new THREE.MeshStandardMaterial({ color: '#9eb7ae', roughness: .93, side: THREE.DoubleSide }),
        wood: new THREE.MeshStandardMaterial({ map: grain, color: '#d3b386', roughness: .68 }),
        top: new THREE.MeshStandardMaterial({ map: grain, color: '#fff3de', roughness: .77 }),
        ground: new THREE.ShadowMaterial({ color: '#877562', opacity: .14 }),
        seam: new THREE.MeshStandardMaterial({ color: '#c1d7c3', roughness: .9 }),
    };
}
export type ToyMaterials = ReturnType<typeof createMaterials>;

export class ToyPrimitives {
    readonly ball = new THREE.SphereGeometry(1, 24, 16);
    readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);
    readonly geometries = new Set<THREE.BufferGeometry>([this.ball, this.cylinder]);
    keep<T extends THREE.BufferGeometry>(geometry: T): T { this.geometries.add(geometry); return geometry; }
    mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: number[], scale: number[] = [1, 1, 1]) {
        const mesh = new THREE.Mesh(geometry, material); mesh.position.set(position[0], position[1], position[2]);
        mesh.scale.set(scale[0], scale[1], scale[2]); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    ellipsoid(parent: THREE.Object3D, material: THREE.Material, position: number[], scale: number[]) { return this.mesh(parent, this.ball, material, position, scale); }
    tube(parent: THREE.Object3D, material: THREE.Material, points: THREE.Vector3[], radius: number, closed = false) {
        return this.mesh(parent, this.keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(24, points.length * 4), radius, 10, closed)), material, [0, 0, 0]);
    }
    dispose() { this.geometries.forEach(g => g.dispose()); }
}
