import * as T from 'three';
import { cylinder, ellipsoid, type IslandMaterials } from '../three/primitives';
import type { Style } from '../../../domain/islandLife/model';
export interface SandScene { mountain: T.Group; castle: T.Group }
export function buildSandbox(materials: IslandMaterials, style: Style) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .9);
    const box = (parent: T.Group, color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    };
    const edge = style === 'starlight' ? '#afa2c8' : style === 'sunshine' ? '#e4b967' : '#8bc5b4';
    box(root, '#ead3a0', 0, .045, 0, .88, .07, .88);
    for (const side of [-1, 1]) { box(root, edge, side * .45, .09, 0, .07, .15, .97); box(root, edge, 0, .09, side * .45, .84, .15, .07); }
    const mountain = new T.Group(); mountain.name = 'life-sand-mountain'; mountain.position.y = .08; root.add(mountain);
    ellipsoid(mountain, paint('#d5b67b'), [0, .03, 0], [.27, .25, .25], 20);
    const castle = new T.Group(); castle.name = 'life-sand-castle'; castle.position.y = .08; root.add(castle);
    box(castle, '#d7b679', 0, .10, 0, .37, .20, .29);
    for (const x of [-.19, .19]) for (const z of [-.15, .15]) {
        cylinder(castle, paint('#e6c891'), [x, .16, z], .085, .32);
        for (const dx of [-.038, .038]) box(castle, '#e6c891', x + dx, .33, z, .03, .045, .07);
    }
    box(castle, '#af8957', 0, .065, .148, .085, .13, .008);
    mountain.visible = castle.visible = false;
    return { root, sandbox: { mountain, castle } };
}
