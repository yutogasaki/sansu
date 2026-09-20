import * as T from 'three';
import { batch, cylinder, ellipsoid, type IslandMaterials } from '../three/primitives';

/** Cheap, recognizable fallback and placement ghost; bounds fit the shared one-cell clearance. */
export function buildDecoration(kind: 'fence' | 'planter', materials: IslandMaterials) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .8);
    if (kind === 'fence') {
        const box = (x: number, y: number, w: number, h: number, d: number, color: string) => {
            const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color)); mesh.position.set(x, y, 0);
            mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
        };
        for (const x of [-.34, .34]) { box(x, .26, .14, .52, .15, '#b8864e'); box(x, .53, .16, .05, .17, '#694325'); }
        for (const y of [.16, .38]) box(0, y, .8, .075, .09, '#b8864e');
    } else {
        const pot = new T.Mesh(new T.CylinderGeometry(.29, .23, .32, 16), paint('#b45e3f'));
        pot.position.y = .16; pot.castShadow = pot.receiveShadow = true; root.add(pot);
        for (const [x,z,h] of [[-.12,-.09,.52],[.12,-.08,.62],[0,.10,.56]]) {
            cylinder(root,paint('#477b40'),[x,(h+.32)/2,z],.018,h-.32);
            ellipsoid(root,paint('#529047'),[x,.42,z],[.13,.08,.12],8);
            for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipsoid(root,paint('#eaca6a'),[x+Math.cos(a)*.065,h,z+Math.sin(a)*.065],[.06,.025,.065],8);}
            ellipsoid(root,paint('#997135'),[x,h+.025,z],[.035,.018,.035],8);
        }
    }
    batch(root); return root;
}
