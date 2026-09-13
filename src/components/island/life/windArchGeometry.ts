import * as T from 'three';
import { cylinder, ellipsoid, type IslandMaterials } from '../three/primitives';
import type { Style } from '../../../domain/islandLife/model';

export function buildWindArch(kind: 'pinwheel' | 'flower-arch', materials: IslandMaterials, style: Style) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .75);
    if (kind === 'pinwheel') {
        cylinder(root, paint('#b78e59'), [0, .56, 0], .026, 1.12);
        const rotor = new T.Group(); rotor.name = 'life-pinwheel-rotor'; rotor.position.set(0, 1.15, .025); root.add(rotor);
        const colors = style === 'starlight' ? ['#777cb5', '#a69dce', '#75bdc6', '#e6d29b'] : ['#f1ce59', '#ea8fa0', '#55b9b5', '#558fcc'];
        for (let i = 0; i < 4; i++) {
            const shape = new T.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(.10, .10, .30, .04); shape.quadraticCurveTo(.38, .18, .12, .31); shape.quadraticCurveTo(.03, .14, 0, 0);
            const blade = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: .017, bevelEnabled: false, curveSegments: 12 }), paint(colors[i]));
            blade.rotation.z = i * Math.PI / 2; blade.castShadow = true; rotor.add(blade);
        }
        ellipsoid(rotor, paint('#f9df85'), [0, 0, .04], [.047, .047, .04], 12);
        return { root, rotor };
    }
    // Diagonal corner posts leave all four cardinal walking lines open.
    const curve = new T.CatmullRomCurve3([new T.Vector3(-.43, 0, -.43), new T.Vector3(-.43, 1.30, -.43), new T.Vector3(-.28, 1.65, -.28), new T.Vector3(0, 1.83, 0), new T.Vector3(.28, 1.65, .28), new T.Vector3(.43, 1.30, .43), new T.Vector3(.43, 0, .43)]);
    const arch = new T.Mesh(new T.TubeGeometry(curve, 48, .033, 8, false), paint('#8baf81')); arch.castShadow = true; root.add(arch);
    for (const t of [.32, .41, .5, .59, .68]) {
        const p = curve.getPoint(t);
        for (let j = 0; j < 5; j++) {
            const a = j * Math.PI * 2 / 5;
            ellipsoid(root, paint(style === 'starlight' ? '#b5a0d3' : '#ef9dad'), [p.x + Math.cos(a) * .043, p.y + Math.sin(a) * .043, p.z + .014], [.04, .035, .026], 10);
        }
        ellipsoid(root, paint('#f4d677'), [p.x, p.y, p.z + .035], [.027, .027, .018], 10);
    }
    return { root, rotor: undefined };
}
