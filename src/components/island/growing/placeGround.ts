import * as T from 'three';
import type { SceneLayout } from './sceneLayout';

/** One real floor triangulation, sampled from the same height function used by feet and
 * water. Decorative headlands and stone banks surround, rather than cut into, owned cells. */
export function buildPlaceGround(layout: SceneLayout) {
    const { bounds } = layout;
    const xs = [bounds.minX - .5, ...Array.from({ length: layout.width }, (_, i) => bounds.minX + i), bounds.maxX + .5];
    const zs = [-.5, ...Array.from({ length: layout.depth }, (_, i) => i), bounds.depth - .5];
    const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
    const meadow = new T.Color('#9dcc88'), shade = new T.Color('#84bba1');
    for (const z of zs) for (const x of xs) {
        const y = layout.heightAt({ x, z });
        vertices.push(x - layout.center, y, z - 2);
        const color = meadow.clone().lerp(shade, Math.min(.28, y * .14));
        const variation = .97 + Math.sin(x * 1.37 + z * .42) * Math.sin(z * .83) * .025;
        colors.push(color.r * variation, color.g * variation, color.b * variation);
    }
    for (let z = 0; z < zs.length - 1; z++) for (let x = 0; x < xs.length - 1; x++) {
        const a = z * xs.length + x, b = a + 1, c = a + xs.length, d = c + 1;
        indices.push(a, c, b, b, c, d);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
    const floor = new T.Mesh(geometry, material); floor.name = 'growing-owned-floor'; floor.receiveShadow = true;
    floor.userData.terrainSurface = true;
    const skirtVertices: number[] = [], skirtIndices: number[] = [], skirtColors: number[] = [];
    const west = xs[0], east = xs[xs.length - 1], north = zs[0], south = zs[zs.length - 1];
    const edge: { x: number; z: number; nx: number; nz: number }[] = [];
    const line = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number) => {
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) * 8);
        for (let i = 0; i < steps; i++) edge.push({ x: ax + (bx - ax) * i / steps, z: az + (bz - az) * i / steps, nx, nz });
    };
    const corner = (x: number, z: number, angle: number) => {
        for (let i = 0; i <= 8; i++) { const a = angle + Math.PI / 2 * i / 8; edge.push({ x, z, nx: Math.cos(a), nz: Math.sin(a) }); }
    };
    line(west, north, east, north, 0, -1); corner(east, north, -Math.PI / 2);
    line(east, north, east, south, 1, 0); corner(east, south, 0);
    line(east, south, west, south, 0, 1); corner(west, south, Math.PI / 2);
    line(west, south, west, north, -1, 0); corner(west, north, Math.PI);
    const rings = 8;
    for (let ring = 0; ring <= rings; ring++) for (const cell of edge) {
        const t = ring / rings, a = Math.atan2(cell.z - (north + south) / 2, cell.x - (west + east) / 2);
        // Everything beyond the unchanged owned rectangle is decorative bank. Rounded
        // corner arcs and a varying outer shore blend raised districts into the old
        // island pedestal, instead of wrapping them in a vertical rectangular wall.
        const headland = Math.pow(.5 + .5 * Math.sin(a * 3 - .7), 2);
        const littleCape = Math.pow(.5 + .5 * Math.cos(a * 5 + .6), 4);
        const width = Math.max(.45 + layout.heightAt(cell) * .82, .48 + headland * 1.30 + littleCape * .82);
        const spread = width * t;
        const fade = t * t * (3 - 2 * t), top = layout.heightAt(cell);
        skirtVertices.push(cell.x - layout.center + cell.nx * spread, top * (1 - fade) - .075 * fade, cell.z - 2 + cell.nz * spread);
        const coast = T.MathUtils.smoothstep(t, .18, .90);
        const tint = meadow.clone().lerp(shade, Math.min(.28, top * .14)).lerp(new T.Color('#93b1bc'), coast * .82);
        skirtColors.push(tint.r, tint.g, tint.b);
    }
    const triangle = (a: number, b: number, c: number) => {
        const point = (index: number) => new T.Vector3(skirtVertices[index * 3], skirtVertices[index * 3 + 1], skirtVertices[index * 3 + 2]);
        const start = point(a);
        // Inner corner arcs share one exact owned corner, so their collapsed faces
        // have no area. Keep only the real fan triangles extending into the bank.
        if (point(b).sub(start).cross(point(c).sub(start)).lengthSq() > 1e-12) skirtIndices.push(a, b, c);
    };
    for (let ring = 0; ring < rings; ring++) for (let i = 0; i < edge.length; i++) {
        const a = ring * edge.length + i, b = ring * edge.length + (i + 1) % edge.length;
        const c = a + edge.length, d = b + edge.length;
        triangle(a, b, c); triangle(b, d, c);
    }
    const skirtGeometry = new T.BufferGeometry(); skirtGeometry.setAttribute('position', new T.Float32BufferAttribute(skirtVertices, 3));
    skirtGeometry.setAttribute('color', new T.Float32BufferAttribute(skirtColors, 3)); skirtGeometry.setIndex(skirtIndices); skirtGeometry.computeVertexNormals();
    const skirtMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide });
    const skirt = new T.Mesh(skirtGeometry, skirtMaterial); skirt.name = 'growing-terrain-bank'; skirt.receiveShadow = true;
    skirt.userData.decorativeBank = { rings, owned: [west, east, north, south] };
    // A rounded pale rock shelf gives the shore thickness below the grass. The old
    // oversized rectangular pedestal is no longer needed for an expanded island.
    const rockVertices: number[] = [], rockIndices: number[] = [], rockColors: number[] = [];
    const rockProfile = [[0, -.075], [.07, -.13], [.08, -.27], [-.04, -.43]];
    const rockTints = ['#b9c5c9', '#9fadc1', '#8698b0', '#7799b0'];
    for (const [ring, [spread, y]] of rockProfile.entries()) for (let i = 0; i < edge.length; i++) {
        const outer = (rings * edge.length + i) * 3, cell = edge[i];
        rockVertices.push(skirtVertices[outer] + cell.nx * spread, y, skirtVertices[outer + 2] + cell.nz * spread);
        const tint = new T.Color(rockTints[ring]); rockColors.push(tint.r, tint.g, tint.b);
        if (ring < rockProfile.length - 1) {
            const a = ring * edge.length + i, b = ring * edge.length + (i + 1) % edge.length;
            rockIndices.push(a, b, a + edge.length, b, b + edge.length, a + edge.length);
        }
    }
    const rockGeometry = new T.BufferGeometry(); rockGeometry.setAttribute('position', new T.Float32BufferAttribute(rockVertices, 3));
    rockGeometry.setAttribute('color', new T.Float32BufferAttribute(rockColors, 3)); rockGeometry.setIndex(rockIndices); rockGeometry.computeVertexNormals();
    const rockMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: T.DoubleSide });
    const rock = new T.Mesh(rockGeometry, rockMaterial); rock.name = 'growing-rounded-rock-coast'; rock.receiveShadow = true;
    const root = new T.Group(); root.name = 'growing-shared-terrain'; root.add(floor, skirt, rock);
    return { root, floor, dispose() { geometry.dispose(); material.dispose(); skirtGeometry.dispose(); skirtMaterial.dispose(); rockGeometry.dispose(); rockMaterial.dispose(); } };
}
