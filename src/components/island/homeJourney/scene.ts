import { applyFabricPanel } from '../three/residentFabric';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { homeJourneyView, type HomeJourneyState } from '../../../domain/island/homeJourney';
import { IslandMaterials, ellipsoid, cylinder, disposeGeometry } from '../three/primitives';
import { makeResidentRig } from '../three/residentRig';

function box(parent: T.Object3D, material: T.Material, position: [number,number,number], size: [number,number,number]) {
    const object=new T.Mesh(new RoundedBoxGeometry(...size, 3, Math.min(...size)*.18),material);
    object.position.set(...position); object.castShadow=object.receiveShadow=true; parent.add(object); return object;
}
/** Geometry prototype; fixed roots and camera, separate from production art. */
export function buildHomeJourney(state?: HomeJourneyState) {
    const view = homeJourneyView(state), world = new T.Group(), m = new IslandMaterials('moon-garden');
    const paint = (hex: string) => m.surface(hex, .8);
    const wood = paint('#b98254'), wall = paint('#fff0d4'), blue = paint('#3281c6');
    const outline = new T.Shape();
    const points=Array.from({length:20},(_,i)=> { const a=i*Math.PI*2/20, r=4.65+.22*Math.sin(a*3)+.12*Math.cos(a*7); return new T.Vector2(Math.cos(a)*r,Math.sin(a)*r*.82); });
    const coast=new T.SplineCurve([...points,points[0]]).getPoints(120);
    outline.moveTo(coast[0].x,coast[0].y); coast.slice(1).forEach(p=>outline.lineTo(p.x,p.y)); outline.closePath();
    for(const [color,depth,scale,y] of [['#d9c397',.34,1.025,-.39],['#84ad65',.18,1,-.18]] as const) {
        const land=new T.Mesh(new T.ExtrudeGeometry(outline,{depth,bevelEnabled:true,bevelThickness:.045,bevelSize:.05,bevelSegments:3,steps:1}),paint(color));
        land.rotation.x=-Math.PI/2; land.scale.set(scale,scale,1); land.position.y=y;land.receiveShadow=true;world.add(land);
    }
    for(const [x,z] of [[-3.8,1.8],[-4,-1],[-2.5,3.1],[3.7,1.7],[3.9,-1.3],[.8,-3.4]])
        ellipsoid(world,paint('#a5a5b4'),[x,.08,z],[.32,.20,.23]);
    const path = (x: number, z: number) => ellipsoid(world, paint('#e9d9b7'), [x, .025, z], [.24, .045, .19]);
    for (let z = .7; z < 3.5; z += .48) path(-1, z);
    if (view.shop) for (let z = -.5; z > -3; z -= .45) path(-2.5, z);
    const house = new T.Group(); house.name = 'home'; house.position.set(-1, 0, 0); world.add(house);
    box(house, wall, [0, .78, -.5], [1.8, 1.56, 1.5]);
    const roof = (g: T.Group, x: number, y: number, z: number, width: number, depth: number) => {
        for (const side of [-1, 1]) {
            const p = box(g, paint(side < 0 ? '#ed879e' : '#f0c166'), [x + side * width / 4, y, z], [width * .65, .16, depth]);
            p.rotation.z = side * -.57;
            for (let j = 0; j < 6; j++) {
                const tile = box(g, paint(['#ed879e', '#edc464', '#4983cd'][j % 3]), [x + side * width / 4, y + .08, z - depth / 2 + .14 + j * depth / 6], [width * .65, .065, depth / 6 - .015]);
                tile.rotation.z = side * -.57;
            }
        }
    };
    roof(house, 0, 1.9, -.5, 2, 1.9);
    const roofTrim = new T.Group(); roofTrim.name='home-roof-trim'; house.add(roofTrim);
    for (const side of [-1,1]) {
        const beam=box(roofTrim,wall,[side*.51,1.87,.47],[1.12,.075,.09]);
        beam.rotation.z=side*-.57;
    }
    const chimney = new T.Group(); chimney.name='home-chimney'; house.add(chimney);
    box(chimney,paint('#e7c99e'),[.57,2.05,-.9],[.3,.8,.32]);
    for (const y of [1.78,2.02,2.26]) box(chimney,paint('#cfae84'),[.57,y,-.73],[.305,.025,.02]);
    box(chimney,paint('#d8b68b'),[.57,2.47,-.9],[.39,.12,.4]);
    const door = new T.Group(); door.name='home-door'; house.add(door);
    box(door, blue, [0, .51, .27], [.55, 1.02, .055]);
    ellipsoid(house, blue, [0, 1.02, .27], [.275, .22, .04]);
    ellipsoid(house, paint('#e8bc56'), [.17, .5, .32], [.035, .035, .025]);
    ellipsoid(house, blue, [0, 1.55, .3], [.18, .18, .035]);
    box(house, wall, [0, 1.55, .35], [.035, .36, .02]);
    box(house, wall, [0, 1.55, .35], [.36, .035, .02]);
    box(house, paint('#d1c3a9'), [0, .07, .5], [.78, .14, .4]);
    const windowBox = new T.Group(); windowBox.name='home-window-box'; house.add(windowBox);
    box(windowBox,wood,[0,1.28,.4],[.54,.16,.17]);
    for (const [x,color] of [[-.17,'#fff0a0'],[0,'#ed91b8'],[.17,'#fff0a0']] as const) {
        ellipsoid(windowBox,paint('#4d925d'),[x,1.41,.4],[.09,.07,.07]);
        ellipsoid(windowBox,paint(color),[x,1.47,.42],[.055,.035,.055]);
    }
    for (const x of [-.72,.72]) for (const y of [.45,.9,1.35])
        box(house,paint('#ead9bc'),[x,y,.263],[.025,.32,.018]);
    if (view.home >= 2) {
        const canopy=new T.Group(); canopy.name='home-canopy'; house.add(canopy);
        roof(canopy,0,1.38,.62,1.05,.72);
        box(canopy,wood,[0,1.22,.35],[1.02,.10,.10]);
        for (const x of [-.4, .4]) cylinder(house, wood, [x, .63, .75], .045, 1.26);
        for (const x of [-.34,.34]) {
            const brace=box(canopy,wood,[x,1.02,.52],[.05,.45,.05]); brace.rotation.z=x<0?-.65:.65;
        }
    }
    if (view.home >= 3) {
        const terrace=new T.Group(); terrace.name='home-terrace'; house.add(terrace);
        box(terrace, wood, [1.65, .12, -.15], [1.5, .24, 1.7]);
        box(terrace, paint('#e3b974'), [1.65, 1.55, -.62], [1.65, .12, .9]);
        for (let i=0;i<7;i++) box(terrace,paint(['#ed879e','#f0c166','#4983cd'][i%3]),[1.10+i*.18,1.63,-.62],[.17,.035,.92]);
        for (let i=0;i<7;i++) ellipsoid(terrace,paint(['#ed879e','#f0c166','#4983cd'][i%3]),[1.10+i*.18,1.57,-.13],[.085,.085,.07],20);
        for (const x of [.98, 2.32]) cylinder(house, wood, [x, .85, -.85], .045, 1.4);
        for (const z of [-.8, -.3, .2, .6]) cylinder(house, wood, [2.34, .52, z], .025, .56);
        box(house, wood, [2.34, .81, -.1], [.065, .065, 1.5]);
        cylinder(house, wood, [1.6, .48, .3], .045, .5);
        cylinder(house, paint('#edca8e'), [1.6, .76, .3], .33, .07);
        for (const x of [1.15, 2.05]) {
            box(house, wood, [x, .35, .12], [.32, .1, .32]);
            box(house, wood, [x, .53, .26], [.32, .35, .06]);
        }
        for (const x of [1.48, 1.73]) cylinder(house, wall, [x, .86, .3], .06, .13);
        for (let i=0;i<3;i++) box(terrace,paint('#d1c3a9'),[1.62,.05-i*.09,.82+i*.18],[.72,.12,.32]);
        for (const x of [.96,2.32]) ellipsoid(terrace,paint('#5b9862'),[x,.22,-.82],[.18,.16,.18]);
    }
    const flower = new T.Group(); flower.name = 'flower'; flower.position.set(-2.1, 0, 1.35); world.add(flower);
    box(flower, wood, [0, .13, 0], [.72, .26, .5]);
    for (let i = 0; i < (view.flower === 2 ? 6 : 3); i++) {
        const x = (i % 3 - 1) * .22, z = i < 3 ? -.09 : .12, h = .36 + (i % 2) * .13;
        cylinder(flower, paint('#448858'), [x, h / 2, z], .015, h);
        for (let p = 0; p < 5; p++) ellipsoid(flower, paint(i % 2 ? '#ed91b8' : '#fff0a0'), [x + Math.cos(p * 1.257) * .065, h, z + Math.sin(p * 1.257) * .065], [.06, .035, .06]);
    }
    const bench = new T.Group(); bench.name = 'bench'; bench.position.set(2.5, 0, 1.2); world.add(bench);
    box(bench, wood, [0, .38, 0], [1.1, .12, .42]);
    box(bench, wood, [0, .67, -.22], [1.1, .46, .1]);
    for (const x of [-.4, .4]) box(bench, wood, [x, .18, 0], [.1, .36, .32]);
    if (view.bench === 2) for (const x of [-.26, .26]) box(bench, paint('#9bbfc6'), [x, .47, .01], [.43, .08, .34]);
    cylinder(world, wood, [3.1, .48, -.7], .10, .96);
    for (const [x,y,z,r] of [[3.1,1.35,-.7,.5],[2.78,1.15,-.6,.4],[3.43,1.12,-.65,.4],[3.16,1.08,-.95,.35]])
        ellipsoid(world, paint(y>1.2?'#b8a1d2':'#a78bc4'), [x,y,z], [r,r*.85,r],24);
    cylinder(world, wood, [1.8, .4, 2.3], .04, .8);
    box(world, paint('#f1d98a'), [1.8, .89, 2.3], [.17, .24, .17]);
    for (const x of [-2.7, -2.1, .4, 1]) {
        box(world, wood, [x, .25, 2.8], [.09, .5, .1]);
        box(world, wood, [x + .23, .3, 2.8], [.55, .07, .07]);
    }
    box(world, wood, [-1, -.02, 4], [1, .12, 1.8]);
    if (view.shop) {
        const shop = new T.Group(); shop.name = 'shop'; shop.position.set(-1.8, 0, -2.8); world.add(shop);
        if (view.shop === 2) { box(shop, wall, [0, .65, -.25], [1.3, 1.3, .9]); roof(shop, 0, 1.6, -.25, 1.5, 1.2); }
        box(shop, wood, [0, .52, .42], [1.3, .12, .4]);
        for (const x of [-.58, .58]) cylinder(shop, wood, [x, .66, .3], .035, 1.32);
        box(shop, paint('#ed91a0'), [0, 1.35, .4], [1.45, .1, .8]);
        for (const x of [-.3, 0, .3]) ellipsoid(shop, paint('#ebc75b'), [x, .66, .42], [.12, .1, .1]);
    }
    const hero = new T.Group(), heroBody = new T.Group(); hero.name = 'pokomoko'; hero.add(heroBody); world.add(hero);
    const fabric = (panel: Parameters<typeof applyFabricPanel>[1], position: [number,number,number], scale: [number,number,number]) =>
        applyFabricPanel(ellipsoid(heroBody, wall, position, scale, 32), panel, m.residentFabric());
    fabric('body', [0,.43,0],[.24,.30,.20]);
    fabric('head', [0,.88,0],[.34,.30,.27]);
    for (const side of [-1,1]) {
        fabric(side < 0 ? 'navyDots' : 'roseDots',[side*.27,1.12,-.015],[.125,.135,.08]);
        fabric(side < 0 ? 'tealDots' : 'roseDots',[side*.27,.46,.025],[.095,.18,.095]);
        ellipsoid(heroBody,m.surface('#252535',.25),[side*.12,.90,.249],[.035,.041,.025]);
        ellipsoid(heroBody,wall,[side*.11,.913,.269],[.009,.012,.008]);
    }
    fabric('cream',[0,.77,.25],[.16,.095,.065]);
    ellipsoid(heroBody,m.surface('#282333',.32),[0,.79,.31],[.044,.029,.023]);
    const mouth = new T.Mesh(new T.TorusGeometry(.041,.007,6,16,Math.PI),paint('#34293c'));
    mouth.rotation.z=Math.PI; mouth.position.set(0,.748,.31); heroBody.add(mouth);
    const heroFeet = [-1,1].map(side => applyFabricPanel(ellipsoid(hero,wall,[side*.12,.10,.09],[.10,.10,.14],24),side<0?'cream':'roseDots',m.residentFabric()));
    const rabbit = makeResidentRig('rabbit', m), otter = makeResidentRig('otter', m);
    rabbit.pose.scale.setScalar(.7); otter.pose.scale.setScalar(.7); world.add(rabbit.pose, otter.pose);
    const parcel = new T.Group(); parcel.name = 'parcel'; box(parcel, paint('#f5d273'), [0, 0, 0], [.36, .27, .27]);
    box(parcel, paint('#dc617c'), [0, .14, 0], [.055, .025, .28]);
    box(parcel, paint('#dc617c'), [0, 0, 0], [.055, .28, .28]); world.add(parcel);
    return { world, m, view, hero, heroBody, heroFeet, rabbit, otter, parcel,
        dispose: () => { disposeGeometry(world); m.dispose(); } };
}
