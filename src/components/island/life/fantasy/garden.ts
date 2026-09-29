import * as T from 'three';
import { landBounds } from '../../../../domain/islandLife/landRules';
import type { Cell, LifeState } from '../../../../domain/islandLife/model';
import { GardenGeometry, leafGeometry, variation, type V3 } from './geometry';
import { FANTASY_CANDIDATE, type GardenTime } from './presentation';
import { gardenGlow } from './glow';
import { batch } from '../../three/primitives';
import { soilMoistureAt, soilWetness } from '../../../../domain/islandLife/soilMoisture';

/** Every owned cell remains level and playable; all big roots live outside it. */
export function gardenOutline(width: number, depth: number) {
    const a = width / 2, b = depth / 2;
    const curve = new T.CatmullRomCurve3([
        [-a-.25,0,-b+.55],[-a+.22,0,-b-.43],[-a*.18,0,-b-.60],[a*.65,0,-b-.48],
        [a+.27,0,-b+.23],[a+.63,0,b*.25],[a+.37,0,b-.10],[a-.55,0,b+.47],
        [a*.20,0,b+.22],[-a*.32,0,b+.54],[-a+.17,0,b+.35],[-a-.62,0,b*.23],
    ].map(p => new T.Vector3(...p as V3)), true);
    return new T.Shape(curve.getPoints(80).map(p => new T.Vector2(p.x,-p.z)));
}

/** What the garden ground needs to know: the owned rectangle and each cell's soil. */
export interface GardenGround { bounds: { minX: number; maxX: number; depth: number }; moisture: (cell: Cell) => number }

export function buildFantasyGarden(state: LifeState, point: (cell: Cell) => T.Vector3) {
    return buildGardenGround({ bounds: landBounds(state), moisture: cell => soilMoistureAt(state, cell) }, point);
}

export function buildGardenGround(ground: GardenGround, point: (cell: Cell) => T.Vector3) {
    const g = new GardenGeometry(), root=g.root; root.name='life-landscape';
    const glow=gardenGlow();
    root.userData.visualCandidate=FANTASY_CANDIDATE;
    const bounds=ground.bounds, width=bounds.maxX-bounds.minX+1, depth=bounds.depth;
    const centerZ=(depth-5)/2, west=-width/2-.65, north=-3.05;
    for(const [color,w,d,y,h] of [
        ['#84785c',width+1.40,depth+1.46,-.61,.29],
        ['#c3b48b',width+1.65,depth+1.67,-.36,.17],
        ['#8da66d',width+1.40,depth+1.43,-.29,.23],
    ] as const) {
        const geometry=new T.ExtrudeGeometry(gardenOutline(w,d),{depth:h,bevelEnabled:true,bevelSize:.12,bevelThickness:.08,bevelSegments:3,curveSegments:8,steps:1});
        geometry.rotateX(-Math.PI/2);
        const mesh=g.mesh(geometry,g.paint(color),[0,y,centerZ]); mesh.castShadow=false;
    }
    // Broad quiet ground color, with subtle world-space variation rather than a repeating carpet.
    const grass=root.children[root.children.length-1] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
    const soilPixels=new Uint8Array(width*depth*4);
    for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
        const index=(z*width+x)*4;
        soilPixels[index]=Math.round(255*soilWetness(ground.moisture({x:x+bounds.minX,z})));soilPixels[index+3]=255;
    }
    const soil=new T.DataTexture(soilPixels,width,depth,T.RGBAFormat);soil.magFilter=soil.minFilter=T.LinearFilter;soil.needsUpdate=true;
    root.userData.groundMaterialStatus='fantasy-soil-v1';
    grass.material.onBeforeCompile=shader=>{
        shader.uniforms.gardenSoil={value:soil};shader.uniforms.gardenSize={value:new T.Vector2(width,depth)};
        shader.vertexShader='varying vec3 gardenPoint;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n gardenPoint=position;');
        shader.fragmentShader='varying vec3 gardenPoint; uniform sampler2D gardenSoil; uniform vec2 gardenSize;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
            float meadow=sin(gardenPoint.x*1.15+sin(gardenPoint.z*.81))*sin(gardenPoint.z*1.31+gardenPoint.x*.21);
            float grain=fract(sin(dot(floor(gardenPoint.xz*95.),vec2(12.9898,78.233)))*43758.5453);
            float damp=texture2D(gardenSoil,clamp(gardenPoint.xz/gardenSize+.5,0.,1.)).r;
            diffuseColor.rgb*=(.95+.055*meadow+.022*grain)*mix(vec3(1.),vec3(.76,.88,.90),damp);`);
    };
    grass.material.customProgramCacheKey=()=> 'fantasy-ground-v1';
    const seaMaterial=new T.ShaderMaterial({
        uniforms:{at:{value:0},deep:{value:new T.Color('#427f80')},shallow:{value:new T.Color('#73a79b')}},
        vertexShader:'varying vec2 p; void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec2 p; uniform float at; uniform vec3 deep; uniform vec3 shallow;
            void main(){vec2 q=(p-.5)*40.;
            float waves=sin(q.x*2.7+q.y*1.4+at*.3)+sin(q.y*3.5-q.x*.7-at*.21);
            float shore=exp(-max(0.,length(q*vec2(.85,1.))-3.5)*.65);
            vec3 color=mix(deep,shallow,shore*.7+waves*.025);
            float glint=pow(max(0.,sin(q.x*4.1+sin(q.y*3.)+at*.24)*sin(q.y*4.8-at*.14)),18.);
            color+=vec3(.32,.34,.20)*glint*.21;
            gl_FragColor=vec4(color,1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            }`,
    });
    const sea=new T.Mesh(new T.PlaneGeometry(40,40),seaMaterial); sea.name='life-sea';
    sea.rotation.x=-Math.PI/2;sea.position.set(0,-.40,centerZ);sea.receiveShadow=false;root.add(sea);

    const staticDetails=new T.Group();root.add(staticDetails);
    // Stones lead from the real doorstep, always lying below the editable objects.
    const door=point({x:2,z:1});
    for(let i=0;i<7;i++){
        const stone=g.pebble(i%2?'#d3c6a3':'#bcae8b',[door.x+Math.sin(i*.75)*.20,.03,door.z+.40+i*.35],[.22,.033,.14],staticDetails,9);
        stone.rotation.y=i*.82;
    }
    // Peripheral planting is deliberately clustered: open central ground is the child's canvas.
    for(let i=0;i<112;i++){
        const angle=Math.floor(i/7)*2.39996+(variation(i+11)-.5)*.23, edge=.88+variation(i+10)*.16;
        const x=Math.cos(angle)*(width/2+.55)*edge,z=centerZ+Math.sin(angle)*(depth/2+.57)*edge;
        // Keep the front centre as a breathing space and a clear shoreline.
        if(z>centerZ+depth*.32&&Math.abs(x)<width*.30) continue;
        const height=.10+variation(i+30)*.16;
        for(let j=0;j<3;j++){
            const blade=g.pebble(['#617c47','#7f9856','#a9b675'][i%3],[x+(j-1)*.047,height*.55,z],[.027,height,.047],staticDetails,6);
            blade.rotation.z=(j-1)*.28;
        }
        if(i%7===0){
            const h=height+.08; g.branch([[x,.01,z],[x+.03,h,z]],.009,'#617c47',staticDetails);
            for(let p=0;p<5;p++){const a=p*Math.PI*2/5;g.pebble(i%2?'#f0dfaa':'#b5a2bb',[x+.03+Math.cos(a)*.055,h,z+Math.sin(a)*.055],[.046,.023,.046],staticDetails,7);}
            g.pebble('#cbaa59',[x+.03,h+.02,z],[.025,.025,.025],staticDetails,7);
        }
        if(i%11===0) g.pebble(i%2?'#999d87':'#b7b49a',[x,-.01,z],[.18+variation(i)*.17,.13,.21],staticDetails,9);
    }
    // An old sheltering tree: asymmetric trunk, branching arc, exposed roots outside the cells.
    const trunk:V3[]=[[west,-.15,north+.5],[west-.12,1.15,north+.42],[west+.08,2.55,north+.13],[-width*.28,3.70,north-.15],[-width*.03,4.45,north-.2],[width*.30,4.63,north-.35]];
    g.taperedBranch(trunk,.39,.075,'#8c7555',staticDetails);
    for(let i=0;i<4;i++) g.branch([[west,.45,north+.45],[west-.45+i*.35,.16,north+.96],[west-.62+i*.32,.02,north+1.62]],.075,'#88704e',staticDetails);
    g.branch([[west+.12,2.5,north],[west-.7,3.47,north-.25],[west-.68,4.4,north-.45]],.13,'#806343',staticDetails);
    g.branch([[-width*.12,4.23,north],[-width*.08,4.83,north-.70],[width*.1,5.2,north-.95]],.13,'#806343',staticDetails);
    // Slim bark ridges read at close crop without a noisy full-screen texture.
    for(let i=0;i<4;i++) g.branch([[west-.24+i*.14,.25,north+.75],[west-.25+i*.15,1.3,north+.71],[west-.10+i*.13,2.48,north+.45]],.014,'#a08961',staticDetails);

    const crowns:T.Group[]=[];
    const canopyLeaves=new T.Group();root.add(canopyLeaves);
    const leaf=leafGeometry();
    const clusters:V3[]=[[west-.35,4.4,north-.28],[-width*.26,4.65,north-.25],[-width*.02,5.03,north-.65],[width*.26,4.88,north-.38]];
    clusters.forEach(([x,y,z],index)=>{
        const crown=new T.Group(); crown.name='garden-leaf-cluster';crown.position.set(x,y,z);canopyLeaves.add(crown);crowns.push(crown);
        for(let j=0;j<24;j++){
            const n=index*37+j, angle=j*2.39996, radius=Math.sqrt(variation(n+50))*1.14;
            const mesh=g.mesh(leaf.clone(),g.paint(['#587c57','#749762','#97b47c','#628c62'][n%4]),[Math.cos(angle)*radius,variation(n+73)*.37,Math.sin(angle)*radius*.75],crown);
            mesh.rotation.set(-.22+variation(n+2)*.65,angle,.35-Math.abs(radius)*.55);
            const scale=.72+variation(n+20)*.60;mesh.scale.set(scale,scale,scale);
        }
        g.batch(crown);
    });leaf.dispose();batch(canopyLeaves);crowns.forEach(crown=>crown.removeFromParent());
    const lanterns=new T.Group();root.add(lanterns);
    for(const [x,y,z] of [[west+.8,2.50,north+.43],[width*.28,3.62,north-.07]] as V3[]){
        g.branch([[x,y+.43,z],[x,y,z]],.009,'#796241',staticDetails);
        g.mesh(new T.SphereGeometry(.095,10,6),g.paint('#ebc278',.7,.7),[x,y-.09,z],lanterns).scale.set(.75,1.1,.75);
        const halo=glow.sprite(.70);halo.position.set(x,y-.09,z+.05);lanterns.add(halo);
    }g.batch(lanterns);g.batch(staticDetails);

    const lightDots=new T.BufferGeometry();
    const positions=Array.from({length:18},(_,i)=>[(variation(i+80)-.5)*(width+1),.4+variation(i+42)*1.3,(variation(i+89)-.5)*(depth+1)+centerZ]).flat();
    lightDots.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    const dustMaterial=new T.PointsMaterial({color:'#e7dba2',size:.022,transparent:true,opacity:.3,depthWrite:false});
    const dust=new T.Points(lightDots,dustMaterial);dust.name='garden-air';root.add(dust);
    const setTime=(time:GardenTime)=>{
        seaMaterial.uniforms.deep.value.set(time==='night'?'#264e60':time==='dusk'?'#426d72':'#427f80');
        seaMaterial.uniforms.shallow.value.set(time==='night'?'#477786':time==='dusk'?'#759890':'#73a79b');
        dustMaterial.opacity=time==='day'?.18:.42;
        glow.material.opacity=time==='day'?.08:time==='dusk'?.40:.55;
    };
    g.batch(root);
    return {root,setTime,animate(at:number,reduced:boolean){
        const seconds=reduced?0:at/1000;seaMaterial.uniforms.at.value=seconds;
        canopyLeaves.rotation.z=reduced?0:Math.sin(seconds*.29)*.005;canopyLeaves.rotation.x=reduced?0:Math.sin(seconds*.24)*.004;
        dust.position.y=reduced?0:Math.sin(seconds*.12)*.04;
    },dispose(){g.dispose();glow.dispose();soil.dispose();seaMaterial.dispose();dustMaterial.dispose();}};
}
