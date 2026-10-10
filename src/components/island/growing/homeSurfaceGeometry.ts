import * as T from 'three';

function dimension(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('Home dimensions must be positive and finite');
}

function surface(positions: number[], uvs: number[], indices: number[]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

/** Native05's vertical oval wall: rounded shoulders, flat ground and +Z front. */
export function roundedHomeWallGeometry(width: number, height: number, depth = width): T.BufferGeometry {
    dimension(width); dimension(height); dimension(depth);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const sides = 48, shoulder = Math.min(height * .10, width * .07, depth * .07);
    const rings = [[0, .95], [shoulder, 1], [height - shoulder, 1], [height, .95]];
    for (const [y, radius] of rings) for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        positions.push(width / 2 * radius * Math.cos(angle), y, depth / 2 * radius * Math.sin(angle));
        uvs.push(j / sides, y / height);
    }
    const bottom = positions.length / 3;
    positions.push(0, 0, 0, 0, height, 0); uvs.push(.5, 0, .5, 1);
    for (let j = 0; j < sides; j++) {
        const next = (j + 1) % sides;
        indices.push(bottom, j, next, bottom + 1, 3 * sides + next, 3 * sides + j);
        for (let ring = 0; ring < rings.length - 1; ring++) {
            const a = ring * sides + j, an = ring * sides + next, b = a + sides, bn = an + sides;
            indices.push(a, b, bn, a, bn, an);
        }
    }
    return surface(positions, uvs, indices);
}

/**
 * Two overlapping, folded leaves make a habitable roof, adapted from native05
 * lamina. Each blade is a closed volume with a raised midrib and rolled edge;
 * the broad middle stays almost level instead of becoming a pointed cone.
 * Local Y=0 is the front/back tip baseline. Caller owns geometry disposal.
 */
export function foldedHomeRoofGeometry(width: number): T.BufferGeometry {
    dimension(width);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const rings = 24, sides = 24;
    for (const side of [-1, 1]) {
        const start = positions.length / 3;
        positions.push(side * width * .065, 0, -width * .6); uvs.push(.5, 0);
        for (let i = 1; i < rings; i++) {
            const t = i / rings, arch = Math.sin(Math.PI * t);
            const half = width * .56 * arch ** .72;
            const centreX = side * width * (.09 + .05 * (t - .5));
            const centreY = width * .46 * arch ** .38;
            const thickness = width * .032 * Math.sqrt(arch), camber = width * .115 * arch ** .65;
            for (let j = 0; j < sides; j++) {
                const angle = j / sides * Math.PI * 2;
                const across = j === sides / 4 || j === 3 * sides / 4 ? 0 : Math.cos(angle);
                positions.push(centreX + half * across, centreY + thickness * Math.sin(angle) - camber * across ** 2, width * 1.2 * (t - .5));
                uvs.push(across / 2 + .5, t);
            }
        }
        const end = positions.length / 3;
        positions.push(side * width * .115, 0, width * .6); uvs.push(.5, 1);
        for (let j = 0; j < sides; j++) {
            const next = (j + 1) % sides;
            indices.push(start, start + 1 + next, start + 1 + j);
            for (let ring = 0; ring < rings - 2; ring++) {
                const a = start + 1 + ring * sides + j, an = start + 1 + ring * sides + next;
                const b = a + sides, bn = an + sides;
                indices.push(a, an, bn, a, bn, b);
            }
            const last = start + 1 + (rings - 2) * sides;
            indices.push(end, last + j, last + next);
        }
    }
    return surface(positions, uvs, indices);
}
