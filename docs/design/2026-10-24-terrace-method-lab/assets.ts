import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Owned-item and decor templates are cut from the adopted native05 GLB itself:
// the same meshes and materials the art target was rendered with. Nothing here
// is redrawn; only grouped, re-origined and merged per material.
export type Template = { root: T.Group; size: T.Vector3 };
export type Kit = Record<string, Template> & { _species: string[]; _houses: string[] };

const HOUSES = ['Original home', 'Forest / blue home', 'Forest / yellow home', 'Garden / small home', 'Harbor / coral porch home',
    'Harbor / corner blue home', 'Hill / rose terrace home', 'Hill / upper yellow home', 'Village / coral house',
    'Water town / blue home', 'Water town / coral home', 'Hill / blue terrace home'];

type Part = { mesh: T.Mesh; name: string; center: T.Vector3; box: T.Box3 };

function cluster(parts: Part[], link: number) {
    const groups: Part[][] = [], seen = new Set<Part>();
    for (const start of parts) {
        if (seen.has(start)) continue;
        const group = [start]; seen.add(start);
        for (let i = 0; i < group.length; i++) for (const other of parts) {
            if (seen.has(other)) continue;
            const a = group[i].center, b = other.center;
            if (Math.hypot(a.x - b.x, a.z - b.z) < link) { seen.add(other); group.push(other); }
        }
        groups.push(group);
    }
    return groups;
}

function build(name: string, parts: Part[], options: { faceDoor?: boolean; scale?: number; merge?: boolean } = {}): Template {
    const box = new T.Box3(); for (const p of parts) box.union(p.box);
    const origin = new T.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    let angle = 0;
    if (options.faceDoor) {
        const door = parts.find(p => /cobalt entry|doorway/.test(p.name));
        if (door) angle = Math.atan2(door.center.x - origin.x, door.center.z - origin.z);
    }
    const transform = new T.Matrix4().makeRotationY(-angle).multiply(new T.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
    if (options.scale) transform.premultiply(new T.Matrix4().makeScale(options.scale, options.scale, options.scale));
    const root = new T.Group(); root.name = name;
    const buckets = new Map<T.Material, T.BufferGeometry[]>();
    for (const p of parts) {
        const material = p.mesh.material as T.Material;
        const geometry = p.mesh.geometry.clone().applyMatrix4(p.mesh.matrixWorld).applyMatrix4(transform);
        if (options.merge === false || (material as T.MeshStandardMaterial).map) {
            const mesh = new T.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); continue;
        }
        for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'color'].includes(key)) geometry.deleteAttribute(key);
        (buckets.get(material) ?? buckets.set(material, []).get(material)!).push(geometry.index ? geometry.toNonIndexed() : geometry);
    }
    for (const [material, list] of buckets) {
        const withColor = list.filter(g => g.getAttribute('color')), plain = list.filter(g => !g.getAttribute('color'));
        for (const set of [withColor, plain]) {
            if (!set.length) continue;
            const itemSize = set[0].getAttribute('color')?.itemSize;
            const same = set.filter(g => g.getAttribute('color')?.itemSize === itemSize);
            const merged = mergeGeometries(same, false);
            if (!merged) throw Error(`merge failed ${name}`);
            const mesh = new T.Mesh(merged, material); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
        }
    }
    const size = new T.Box3().setFromObject(root).getSize(new T.Vector3());
    return { root, size };
}

export async function loadKit(url: string): Promise<Kit> {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const parts: Part[] = [];
    // GLTFLoader sanitizes names ("a / b" -> "a__b"); read the authored node name back.
    const json = gltf.parser.json as { nodes: { name?: string }[] };
    const original = (object: T.Object3D | null): string => {
        for (let o = object; o; o = o.parent) {
            const index = gltf.parser.associations.get(o)?.nodes;
            if (index !== undefined) return json.nodes[index].name ?? '';
        }
        return '';
    };
    gltf.scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const box = new T.Box3().setFromObject(object);
        parts.push({ mesh: object, name: original(object), box, center: box.getCenter(new T.Vector3()) });
    });
    (globalThis as any).__parts = parts.map(p => ({ name: p.name, c: p.center.toArray().map(v => +v.toFixed(2)), s: p.box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2)) }));
    const kit = {} as Kit;
    const named = (prefix: string) => parts.filter(p => p.name === prefix || p.name.startsWith(prefix + ' /') || p.name.startsWith(prefix + '/'));
    kit._houses = [];
    for (const house of HOUSES) {
        const list = named(house);
        if (!list.length) continue;
        // Joined/long homes are left out: one owned home is one footprint.
        const id = 'house:' + house; kit[id] = build(id, list, { faceDoor: true }); kit._houses.push(id);
    }
    kit._species = [];
    for (let k = 1; k <= 4; k++) {
        const list = [...named(`Grove / living willow ${k}`), ...named(`Grove tree ${k}`)];
        if (list.length) { const id = `tree:willow:${k - 1}`; kit[id] = build(id, list); kit._species.push(id); }
    }
    const trees: [string, RegExp, number][] = [['birch', /^Grove \/ silver birch/, .5], ['spire', /^Grove \/ spire tree/, .5], ['orchard', /^Orchard \/ grown tree/, .6]];
    for (const [species, test, link] of trees) {
        const groups = cluster(parts.filter(p => test.test(p.name)), link)
            .map(g => ({ g, box: g.reduce((b, p) => b.union(p.box), new T.Box3()) }))
            .filter(({ box }) => { const s = box.getSize(new T.Vector3()); return s.x < 3.6 && s.z < 3.6 && s.y > 1.2; })
            .sort((a, b) => b.g.length - a.g.length);
        groups.slice(0, 3).forEach(({ g }, i) => { const id = `tree:${species}:${i}`; kit[id] = build(id, g); kit._species.push(id); });
    }
    for (let n = 0; n < 12; n++) {
        const list = named(`Orchard / grown tree ${n}`);
        if (list.length) { const id = `orchard:${n}`; kit[id] = build(id, list); }
    }
    const trunks = [1, 2, 3, 4, 5].flatMap(k => named(`Flower tree ${k}`));
    if (trunks.length) {
        const c = trunks.reduce((b, p) => b.union(p.box), new T.Box3()).getCenter(new T.Vector3());
        const crown = parts.filter(p => /^Flowers \/ (shared giant petal canopy|scalloped upper petal|small peripheral bloom|supporting grown branch|joined|canopy-reaching stem|broad growing leaf)/.test(p.name)
            && Math.hypot(p.center.x - c.x, p.center.z - c.z) < 4.5);
        kit['canopy'] = build('canopy', [...trunks, ...crown]);
    }
    const trunk = named('Grove / great root house trunk')[0];
    if (trunk) {
        const c = trunk.center, skip = /willow|birch|spire|terrace|route|spring stair|staircase|meadow|fern|broad leaf/;
        const big = parts.filter(p => p.name.startsWith('Grove /') && !skip.test(p.name) && Math.hypot(p.center.x - c.x, p.center.z - c.z) < 4.2);
        kit['bigtree'] = build('bigtree', big);
    }
    const bridge = named('Inlet / neighborhood bridge');
    // Authored along local x; the lab stretches it between the two meadow cells.
    if (bridge.length) kit['bridge'] = build('bridge', bridge);
    const resident = named('Original Pokomoko');
    if (resident.length) kit['resident'] = build('resident', resident, { merge: false });
    const benchSeat = parts.find(p => p.name === 'Harbor / shell interior bench');
    if (benchSeat) {
        const near = parts.filter(p => /^Harbor \/ shell interior bench/.test(p.name) && p.center.distanceTo(benchSeat.center) < 1.2);
        kit['bench'] = build('bench', near);
    }
    const decor: [string, RegExp, number, number][] = [['fern', /^Ground \/ (grown fern patch|riverbank fern)/, .5, 6],
        ['wildflower', /^Garden \/ riverbank wildflower/, .35, 6], ['flowers', /^Flowers \/ grown habitat flowers/, .45, 4],
        ['rock', /^Coast \/ softened rock/, .5, 4], ['leaf', /^Ground \/ grouped broad leaf/, .45, 3]];
    for (const [id, test, link, count] of decor) {
        const groups = cluster(parts.filter(p => test.test(p.name)), link).filter(g => g.length > 1 || id === 'rock')
            .map(g => ({ g, box: g.reduce((b, p) => b.union(p.box), new T.Box3()) }))
            .filter(({ box }) => { const s = box.getSize(new T.Vector3()); return s.x < 2.2 && s.z < 2.2; })
            .sort((a, b) => b.g.length - a.g.length).slice(0, count);
        groups.forEach(({ g }, i) => { kit[`${id}:${i}`] = build(`${id}:${i}`, g); });
    }
    return kit;
}

export function instance(template: Template) {
    const root = template.root.clone(true);
    return root;
}
