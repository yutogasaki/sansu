import * as T from 'three';
import { buildPlaceGround } from '../placeGround';
import type { SceneLayout } from '../sceneLayout';

/** Authored asymmetric shore around the unchanged owned floor. Every shore ring
 * stays outside the owned rectangle; a decorative inlet never removes a save cell. */
export function buildNativeGrowingGround(layout: SceneLayout, profile: readonly number[]) {
    const base = buildPlaceGround(layout);
    for (const child of [...base.root.children]) if (child !== base.floor) child.removeFromParent();
    const count = profile.length, rings = 18, halfX = layout.width / 2, halfZ = layout.depth / 2;
    const centerZ = (layout.depth - 1) / 2 - 2;
    const vertices: number[] = [], colors: number[] = [], indices: number[] = [];
    const meadow = new T.Color('#a4cb87'), mineral = new T.Color('#84b9b0'), sand = new T.Color('#d0c9b8');
    const edge: { x: number; z: number; nx: number; nz: number; top: number }[] = [];
    const smoothProfile = (i: number) => [1, 2, 3, 2, 1].reduce((sum, weight, n) => sum + profile[(i + n - 2 + count) % count] * weight, 0) / 9;
    for (let i = 0; i < count; i++) {
        const a = -Math.PI + i * Math.PI * 2 / count, c = Math.cos(a), s = Math.sin(a);
        const r = Math.min(halfX / Math.max(1e-6, Math.abs(c)), halfZ / Math.max(1e-6, Math.abs(s)));
        const margin = .8 + smoothProfile(i) * (layout.artMargin > 1.1 ? 2.25 : 1.1);
        const rx = halfX + margin, rz = halfZ + margin;
        const outer = Math.max(r + .45, (Math.pow(Math.abs(c / rx), 4) + Math.pow(Math.abs(s / rz), 4)) ** -.25);
        edge.push({ x: c * r, z: s * r + centerZ, nx: c * (outer - r), nz: s * (outer - r), top: layout.heightAt({ x: c * r + layout.center, z: s * r + centerZ + 2 }) });
    }
    for (let ring = 0; ring <= rings; ring++) for (let i = 0; i < count; i++) {
        const p = edge[i], t = ring / rings, fade = t * t * (3 - 2 * t), near = Math.sin(t * Math.PI) * .055;
        vertices.push(p.x + p.nx * t, p.top * (1 - fade) + near - .09 * fade, p.z + p.nz * t);
        const color = meadow.clone().lerp(mineral, Math.min(.55, p.top * .12)).lerp(sand, T.MathUtils.smoothstep(t, .72, 1) * .55);
        colors.push(color.r, color.g, color.b);
        if (ring < rings) { const a = ring * count + i, b = ring * count + (i + 1) % count; indices.push(a, b, a + count, b, b + count, a + count); }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .93, side: T.DoubleSide });
    const bank = new T.Mesh(geometry, material); bank.name = 'native05-shore-bank'; bank.receiveShadow = true;
    bank.userData.decorativeBank = { source: 'native05 coast profile', ownedCellsPreserved: true }; base.root.add(bank);
    const rockVertices: number[] = [], rockIndices: number[] = [], rockColors: number[] = [];
    const rockTints = ['#c7c6ce', '#aeb6c8', '#90a3bd', '#7facc2'];
    for (let ring = 0; ring < 4; ring++) for (let i = 0; i < count; i++) {
        const p = edge[i], length = Math.hypot(p.nx, p.nz), offset = [.015, .09, .08, -.07][ring];
        rockVertices.push(p.x + p.nx * (1 + offset / length), [-.09, -.16, -.31, -.48][ring], p.z + p.nz * (1 + offset / length));
        const color = new T.Color(rockTints[ring]); rockColors.push(color.r, color.g, color.b);
        if (ring < 3) { const a = ring * count + i, b = ring * count + (i + 1) % count; rockIndices.push(a, a + count, b, b, a + count, b + count); }
    }
    const rockGeometry = new T.BufferGeometry(); rockGeometry.setAttribute('position', new T.Float32BufferAttribute(rockVertices, 3)); rockGeometry.setAttribute('color', new T.Float32BufferAttribute(rockColors, 3)); rockGeometry.setIndex(rockIndices); rockGeometry.computeVertexNormals();
    const rockMaterial = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: .95 });
    const rock = new T.Mesh(rockGeometry, rockMaterial); rock.name = 'native05-layered-shore'; rock.receiveShadow = true; base.root.add(rock);
    // Actual owned cells use the same triangles, not this curved decorative bank.
    const floorPositions = base.floor.geometry.getAttribute('position'), floorColors = base.floor.geometry.getAttribute('color');
    for (let i = 0; i < floorPositions.count; i++) {
        const color = meadow.clone().lerp(mineral, Math.min(.55, floorPositions.getY(i) * .12)); floorColors.setXYZ(i, color.r, color.g, color.b);
    }
    floorColors.needsUpdate = true;
    return { root: base.root, floor: base.floor, dispose() { base.dispose(); geometry.dispose(); material.dispose(); rockGeometry.dispose(); rockMaterial.dispose(); } };
}
