import * as T from 'three';

const LENGTH = .95;
const TIP_Y = -.36;
const RINGS = 32;
const SIDES = 32;

function section(t: number) {
    const arch = Math.sin(Math.PI * t);
    const rise = .31 * Math.PI * Math.cos(Math.PI * t) + 3 * TIP_Y * t ** 2;
    // A section follows the bend of the blade, rather than staying vertical as
    // the tip droops. This gives the sides and underside a rounded, solid curl.
    const normalLength = Math.hypot(LENGTH, rise);
    return {
        width: .415 * arch ** .52 * (1 - .13 * t),
        centre: .31 * arch + TIP_Y * t ** 3,
        thickness: .09 * Math.sqrt(arch),
        camber: .058 * arch ** .8,
        normalY: LENGTH / normalLength,
        normalZ: rise / normalLength,
        z: -LENGTH * t,
    };
}

function surfacePoint(t: number, across: number, around: number): [number, number, number] {
    const shape = section(t);
    const height = shape.thickness * around - shape.camber * across ** 2;
    return [
        Math.fround(shape.width * across),
        Math.fround(shape.centre + shape.normalY * height),
        Math.fround(shape.z + shape.normalZ * height),
    ];
}

/** A plump, arched fan leaf with a rounded drooping tip and a closed underside. */
export function placeLeafGeometry(): T.BufferGeometry {
    const positions: number[] = [0, 0, 0];
    const uvs: number[] = [.5, 0];
    const indices: number[] = [];
    // The continuous elliptical sections wrap the raised ridge, rolled edges,
    // and belly together. Their shared vertices keep the whole blade smooth.
    for (let i = 1; i < RINGS; i++) {
        const t = i / RINGS;
        for (let j = 0; j < SIDES; j++) {
            const angle = j / SIDES * Math.PI * 2;
            const across = j === SIDES / 4 || j === 3 * SIDES / 4 ? 0 : Math.cos(angle);
            const point = surfacePoint(t, across, Math.sin(angle));
            positions.push(...point);
            uvs.push(point[0] / .83 + .5, t);
        }
    }
    const tip = positions.length / 3;
    positions.push(0, TIP_Y, -LENGTH); uvs.push(.5, 1);
    for (let j = 0; j < SIDES; j++) {
        const next = (j + 1) % SIDES;
        indices.push(0, 1 + j, 1 + next);
        for (let i = 0; i < RINGS - 2; i++) {
            const a = 1 + i * SIDES + j, an = 1 + i * SIDES + next;
            const b = a + SIDES, bn = an + SIDES;
            indices.push(a, b, bn, a, bn, an);
        }
        const last = 1 + (RINGS - 2) * SIDES;
        indices.push(last + j, tip, last + next);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

/** The central vein is the exact upper vertex row of the curved blade. */
export function placeLeafSpine(): [number, number, number][] {
    return Array.from({ length: RINGS + 1 }, (_, i): [number, number, number] => {
        if (i === 0) return [0, 0, 0];
        if (i === RINGS) return [0, Math.fround(TIP_Y), Math.fround(-LENGTH)];
        return surfacePoint(i / RINGS, 0, 1);
    });
}
