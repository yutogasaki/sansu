import { compileWorldDefinition } from './worldDefinition';
import type { WorldDefinition, WorldEdge, WorldSite } from './worldTypes';

/** A sloped authored district with negative planting coordinates and quarter walks. */
export function authoredAccessWorld() {
    const districtId = 'authored-access', floorId = 'sloped-ground';
    const plantingAndWalkSites: WorldSite[] = [], edges: WorldEdge[] = [];
    const definition: WorldDefinition = { version: 1, id: 'authored-access-v1', districts: [{
        id: districtId, templateId: 'authored-access-test', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [{ id: floorId, kind: 'ground', color: '#a4c2da',
            vertices: [[-1.5, -3.5], [-1.5, 4.5], [5.5, -3.5], [5.5, 4.5]].map(([x, z]) => ({ cell: { x, z }, point: { x, y: x * .03 + z * .02, z } })),
            indices: [0, 1, 2, 2, 1, 3] }], sites: plantingAndWalkSites, ports: [],
    }], edges };
    const siteKey = (x: number, z: number) => `${x},${z}`;
    for (let zi = -12; zi <= 16; zi++) for (let xi = -4; xi <= 20; xi++) {
        const x = xi / 4, z = zi / 4;
        plantingAndWalkSites.push({ id: siteKey(x, z), cell: { x, z }, floorId, placement: Number.isInteger(x) && Number.isInteger(z) });
    }
    const sites = new Set(plantingAndWalkSites.map(site => site.id));
    for (const site of plantingAndWalkSites) for (const [dx, dz] of [[.25, 0], [0, .25], [1, 0], [0, 1]]) {
        const other = siteKey(site.cell.x + dx, site.cell.z + dz);
        if (!sites.has(other) || dx + dz === 1 && !site.placement) continue;
        edges.push({ from: { districtId, siteId: site.id }, to: { districtId, siteId: other }, allows: dx + dz === 1 ? ['join', 'water'] : ['walk'] });
    }
    return { world: compileWorldDefinition(definition), definition };
}
