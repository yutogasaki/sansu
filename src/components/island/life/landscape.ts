import * as T from 'three';
import { batch, ellipsoid } from '../three/primitives';
import type { Cell, LifeState } from '../../../domain/islandLife/model';
import { createIslandGrassSurface } from '../three/grassSurface';
import { cellKey, districts, isHouse } from '../../../domain/islandLife/space';

/** The playable rectangle stays level. Irregularity belongs outside its cells. */
export function coastShape(width: number, depth: number) {
    const x = width / 2, z = depth / 2;
    const curve = new T.CatmullRomCurve3([
        [-x + .5, -z], [-x * .35, -z - .12], [x * .35, -z + .03], [x - .4, -z],
        [x + .07, -z + .7], [x - .02, .1], [x + .12, z - .6], [x - .5, z + .04],
        [x * .25, z - .02], [-x * .35, z + .17], [-x + .45, z], [-x - .08, z - .6],
        [-x - .04, -.5], [-x + .01, -z + .55],
    ].map(([a, b]) => new T.Vector3(a, b, 0)), true);
    return new T.Shape(curve.getPoints(96).map(p => new T.Vector2(p.x, p.y)));
}

export function buildLandscape(state: LifeState, width: number, point: (c: Cell) => T.Vector3) {
    const root = new T.Group(); root.name = 'life-landscape';
    const materials = new Map<string, T.MeshStandardMaterial>();
    const paint = (color: string, roughness = .95) => {
        const key = `${color}:${roughness}`;
        if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness }));
        return materials.get(key)!;
    };
    const land = (w: number, d: number, y: number, h: number, color: string) => {
        const geometry = new T.ExtrudeGeometry(coastShape(w, d), { depth: h, bevelEnabled: true, bevelThickness: .055, bevelSize: .075, bevelSegments: 3, steps: 1 });
        geometry.rotateX(-Math.PI / 2);
        const mesh = new T.Mesh(geometry, paint(color)); mesh.position.y = y;
        mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    land(width + 1.7, 6.35, -.43, .23, '#9d8cb8');
    land(width + 1.95, 6.65, -.24, .15, '#ead7a8');
    const grass = land(width + 1.4, 5.65, -.16, .15, '#63cbb0');
    const grassSurface = createIslandGrassSurface(grass.material, 'legacy-v1:moon-garden:ground');
    if (grassSurface) grass.material = grassSurface.material;

    // A broad, quiet water plane with a shallow shelf and low-contrast current.
    // It carries no hit targets and never changes simulation time or growth.
    const water = new T.ShaderMaterial({
        uniforms: { time: { value: 0 }, halfLand: { value: new T.Vector2((width + 1.9) / 2, 3.35) },
            deep: { value: new T.Color('#355fc4') }, shallow: { value: new T.Color('#8bdbdd') } },
        vertexShader: 'varying vec2 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}',
        fragmentShader: `uniform float time; uniform vec2 halfLand; uniform vec3 deep; uniform vec3 shallow; varying vec2 vWorld;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
            vec2 q=abs(vWorld)-halfLand+vec2(.7);
            float edge=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.7;
            float shelf=1.0-smoothstep(.0,2.2,edge);
            vec3 color=mix(deep,shallow,shelf*.92);
            float ripple=sin(vWorld.y*6.0+noise(vWorld*.85)*5.0+time*.18);
            float threads=smoothstep(.93,1.0,ripple)*smoothstep(.3,.8,noise(vWorld*1.4))*(.035+shelf*.025);
            color+=vec3(threads);
            gl_FragColor=vec4(color,1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
        }`,
    });
    const sea = new T.Mesh(new T.PlaneGeometry(120, 120), water); sea.rotation.x = -Math.PI / 2; sea.position.y = -.46; sea.name = 'life-sea'; root.add(sea);

    const edge = new T.Group(); edge.name = 'life-coast-plants'; root.add(edge);
    // Only low shoreline growth: the playable cell centers and approaches stay open.
    for (const side of [-1, 1]) for (let j = 0; j < 7; j++) {
        if ((j + side) % 3 === 0) continue;
        const x = side * (width / 2 + .48 + Math.sin(j * 2.1) * .08), z = -2.6 + j * .83;
        const stone = new T.Mesh(new T.IcosahedronGeometry(1, 0), paint(j % 2 ? '#a88bbc' : '#c9acd8'));
        stone.position.set(x + side * .22, -.18, z);
        stone.scale.set(.22 + (j % 3) * .065, .19, .24);
        stone.castShadow = stone.receiveShadow = true; edge.add(stone);
        stone.rotation.y = j * .7;
        if (j % 3 !== 1) for (let k = 0; k < 4; k++) {
            const leaf = ellipsoid(edge, paint(k % 2 ? '#359c86' : '#72caa2'), [x + Math.sin(k * 2.3) * .12, .05 + k * .015, z + .17 + Math.cos(k * 2.3) * .10], [.075, .16, .035], 9);
            leaf.rotation.z = Math.sin(k * 2.3) * .65; leaf.rotation.x = Math.cos(k * 2.3) * .45;
        }
    }
    // Back edge gives the house a setting; the front edge remains low and clear.
    for (let j = 0; j < width + 1; j++) {
        if (j % 4 === 2 || j % 4 === 3) continue;
        const x = j - width / 2 + .2, z = -2.9 - Math.sin(j * 1.7) * .05;
        for (let k = 0; k < 3; k++) {
            const leaf = ellipsoid(edge, paint(k % 2 ? '#9162c0' : '#d176cf'), [x + k * .11, .10, z], [.16, .20 + k * .02, .09], 9);
            leaf.rotation.z = (k - 1) * .55;
        }
        if (j % 2 === 0) ellipsoid(edge, paint('#d5c7ab'), [x, -.14, 3.02], [.15, .07, .10], 9);
    }
    batch(edge);

    const beds = new T.Group(); beds.name = 'life-district-ground'; root.add(beds);
    const plot = (x: number, z: number, w: number, d: number, color: string) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, .015, d), paint(color)); mesh.position.set(x, .057, z); mesh.receiveShadow = true; beds.add(mesh);
    };
    for (const district of districts(state)) {
        const cells = new Set(district.cells.map(cellKey));
        const soil = district.kind === 'flowers' ? '#b8a077' : '#cbd09a';
        for (const c of district.cells) {
            const p = point(c); plot(p.x, p.z, .94, .94, soil);
            // Join only cardinal neighbors. A hole in an L-shaped garden remains grass.
            for (const [dx, dz] of [[1, 0], [0, 1]]) if (cells.has(cellKey({ x: c.x + dx, z: c.z + dz }))) plot(p.x + dx * .5, p.z + dz * .5, dx ? .12 : .94, dz ? .12 : .94, soil);
            if (district.kind === 'flowers') for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (cells.has(cellKey({ x: c.x + dx, z: c.z + dz }))) continue;
                for (let j = 0; j < 3; j++) {
                    const offset = (j - 1) * .30;
                    ellipsoid(beds, paint(j % 2 ? '#c6b89c' : '#e1ceaa'), [p.x + dx * .43 + dz * offset, .076, p.z + dz * .43 + dx * offset], [dx ? .05 : .14, .035, dz ? .05 : .14], 8);
                }
            }
        }
    }
    batch(beds);

    // Flat stepping stones borrow the old garden's path without reserving cells.
    // An owned item always wins over decoration, including after a move/reload.
    const occupied = new Set(state.items.filter(item => item.cell).map(item => cellKey(item.cell!)));
    const path = new T.Group(); path.name = 'life-doorstep-path'; root.add(path);
    for (let z = 1; z <= 4; z++) {
        const cell = { x: 2, z };
        if (occupied.has(cellKey(cell)) || isHouse(cell)) continue;
        const p = point(cell);
        for (let step = 0; step < 2; step++) {
            const stone = new T.Mesh(new T.CylinderGeometry(.21, .23, .018, 5), paint('#f3dda2'));
            stone.position.set(p.x + .26 + Math.sin(z * 3 + step) * .06, .052, p.z - .25 + step * .44);
            stone.rotation.y = z * .7 + step; stone.scale.z = .72; stone.receiveShadow = true;
            path.add(stone);
        }
    }
    return { root, animate: (at: number, reduced: boolean) => { water.uniforms.time.value = reduced ? 0 : at / 1000 % (Math.PI * 100); },
        dispose: () => { materials.forEach(m => m.dispose()); grassSurface?.dispose(); water.dispose(); } };
}
