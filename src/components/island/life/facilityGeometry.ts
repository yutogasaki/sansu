import * as T from 'three';
import { cylinder, type IslandMaterials } from '../three/primitives';
import type { Style } from '../../../domain/islandLife/model';
export function buildFacility(kind: 'library' | 'garden-hut', materials: IslandMaterials, style: Style) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .8);
    const box = (color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    box(kind === 'library' ? '#f3dfb4' : '#b8d7b1', .5, .57, .5, 1.72, 1.14, 1.68);
    const colors = style === 'starlight' ? ['#a398bf','#709fc0','#d6be8f'] : ['#e9be59','#dc879e','#469dbe'];
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
        const tile = box(colors[(row + (side > 0 ? 1 : 0)) % 3], .5 + side * .43, 1.23, -.17 + row * .44, 1.02, .10, .42);
        tile.rotation.z = side * -.36;
    }
    // Door and entrance share the saved anchor's x coordinate; the second
    // front cell holds a window, never a second activity slot.
    box('#a37650', 0, .48, 1.351, .48, .95, .045);
    box('#f5e9c9', 0, .08, 1.43, .60, .12, .12);
    cylinder(root, paint('#f1ce63'), [.16,.48,1.39], .028, .025).rotation.x = Math.PI / 2;
    box('#f4e5bf', .91, .69, 1.355, .52, .52, .045);
    box('#77b9c3', .91, .69, 1.384, .41, .41, .025);
    box('#f4e5bf', .91, .69, 1.406, .025, .43, .015);
    if (kind === 'library') {
        for (const side of [-1,1]) { const page = box('#fff1d1', side*.09, 1.01, 1.39, .17,.12,.025); page.rotation.z=side*.12; }
    } else {
        box('#a57850', .92,.22,1.41,.55,.06,.10);
        for (const x of [.80,1.04]) { cylinder(root,paint('#b28352'),[x,.38,1.42],.02,.30); box('#7ba097',x,.55,1.42,.09,.10,.03); }
    }
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
