import type { WorldDefinition, WorldEdge, WorldFloor, WorldSurface } from './worldTypes';

const square = (id: string, kind: WorldFloor['kind'], y: number, x0: number, x1: number): WorldFloor => ({
    id, kind, color: '#b5cadd',
    vertices: [[x0, 1.5], [x0, 2.5], [x1, 1.5], [x1, 2.5]].map(([x, z]) => ({ cell: { x, z }, point: { x, y, z } })),
    indices: [0, 1, 2, 2, 1, 3],
});

/** Original rights stay fixed while the first acquired square becomes an actual pond bed. */
export function waterSupportDefinition(wet = true, deck = false): WorldDefinition {
    const original = square('ground', 'ground', 1, -.5, 2.5), dry = square('ground', 'ground', 1, .5, 2.5);
    const bed = square('ground', 'ground', -.4, -.5, .5);
    const cutGround: WorldFloor = { ...dry, vertices: [...dry.vertices, ...bed.vertices], indices: [...dry.indices, ...bed.indices.map(i => i + dry.vertices.length)] };
    const water = square('water', 'water', .4, -.5, .5);
    const bank: WorldSurface = { id: 'bank', kind: 'bank',
        vertices: [{ x: -.5, y: -.4, z: 1.5 }, { x: -.5, y: 1, z: 1.5 }, { x: -.5, y: -.4, z: 2.5 }, { x: -.5, y: 1, z: 2.5 }],
        indices: [0, 1, 2, 2, 1, 3], material: { color: '#aabbcc', roughness: .8, metalness: .1 } };
    return { version: 1, id: 'water-support', revision: wet ? deck ? 'wet-deck' : 'wet' : 'dry', districts: [{
        id: 'pond', templateId: 'water-support-test', turn: 0, logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
        anchorFloors: [original], floors: wet ? [cutGround, water, ...(deck ? [square('underwater-deck', 'deck', .1, -.5, .5), square('deck', 'deck', 1.2, -.5, .5)] : [])] : [original],
        sites: [0, 1, 2].map(x => ({ id: `site-${x}`, cell: { x, z: 2 }, floorId: 'ground', placement: true, anchorPoint: { x, y: 1, z: 2 } })),
        ports: [], surfaces: wet ? [bank] : [],
    }], edges: [0, 1].map((x): WorldEdge => ({ from: { districtId: 'pond', siteId: `site-${x}` }, to: { districtId: 'pond', siteId: `site-${x + 1}` },
        allows: !wet || deck || x > 0 ? ['walk', 'join', 'water'] : ['join', 'water'] })) };
}
