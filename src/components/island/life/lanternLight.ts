import * as T from 'three';
import { lanternGround } from '../../../domain/islandLife/footstepMagic';
import type { Cell, LifeState } from '../../../domain/islandLife/model';
import { cellKey } from '../../../domain/islandLife/space';

/** One union of reachable cells: overlapping lanterns never stack brightness. */
export function buildLanternLight(state: LifeState, point: (cell: Cell) => T.Vector3) {
    const root = new T.Group(); root.name = 'life-lantern-ground';
    const regions = state.items.filter(i => i.kind === 'lantern' && i.cell).map(lamp => ({ lampId: lamp.id, cells: lanternGround(state, lamp) }));
    const cells = new Map(regions.flatMap(r => r.cells.map(c => [cellKey(c), c] as const)));
    const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [];
    for (const cell of cells.values()) {
        const geometry = new T.PlaneGeometry(1, 1);
        const edges = new T.Vector4(...[[1, 0], [-1, 0], [0, -1], [0, 1]].map(([x, z]) => cells.has(cellKey({ x: cell.x + x, z: cell.z + z })) ? 0 : 1) as [number, number, number, number]);
        const material = new T.ShaderMaterial({ transparent: true, depthWrite: false,
            uniforms: { edges: { value: edges }, tint: { value: new T.Color('#ffe8a0') } },
            vertexShader: 'varying vec2 uvAt; void main(){uvAt=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: `varying vec2 uvAt; uniform vec4 edges; uniform vec3 tint;
                void main(){float edge=min(min(mix(1.,1.-uvAt.x,edges.x),mix(1.,uvAt.x,edges.y)),min(mix(1.,1.-uvAt.y,edges.z),mix(1.,uvAt.y,edges.w)));
                gl_FragColor=vec4(tint,.22*smoothstep(0.,.25,edge));
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                }` });
        const tile = new T.Mesh(geometry, material); tile.rotation.x = -Math.PI / 2;
        tile.position.copy(point(cell)); tile.position.y = .087; tile.userData.cell = cell;
        root.add(tile); geometries.push(geometry); materials.push(material);
    }
    return { root, regions, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent(); } };
}
