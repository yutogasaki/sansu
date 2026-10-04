import * as T from 'three';
import { GardenGeometry } from './geometry';
import { gardenGlow } from './glow';
import type { GardenTime } from './presentation';

/** Same walk-up anchor and scale as the legacy home; only the art changes. */
export function buildGardenCottage() {
    const g = new GardenGeometry(), root = g.root; root.name = 'home';
    const glow = gardenGlow();
    const body = new T.Group(); body.position.z = -.47; root.add(body);
    g.box('#d5c4a4', [0, .10, 0], [2.06, .22, 1.86], body, .12);
    g.box('#f0e4c6', [0, .85, 0], [1.90, 1.6, 1.65], body, .18);
    const gable = new T.Shape(); gable.moveTo(-.94,1.5); gable.quadraticCurveTo(-.72,2.1,-.20,2.36);
    gable.quadraticCurveTo(.40,2.10,.94,1.5); gable.closePath();
    g.mesh(new T.ExtrudeGeometry(gable,{depth:1.65,bevelEnabled:false}),g.paint('#f0e4c6'),[0,0,-.825],body);
    // The swept roof has a low eave and a gently curled, asymmetric peak.
    const profile = new T.Shape(); profile.moveTo(-1.27, 1.49);
    profile.bezierCurveTo(-.90, 1.48, -.88, 2.34, -.20, 2.52);
    profile.bezierCurveTo(.47, 2.33, .63, 1.55, 1.28, 1.54);
    profile.lineTo(1.28, 1.40); profile.bezierCurveTo(.49, 1.40, .37, 2.17, -.20, 2.34);
    profile.bezierCurveTo(-.73, 2.12, -.72, 1.34, -1.27, 1.36); profile.closePath();
    const roof = g.mesh(new T.ExtrudeGeometry(profile, { depth: 2.12, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 2, steps: 1 }), g.paint('#a2644e'), [0, 0, -1.06], body);
    roof.name = 'garden-curved-roof';
    // Soft clay tiles follow the original curled roof; one warm palette, no extra lights/textures.
    const slopes = [
        new T.CubicBezierCurve(new T.Vector2(-1.27,1.49),new T.Vector2(-.90,1.48),new T.Vector2(-.88,2.34),new T.Vector2(-.20,2.52)),
        new T.CubicBezierCurve(new T.Vector2(-.20,2.52),new T.Vector2(.47,2.33),new T.Vector2(.63,1.55),new T.Vector2(1.28,1.54)),
    ];
    slopes.forEach((slope,side)=>{for(let row=0;row<4;row++)for(let column=0;column<6;column++){
        const points=[0,.5,1].map(t=>slope.getPoint((row+t*.97)/4));
        const tile=new T.Shape();tile.moveTo(points[0].x,points[0].y+.08);
        for(const point of points.slice(1))tile.lineTo(point.x,point.y+.08);
        for(const point of [...points].reverse())tile.lineTo(point.x,point.y+.025);
        tile.closePath();
        g.mesh(new T.ExtrudeGeometry(tile,{depth:.32,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,steps:1}),
            g.paint(['#ad7254','#b17a59','#a66b50'][(row+column+side)%3]),[0,0,-1.065+column*.355],body);
    }});
    g.box('#b6a68b', [.68, 2.22, -.49], [.30, .84, .35], body);
    g.box('#d6c6a6', [.68, 2.65, -.49], [.43, .11, .47], body);
    // A single open-bottom arch keeps the wooden leaf recessed and visible.
    const surround=new T.Shape();surround.moveTo(-.43,0);surround.lineTo(-.43,.76);
    surround.absarc(0,.76,.43,Math.PI,0,true);surround.lineTo(.43,0);
    surround.lineTo(.35,0);surround.lineTo(.35,.75);surround.absarc(0,.75,.35,0,Math.PI,false);
    surround.lineTo(-.35,0);surround.closePath();
    g.mesh(new T.ExtrudeGeometry(surround,{depth:.11,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:1}),g.paint('#c9af80'),[-.24,.10,.87],body);
    const door = new T.Shape(); door.moveTo(-.34, 0); door.lineTo(.34, 0); door.lineTo(.34, .75);
    door.absarc(0, .75, .34, 0, Math.PI, false); door.closePath();
    g.mesh(new T.ExtrudeGeometry(door, { depth: .06, bevelEnabled: true, bevelThickness: .02, bevelSize: .025, bevelSegments: 2 }), g.paint('#865a3f'), [-.24,.10,.84], body);
    for (const x of [-.47,-.25,-.03]) g.box('#ae8054',[x,.54,.915],[.012,.77,.014],body,.002);
    g.pebble('#dcba6c',[-.02,.58,.943],[.035,.035,.023],body);
    const window = (x: number, y: number, z: number, radius: number) => {
        g.mesh(new T.CylinderGeometry(radius,radius,.065,24),g.paint('#795b3d'),[x,y,z],body).rotation.x=Math.PI/2;
        g.mesh(new T.TorusGeometry(radius*.90,radius*.13,6,24),g.paint('#c9af80'),[x,y,z+.055],body);
        g.mesh(new T.CircleGeometry(radius*.77,24),g.paint('#f6ca80',.65,1.5),[x,y,z+.04],body);
        g.box('#997544',[x,y,z+.07],[radius*1.64,.045,.065],body);
        g.box('#997544',[x,y,z+.07],[.045,radius*1.64,.065],body);
        const halo=glow.sprite(radius*5);halo.position.set(x,y,z+.065);body.add(halo);
    };
    window(.60,.94,.855,.25); window(-.20,1.86,.84,.24);
    g.box('#93744d',[.59,.62,.92],[.67,.17,.26],body);
    for (let i=0;i<7;i++) {
        g.pebble(i%2?'#7e9d5c':'#597c4b',[.32+i*.09,.75,.99],[.11,.11,.12],body);
        if(i%2===0) g.pebble('#e5cf98',[.32+i*.09,.84,1.03],[.047,.046,.034],body);
    }
    for (let i=0;i<3;i++) g.box('#cbbb98',[-.23,.065-i*.035,1.0+i*.15],[.84,.12,.30],body);
    // The lantern's light is in the material; no expensive per-prop shadow light.
    g.branch([[-.88,1.24,.83],[-.88,1.35,1.02],[-.88,1.24,1.1]],.022,'#684d37',body);
    g.box('#745237',[-.88,1.06,1.08],[.20,.29,.18],body);
    g.mesh(new T.BoxGeometry(.14,.21,.13),g.paint('#f4ce84',.5,.8),[-.88,1.06,1.11],body);
    for (let i=0;i<15;i++) {
        const y=.25+i*.074;
        g.pebble(i%3?'#6d874d':'#83985b',[-.91+Math.sin(i*.8)*.07,y,.87],[.07,.11,.033],body);
    }
    lowerCottageRoof(body);
    g.batch(body); root.userData.visualSource = 'living-fantasy-cottage-low-v3';
    return { root, setTime(time:GardenTime){glow.material.opacity=(time==='day'||time==='morning')?.06:time==='dusk'?.38:.55;},dispose: () => {g.dispose();glow.dispose();} };
}

/** Lower only the upper house, before batching so selection bounds match the visible shape. */
export function lowerCottageRoof(body: T.Group) {
    const lower = (y:number) => y<=1.25?y:1.25+(y-1.25)*.65;
    for(const child of body.children){
        if(child instanceof T.Mesh){
            child.updateMatrix(); child.geometry.applyMatrix4(child.matrix);
            const points=child.geometry.getAttribute('position');
            for(let i=0;i<points.count;i++)points.setY(i,lower(points.getY(i)));
            child.geometry.computeVertexNormals();
            child.position.set(0,0,0);child.rotation.set(0,0,0);child.scale.setScalar(1);
        }else if(child instanceof T.Sprite){child.position.y=lower(child.position.y);if(child.position.y>1.25)child.scale.y*=.65;}
    }
}
