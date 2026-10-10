import * as T from 'three';
import type { PlotStyle } from '../../../domain/growingIsland';
import { ball, box, mesh, ROOF_COLORS, STYLE_ROOF, WALL, WONDER_ROOFS, WOOD, type Paint } from './plotParts';
import { wonder } from './wonderPaint';
import { foldedHomeRoofGeometry, roundedHomeWallGeometry } from './homeSurfaceGeometry';

function roof(parent: T.Object3D, paint: Paint, color: string, style: PlotStyle, width: number, y: number) {
    if (style === 'tree') {
        const folded = mesh(parent, foldedHomeRoofGeometry(width), paint(color), [0, y, 0]);
        folded.name = 'home-folded-leaf-roof';
        for (const side of [-1, 1]) {
            const points = Array.from({ length: 25 }, (_, i) => {
                const t = i / 24, arch = Math.sin(Math.PI * t);
                return new T.Vector3(side * width * (.09 + .05 * (t - .5)), width * (.46 * arch ** .38 - .032 * Math.sqrt(arch)) - .005, width * 1.2 * (t - .5));
            });
            const rib = mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, .014, 6, false), paint(WOOD), [0, y, 0]); rib.name = 'home-leaf-support-rib';
            const pole = box(parent, paint, WOOD, [side * width * .09, y + width * .214, 0], [.032, width * .428, .032]); pole.name = 'home-leaf-support-post';
        }
        return;
    }
    if (style === 'water') {
        // A broad, scalloped cap belongs to the waterside home, rather than a
        // tiny pyramid stacked on a narrow tower.
        const vertices: number[] = [], indices: number[] = [], segments = 40, rings = 10;
        for (let ring = 0; ring <= rings; ring++) for (let i = 0; i <= segments; i++) {
            const a = i / segments * Math.PI * 2, t = ring / rings;
            const radius = width * .66 * Math.sin(t * Math.PI / 2) * (1 + .045 * t * Math.cos(a * 8));
            vertices.push(Math.cos(a) * radius, y + width * .39 * Math.cos(t * Math.PI / 2), Math.sin(a) * radius * .86);
            if (ring && i) { const k = ring * (segments + 1) + i; indices.push(k, k - 1, k - segments - 2, k, k - segments - 2, k - segments - 1); }
        }
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
        const cap = mesh(parent, geometry, paint(color), [0, 0, 0]); cap.name = 'home-scalloped-cap';
        const rim = mesh(parent, new T.TorusGeometry(width * .64, .025, 6, 40), paint('#c7dce7'), [0, y, 0]); rim.rotation.x = Math.PI / 2; rim.scale.y = .86;
        return;
    }
    const half = width * .68, peak = width * .49, eave = -.035;
    const face = new T.Shape(); face.moveTo(-width / 2, 0); face.quadraticCurveTo(-width * .31, peak * .66, -.045, peak * .90); face.quadraticCurveTo(width * .27, peak * .64, width / 2, 0); face.closePath();
    mesh(parent, new T.ExtrudeGeometry(face, { depth: width * .90, bevelEnabled: false, curveSegments: 12 }), paint('#f6ecd8'), [0, y, -width * .45]);
    const shape = new T.Shape(); shape.moveTo(-half, eave);
    shape.bezierCurveTo(-half * .68, eave - .055, -half * .70, peak * .84, -.045, peak);
    shape.bezierCurveTo(half * .49, peak * .86, half * .59, eave + .015, half, eave + .06);
    shape.lineTo(half, eave + .008);
    shape.bezierCurveTo(half * .57, eave - .04, half * .47, peak * .70, -.045, peak - .065);
    shape.bezierCurveTo(-half * .67, peak * .70, -half * .65, eave - .11, -half, eave - .055); shape.closePath();
    const surface = mesh(parent, new T.ExtrudeGeometry(shape, { depth: width * 1.12, curveSegments: 12, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2 }), paint(color), [0, y, -width * .56]);
    surface.name = 'home-curled-gable';
    // The deep front eave and a round attic window give the whole island a
    // recognisable cottage vocabulary even at its overview scale.
    const z = width * .455;
    mesh(parent, new T.TorusGeometry(width * .10, .019, 6, 20), paint('#b89971'), [0, y + peak * .43, z]);
    mesh(parent, new T.CircleGeometry(width * .082, 20), paint('#a8d3e6', .4), [0, y + peak * .43, z + .006]);
    box(parent, paint, '#f6ecd8', [0, y + peak * .43, z + .012], [.014, width * .17, .015]);
    if (style === 'flower') for (let i = 0; i < 5; i++) {
        ball(parent, paint, i % 2 ? '#e8adc5' : '#c690bf', [(-2 + i) * width * .12, y + peak * (.65 - Math.abs(i - 2) * .14), width * .54], .035, .65);
    }
}

function windows(parent: T.Object3D, paint: Paint, style: PlotStyle, width: number, y: number, count: number) {
    const glow = paint(style === 'light' ? '#ffe39a' : '#a8d3e6', .5), frame = paint('#b89971', .7);
    const total = count;
    for (let i = 0; i < total; i++) {
        const x = total === 1 ? width * .30 : (i ? 1 : -1) * width * .30;
        const z = width * .5 * Math.sqrt(1 - (2 * x / width) ** 2) + .006;
        const window = new T.Group(); window.position.set(x, y, z); window.rotation.y = Math.asin(2 * x / width); parent.add(window);
        mesh(window, new T.BoxGeometry(.16, .18, .015), frame, [0, 0, 0]);
        mesh(window, new T.PlaneGeometry(.12, .14), glow, [0, 0, .009]);
        mesh(window, new T.BoxGeometry(.012, .14, .01), frame, [0, 0, .012]);
        // A flower box under the window.
        mesh(window, new T.BoxGeometry(.17, .04, .05), paint('#9b7250'), [0, -.11, .02]);
        for (const dx of [-.05, 0, .05]) ball(window, paint, style === 'flower' ? '#f6c6d4' : dx ? '#fff0a8' : '#e58ea3', [dx, -.08, .03], .022);
    }
}

/** An arched door with a knob and a step, so each home reads as a place someone lives. */
function door(parent: T.Object3D, paint: Paint, width: number) {
    const z = width / 2 + .012;
    const doorShape = new T.Shape(); doorShape.moveTo(-.10, 0); doorShape.lineTo(.10, 0); doorShape.lineTo(.10, .22); doorShape.absarc(0, .22, .10, 0, Math.PI, false); doorShape.closePath();
    const arch = mesh(parent, new T.ExtrudeGeometry(doorShape, { depth: .025, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2 }), paint('#4684b2'), [0, .025, z]); arch.name = 'home-door';
    ball(parent, paint, '#e0b454', [.062, .17, z + .032], .014);
    mesh(parent, new T.BoxGeometry(.29, .04, .13), paint('#cbbfa6'), [0, .02, z + .045]);
}

/** Homes grow upward: 1 tent, 2 hut, 3 house, 4 two storeys. Seeds show stakes and a flag. */
export function buildHome(paint: Paint, stage: number, style: PlotStyle, roofColor?: number) {
    const special = roofColor !== undefined && roofColor >= ROOF_COLORS.length ? WONDER_ROOFS[roofColor - ROOF_COLORS.length] : undefined;
    const color = roofColor && !special ? ROOF_COLORS[roofColor] : STYLE_ROOF[style];
    // A wonder roof keeps the house's shape and swaps only the roof paint.
    const roofPaint: Paint = special ? (c, r) => c === color ? wonder(special) : paint(c, r) : paint;
    const root = new T.Group();
    const body = new T.Group(); root.add(body);
    if (style === 'water' && stage > 0) {
        // Stilts lift the home above the damp ground by the water.
        for (const [x, z] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) box(root, paint, WOOD, [x, .12, z], [.06, .24, .06]);
        box(root, paint, '#b89a72', [0, .25, 0], [.7, .04, .7]);
        body.position.y = .27;
    }
    if (stage === 0) {
        for (const [x, z] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) box(root, paint, WOOD, [x, .12, z], [.04, .24, .04]);
        box(root, paint, WOOD, [.3, .32, .3], [.02, .64, .02]);
        const flag = mesh(root, new T.PlaneGeometry(.22, .14), paint('#f0c166'), [.41, .56, .3]); flag.name = 'plot-flag';
        (flag.material as T.MeshStandardMaterial).side = T.DoubleSide;
        return root;
    }
    if (stage === 1) {
        const tent = mesh(body, new T.ConeGeometry(.38, .6, 6), roofPaint(color), [0, .3, 0]);
        tent.rotation.y = Math.PI / 6;
        // A pennant on top and a round mat by the door.
        mesh(body, new T.CylinderGeometry(.008, .008, .18, 5), paint(WOOD), [0, .66, 0]);
        const pennant = mesh(body, new T.ConeGeometry(.04, .12, 3), paint('#f0c166'), [.05, .71, 0]); pennant.rotation.z = -Math.PI / 2;
        mesh(body, new T.CylinderGeometry(.13, .13, .012, 14), paint('#e3c896'), [0, .008, .42]);
        mesh(body, new T.PlaneGeometry(.16, .26), paint('#4a3a2e'), [0, .13, .31]).rotation.x = -.45;
        return root;
    }
    const width = stage === 2 ? .70 : stage === 4 ? .90 : .80, height = stage === 2 ? .45 : .52;
    const wall = mesh(body, roundedHomeWallGeometry(width, height), paint(WALL), [0, 0, 0]); wall.name = 'home-ground-floor';
    box(body, paint, '#d9ccb0', [0, .03, 0], [width + .04, .06, width + .04]);
    door(body, paint, width);
    windows(body, paint, style, width, height * .66, stage === 2 ? 1 : 2);
    if (style === 'light') {
        // A little lantern by the door.
        mesh(body, new T.CylinderGeometry(.012, .012, .3, 6), paint(WOOD), [width / 2 - .06, .15, width / 2 + .08]);
        mesh(body, new T.BoxGeometry(.06, .07, .06), paint('#ffe39a', .3), [width / 2 - .06, .33, width / 2 + .08]);
    }
    if (stage === 4) {
        const upper = mesh(body, roundedHomeWallGeometry(width * .96, .28), paint(WALL), [0, height, 0]); upper.name = 'home-upper-floor';
        box(body, paint, '#b89971', [0, height + .012, width * .46], [width * .98, .035, .035]);
        windows(body, paint, style, width * .96, height + .15, 2);
        roof(body, roofPaint, color, style, width, height + .28);
    } else roof(body, roofPaint, color, style, width, height);
    const top = stage === 4 ? height + .28 : height;
    character(body, root, paint, style, width, top, stage);
    return root;
}

/**
 * Each surrounding gives a home its own character (spec 52 §3.2): a little boat by the water,
 * a tree growing through the roof, climbing vines, a big round window under a star, or a
 * chimney and hedge. The form stays the one chosen when the home was built.
 */
function character(body: T.Group, root: T.Group, paint: Paint, style: PlotStyle, width: number, top: number, stage: number) {
    const half = width / 2;
    if (style === 'water') {
        for (const z of [-.12, .12]) {
            mesh(body, new T.TorusGeometry(.055, .015, 8, 18), paint('#f3ecdc'), [half + .006, top * .45, z]).rotation.y = Math.PI / 2;
            mesh(body, new T.CircleGeometry(.05, 14), paint('#9fd3e4', .3), [half + .008, top * .45, z]).rotation.y = Math.PI / 2;
        }
        // A plank to a tiny moored boat beside the stilts.
        box(root, paint, '#b08a62', [half + .2, .2, .1], [.32, .03, .12]);
        const boat = mesh(root, new T.SphereGeometry(.13, 12, 8), paint('#8f6546'), [half + .42, .08, .1]); boat.scale.set(1.5, .45, .8);
    } else if (style === 'tree') {
        // The home is built around a living tree: trunk through the roof, canopy above, a ladder.
        mesh(body, new T.CylinderGeometry(.07, .1, top + .55, 10), paint('#8a6a48'), [-half * .45, (top + .55) / 2, -half * .45]);
        for (const [x, y, z, r] of [[-half * .45, top + .55, -half * .45, .3], [-half * .1, top + .45, -half * .6, .22], [-half * .75, top + .42, -half * .2, .2]] as const)
            mesh(body, new T.SphereGeometry(r, 14, 10), paint(r > .25 ? '#5d8a51' : '#7fa865'), [x, y, z]);
        for (const x of [half + .04, half + .14]) mesh(body, new T.BoxGeometry(.018, top * .8, .018), paint(WOOD), [x, top * .4, .1]);
        for (let i = 0; i < 4; i++) mesh(body, new T.BoxGeometry(.11, .014, .014), paint(WOOD), [half + .09, .08 + i * top * .2, .1]);
    } else if (style === 'flower') {
        // Vines climb the front corners and bloom.
        for (const side of [-1, 1]) {
            mesh(body, new T.CylinderGeometry(.014, .014, top * .9, 6), paint('#5d8a51'), [side * (half - .02), top * .45, half + .02]);
            for (let i = 0; i < 4; i++) ball(body, paint, i % 2 ? '#f6c6d4' : '#fff0a8', [side * (half - .02) + Math.sin(i * 2) * .03, .12 + i * top * .22, half + .04], .03);
        }
    } else if (style === 'light') {
        // A big round window and a star weathervane on the roof.
        mesh(body, new T.TorusGeometry(.09, .018, 8, 24), paint('#fff8ea'), [0, top * .82, half + .012]);
        mesh(body, new T.CircleGeometry(.08, 20), paint('#ffe39a', .3), [0, top * .82, half + .014]);
        mesh(body, new T.CylinderGeometry(.008, .008, .26, 6), paint('#6f6a8e'), [0, top + width * .62 + .1, 0]);
        mesh(body, new T.OctahedronGeometry(.06), paint('#f0cf6a', .4), [0, top + width * .62 + .25, 0]);
    } else {
        box(body, paint, '#b6a68b', [width * .26, top + .3, -width * .18], [.1, .26, .1]);
        for (let i = 0; i < 3; i++) ball(body, paint, '#6f9a52', [-half - .08, .1, -half * .6 + i * .18], .1, .9);
    }
    if (stage === 4 && style !== 'plain') box(body, paint, '#b6a68b', [width * .3, top + .25, -width * .25], [.09, .22, .09]);
}
