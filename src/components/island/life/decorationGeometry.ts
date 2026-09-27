import * as T from 'three';
import { batch, cylinder, ellipsoid, type IslandMaterials } from '../three/primitives';

/** Cheap, recognizable fallback and placement ghost; bounds fit the shared one-cell clearance. */
export function buildDecoration(kind: 'fence' | 'planter' | 'water-channel', materials: IslandMaterials, foodStage?: 0 | 1 | 2, waterFlow = false, waterConnections = 15) {
    const root = new T.Group(), paint = (color: string) => materials.surface(color, .8);
    if (kind === 'planter' && foodStage !== undefined) root.userData.foodStage = foodStage;
    if (kind === 'water-channel') {
        const strip = (width: number, depth: number, color: string, y: number, x = 0, z = 0) => {
            const mesh = new T.Mesh(new T.BoxGeometry(width, .025, depth), paint(color));
            mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh); return mesh;
        };
        const color = waterFlow ? '#36b7d2' : '#b58b5d';
        strip(.28, .28, '#b99366', .014);
        strip(.20, .20, color, .09);
        for (const [bit, x, z, width, depth, wetWidth, wetDepth] of [
            [1, 0, -.25, .27, .5, .19, .5], [2, .25, 0, .5, .27, .5, .19],
            [4, 0, .25, .27, .5, .19, .5], [8, -.25, 0, .5, .27, .5, .19],
        ]) if (waterConnections & bit) {
            strip(width, depth, '#b99366', .014, x, z);
            strip(wetWidth, wetDepth, color, .09, x, z);
        }
        root.userData.waterFlow = waterFlow;
        root.userData.waterConnections = waterConnections;
    } else if (kind === 'fence') {
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
            const height = foodStage === 0 ? .41 : foodStage === 1 ? h * .85 : h;
            cylinder(root,paint('#477b40'),[x,(height+.32)/2,z],.018,height-.32);
            ellipsoid(root,paint('#529047'),[x,.40,z],[foodStage === 0 ? .08 : .13,.08,.12],8);
            if (foodStage === undefined) {
                for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipsoid(root,paint('#eaca6a'),[x+Math.cos(a)*.065,h,z+Math.sin(a)*.065],[.06,.025,.065],8);}
                ellipsoid(root,paint('#997135'),[x,h+.025,z],[.035,.018,.035],8);
            } else if (foodStage === 2) {
                for(let i=0;i<3;i++){const a=i*Math.PI*2/3;ellipsoid(root,paint('#db9a51'),[x+Math.cos(a)*.09,height,z+Math.sin(a)*.09],[.055,.055,.055],8);}
            }
        }
    }
    batch(root); return root;
}
