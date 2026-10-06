import * as T from 'three';
import { batch, curve, mesh, type IslandMaterials } from '../three/primitives';
import { leafGeometry } from '../three/garden/geometry';
import { growthStage } from '../../../domain/islandLife/model';

export type TreeForm = 'spread' | 'spire' | 'branch';
/** Cosmetic identity follows the saved tree, never its current cell or a random draw. */
export function treeForm(id: string): TreeForm {
    let hash = 2166136261;
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return (['spread', 'spire', 'branch'] as const)[hash % 3];
}

export function buildGrowingTree(m: IslandMaterials, id: string, growth: number) {
    const root = new T.Group(), form = treeForm(id), stage = growthStage({ kind: 'sapling', growth });
    root.name = 'growing-tree-' + form; root.userData.treeForm = form;
    const wood = m.surface('#98724d', .85), leaf = leafGeometry();
    const greens = ['#66865c', '#81995e'];
    const foliage = (at: [number, number, number], scale: number, angle: number, tint = 0) => {
        const blade = mesh(root, leaf.clone(), m.surface(greens[tint], .85), at);
        blade.scale.setScalar(scale); blade.rotation.y = angle; blade.rotation.x = form==='branch'?-.72:-.24;
    };
    if (stage < 2) {
        const height = stage ? .50 : .22;
        curve(root, wood, [[0, 0, 0], [.025, height * .6, 0], [0, height, 0]], stage ? .035 : .02);
        for (let i = 0; i < (stage ? 4 : 2); i++) foliage([0, height - i * .055, 0], stage ? .34 : .20, i * 2.4, i % 2);
    } else if (form === 'spread') {
        curve(root, wood, [[0, 0, 0], [.045, .40, 0], [-.04, .72, 0]], .057);
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + .25, x = Math.cos(a) * .28, z = Math.sin(a) * .28;
            curve(root, wood, [[.02, .37, 0], [x * .55, .62, z * .55], [x, .75, z]], .028);
            foliage([x*.5,.78,z*.5],.30,a,1);
        }
        const profile=[[0,.66],[.21,.67],[.37,.72],[.43,.78],[.35,.88],[.16,.98],[0,1.01]];
        const crown=new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),18);
        const points=crown.getAttribute('position');for(let i=0;i<points.count;i++){const a=Math.atan2(points.getZ(i),points.getX(i)),r=1+Math.sin(a*3)*.06;points.setX(i,points.getX(i)*r);points.setZ(i,points.getZ(i)*r);}
        crown.computeVertexNormals();mesh(root,crown,m.surface(greens[0],.85));
    } else if (form === 'spire') {
        curve(root, wood, [[0, 0, 0], [-.025, .52, 0], [.025, 1.1, 0]], .047);
        const profile = [[.025,.49],[.12,.57],[.20,.80],[.18,1.02],[.12,1.22],[.03,1.39],[0,1.43]];
        mesh(root, new T.LatheGeometry(profile.map(([x,y]) => new T.Vector2(x,y)), 14), m.surface(greens[0], .85));
        for(let i=0;i<4;i++) foliage([0,.60+i*.13,0], .22, i*2.4, 1);
    } else {
        curve(root, wood, [[0,0,0],[.04,.43,0],[-.025,.87,.03],[.01,1.13,0]], .047);
        const tips: [number,number,number][] = [[-.27,.72,-.10],[.24,.94,.10],[.01,1.15,0]];
        tips.forEach(([x,y,z],i)=>{
            curve(root,wood,[[.01,y*.5,0],[x*.65,y-.10,z*.65],[x,y,z]],.026);
            for(let j=0;j<3;j++)foliage([x,y,z],.32,i*2+j*2.1,j%2);
        });
    }
    leaf.dispose(); batch(root, m.painted);
    // Bake the narrow crown into owned geometry: ageTree may later change root.scale.
    if(form==='branch') root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.scale(.80,1,.80);});
    root.userData.visualCandidate = 'growing-tree-silhouettes-v1';
    return root;
}
