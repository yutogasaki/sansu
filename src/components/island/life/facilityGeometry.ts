import * as T from 'three';
import { cylinder, type IslandMaterials } from '../three/primitives';
import type { Style } from '../../../domain/islandLife/model';
export function buildFacility(kind: 'library' | 'garden-hut', materials: IslandMaterials, style: Style) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .8);
    const box = (color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    const colors = style === 'starlight' ? ['#a398bf','#709fc0','#d6be8f'] : ['#e9be59','#dc879e','#469dbe'];
    if (kind === 'library') {
        // A rounded reading room, with a barrel roof and books visible from outside.
        const wall = cylinder(root, paint('#f3dfb4'), [.5,.54,.48], .84, 1.08);
        wall.castShadow = wall.receiveShadow = true;
        const roofShape = new T.Shape();
        roofShape.moveTo(-.94,0);
        roofShape.absellipse(0,0,.94,.61,Math.PI,0,true,0);
        roofShape.lineTo(-.94,0);
        const roof = new T.Mesh(new T.ExtrudeGeometry(roofShape, { depth:1.8, bevelEnabled:false, curveSegments:24 }), paint(colors[2]));
        roof.position.set(.5,1.05,-.42); roof.castShadow = roof.receiveShadow = true; root.add(roof);
        // Broad curved roof bands, not repeated tiny ornament.
        for (let band=0; band<3; band++) {
            const shape = new T.Shape();
            shape.moveTo(-.955,0);
            shape.absellipse(0,0,.955,.625,Math.PI,0,true,0);
            shape.lineTo(-.955,0);
            const tile = new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.36,bevelEnabled:false,curveSegments:24}),paint(colors[band]));
            tile.position.set(.5,1.05,-.36+band*.60); tile.castShadow=true; root.add(tile);
        }
        box('#496b70',.94,.63,1.19,.60,.69,.12);
        for (const y of [.31,.64,.98]) box('#b1804c',.94,y,1.28,.68,.055,.22);
        for (let row=0; row<2; row++) for (let book=0; book<4; book++) {
            const volume=box(colors[(book+row)%3],.71+book*.15,.48+row*.33,1.29,.105,.24-(book%2)*.045,.13);
            volume.rotation.z=book===3 ? -.10 : 0;
        }
        const sign=buildHeldWork('library',materials); sign.name='life-library-sign'; sign.visible=true;
        sign.position.set(.02,1.26,1.41); sign.rotation.x=Math.PI/2; sign.scale.setScalar(1.45); root.add(sign);
    } else {
        // Open potting shed: low single slope, exposed frame and a working ledge.
        box('#97b8a0',.5,.48,-.25,1.64,.96,.12);
        box('#97b8a0',-.29,.48,.48,.12,.96,1.50);
        for (const x of [-.29,1.29]) for (const z of [-.25,1.23]) box('#a57850',x,.60,z,.11,1.20,.11);
        for (let row=0;row<4;row++) {
            const roof=box(colors[row%3],.5,1.29-row*.105,-.18+row*.43,1.92,.095,.46);
            roof.rotation.x=.24;
        }
        box('#567e70',.91,.51,.90,.64,.70,.53);
        box('#c89962',.91,.89,1.01,.80,.10,.67);
        for (const x of [.70,1.12]) {
            cylinder(root,paint('#c9815c'),[x,1.03,1.05],.10,.18);
            const leaf=new T.Mesh(new T.SphereGeometry(.13,12,8),paint('#72a36e'));
            leaf.scale.set(.75,1.4,.65); leaf.position.set(x,1.20,1.05); root.add(leaf);
        }
        for (const x of [.63,.96]) {
            box('#b78651',x,.53,1.30,.035,.38,.035);
            box('#719aa1',x,.30,1.30,.13,.14,.035);
        }
    }
    // Both retain the same entrance and saved footprint; walking has one front slot.
    box('#537777',0,.44,1.20,.48,.86,.045);
    box('#f5e9c9',0,.08,1.43,.60,.12,.12);
    return root;
}
/** Separate held objects; no resident mesh, fabric or proportions are replaced. */
export function buildHeldWork(kind: 'library' | 'garden-hut', materials: IslandMaterials, illustrated = false) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color,.8);
    if (kind === 'library') {
        for (const side of [-1,1]) {
            const page = new T.Mesh(new T.BoxGeometry(.22,.025,.24),paint('#fff0cb')); page.position.x=side*.108; page.rotation.z=side*.13; root.add(page);
            const cover = new T.Mesh(new T.BoxGeometry(.23,.018,.25),paint('#4e9ca7')); cover.position.set(side*.108,-.023,0); cover.rotation.z=side*.13; root.add(cover);
            if (illustrated) {
                const picture = new T.Group(); picture.name = side < 0 ? 'life-book-tree' : 'life-book-sun'; page.add(picture);
                const circle = new T.Mesh(new T.CircleGeometry(side < 0 ? .052 : .036, 20), paint(side < 0 ? '#377858' : '#e3ac43'));
                circle.rotation.x = -Math.PI / 2; circle.position.set(0, .014, side < 0 ? .029 : .062); picture.add(circle);
                if (side < 0) {
                    const trunk = new T.Mesh(new T.BoxGeometry(.016, .003, .075), paint('#8f6540'));
                    trunk.position.set(0, .014, -.043); picture.add(trunk);
                }
            }
        }
    } else {
        cylinder(root,paint('#79b8a8'),[0,0,0],.105,.16);
        const handle = new T.Mesh(new T.TorusGeometry(.105,.016,8,20),paint('#e3c88c')); handle.position.set(-.095,.015,0); root.add(handle);
        const spout = cylinder(root,paint('#79b8a8'),[.13,.025,0],.025,.13); spout.rotation.z=-.85;
    }
    root.name = kind === 'library' ? 'life-held-book' : 'life-held-tools'; root.visible=false; return root;
}
