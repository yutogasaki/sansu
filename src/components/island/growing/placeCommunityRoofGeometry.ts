import * as T from 'three';
import { communityRoofModules } from '../../../domain/growingIsland/communityRoof';
import type { GrowingState } from '../../../domain/growingIsland/types';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { GardenGeometry } from '../three/garden/geometry';
import type { SceneLayout } from './sceneLayout';

/** Pearl bays attach to the two original homes; the open garden remains the sole floor. */
export function buildCommunityRoofs(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace) {
    if (layout.authored || place.structure !== 'P04:shared-roof' || !['grown', 'lived'].includes(place.stage)) return;
    for (const bay of communityRoofModules(state, place.mainIds)) {
        const root = new T.Group(); root.name = 'place-community-roof'; root.userData.ownerIds = bay.ownerIds;
        root.userData.target = bay.target; root.userData.minClearance = 1.75; g.root.add(root);
        let groundMax = bay.groundMax;
        for (let z = bay.minZ - .12; z <= bay.maxZ + .12; z += .12) for (let x = bay.minX - .12; x <= bay.maxX + .12; x += .12)
            groundMax = Math.max(groundMax, layout.heightAt({ x, z }));
        const eaves = groundMax + 1.95, positions: number[] = [], indices: number[] = [];
        const samples = 24;
        const at = (u: number, front: boolean, underside = false) => {
            const cell = { x: bay.minX + (bay.maxX - bay.minX) * u, z: front ? bay.maxZ : bay.minZ };
            const point = layout.point(cell); point.y = eaves + .34 * Math.sin(Math.PI * u) + (front ? -.035 : .035) - (underside ? .10 : 0); return point;
        };
        for (const underside of [false, true]) for (let i = 0; i <= samples; i++) for (const front of [false, true]) positions.push(...at(i / samples, front, underside).toArray());
        const stride = (samples + 1) * 2;
        for (let i = 0; i < samples; i++) {
            const a = i * 2, b = a + 2;
            indices.push(a, a + 1, b, a + 1, b + 1, b, a + stride, b + stride, a + 1 + stride, a + 1 + stride, b + stride, b + 1 + stride);
            for (const edge of [0, 1]) indices.push(a + edge, b + edge, a + edge + stride, a + edge + stride, b + edge, b + edge + stride);
        }
        for (const a of [0, samples * 2]) indices.push(a, a + stride, a + 1, a + 1, a + stride, a + 1 + stride);
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
        const material = new T.MeshStandardMaterial({ color: '#9cb8df', roughness: .5, metalness: .04, side: T.DoubleSide });
        g.mesh(geometry, material, [0, 0, 0], root).name = 'place-community-pearl-panel';
        for (const front of [false, true]) g.branch(Array.from({ length: samples + 1 }, (_, i) => at(i / samples, front).toArray() as [number, number, number]), .025, '#c2cde8', root);
        for (const [index, id] of bay.ownerIds.entries()) {
            const home = state.plots.find(owner => owner.id === id)!, cell = home.cell!;
            const base = layout.point({ x: cell.x + (index ? -.32 : .32), z: cell.z + .25 }, .08);
            const shoulder = base.clone(); shoulder.y = eaves + .06;
            const end = at(index, false); end.y -= .03;
            const support = new T.Group(); support.name = 'place-community-owner-support'; support.userData.ownerId = id; root.add(support);
            g.branch([base.toArray() as [number, number, number], shoulder.toArray() as [number, number, number], end.toArray() as [number, number, number]], .035, '#a6a6cd', support);
        }
    }
}
