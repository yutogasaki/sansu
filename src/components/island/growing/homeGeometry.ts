import * as T from 'three';
import type { PlotStyle } from '../../../domain/growingIsland';
import { ball, box, mesh, ROOF_COLORS, STYLE_ROOF, WALL, WONDER_ROOFS, WOOD, type Paint } from './plotParts';
import { wonder } from './wonderPaint';

function roof(parent: T.Object3D, paint: Paint, color: string, style: PlotStyle, width: number, y: number) {
    if (style === 'plain') {
        const dome = mesh(parent, new T.SphereGeometry(width * .62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint(color), [0, y, 0]);
        dome.scale.y = .72; return;
    }
    const gable = mesh(parent, new T.ConeGeometry(width * .8, width * .62, 4), paint(color), [0, y + width * .3, 0]);
    gable.rotation.y = Math.PI / 4;
    if (style === 'flower') for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ball(parent, paint, i % 2 ? '#fff0f4' : '#f6c6d4', [Math.cos(a) * width * .32, y + width * .22, Math.sin(a) * width * .32], .07);
    }
    if (style === 'tree') for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + .4;
        ball(parent, paint, i % 2 ? '#7fa865' : '#5d8a51', [Math.cos(a) * width * .3, y + width * .35, Math.sin(a) * width * .3], .14, .7);
    }
}

function windows(parent: T.Object3D, paint: Paint, style: PlotStyle, width: number, y: number, count: number) {
    const glow = paint(style === 'light' ? '#ffe39a' : '#f6ca80', .5), frame = paint('#fff8ea', .7);
    const total = style === 'light' ? count + 1 : count;
    for (let i = 0; i < total; i++) {
        const x = (i - (total - 1) / 2) * width / (total + .5), z = width / 2 + .006;
        mesh(parent, new T.BoxGeometry(.16, .18, .015), frame, [x, y, z]);
        mesh(parent, new T.PlaneGeometry(.12, .14), glow, [x, y, z + .009]);
        mesh(parent, new T.BoxGeometry(.012, .14, .01), frame, [x, y, z + .012]);
        // A flower box under the window.
        mesh(parent, new T.BoxGeometry(.17, .04, .05), paint('#9b7250'), [x, y - .11, z + .02]);
        for (const dx of [-.05, 0, .05]) ball(parent, paint, style === 'flower' ? '#f6c6d4' : dx ? '#fff0a8' : '#e58ea3', [x + dx, y - .08, z + .03], .022);
    }
}

/** An arched door with a knob and a step, so each home reads as a place someone lives. */
function door(parent: T.Object3D, paint: Paint, width: number) {
    const z = width / 2 + .012;
    mesh(parent, new T.BoxGeometry(.15, .17, .02), paint('#865a3f'), [0, .1, z]);
    const arch = mesh(parent, new T.CylinderGeometry(.075, .075, .02, 16, 1, false, 0, Math.PI), paint('#865a3f'), [0, .185, z]);
    arch.rotation.x = Math.PI / 2; arch.rotation.y = Math.PI / 2;
    ball(parent, paint, '#e0b454', [.045, .1, z + .014], .014);
    mesh(parent, new T.BoxGeometry(.24, .03, .1), paint('#cbbfa6'), [0, .015, z + .05]);
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
    const width = stage === 2 ? .56 : .7, height = stage === 2 ? .42 : .52;
    box(body, paint, WALL, [0, height / 2, 0], [width, height, width]);
    box(body, paint, '#d9ccb0', [0, .03, 0], [width + .04, .06, width + .04]);
    door(body, paint, width);
    windows(body, paint, style, width, height * .66, stage === 2 ? 1 : 2);
    if (style === 'light') {
        // A little lantern by the door.
        mesh(body, new T.CylinderGeometry(.012, .012, .3, 6), paint(WOOD), [width / 2 - .06, .15, width / 2 + .08]);
        mesh(body, new T.BoxGeometry(.06, .07, .06), paint('#ffe39a', .3), [width / 2 - .06, .33, width / 2 + .08]);
    }
    if (stage === 4) {
        box(body, paint, WALL, [0, height + height * .42, 0], [width * .84, height * .84, width * .84]);
        // A balcony with a colour-block rail: one wonder accent on the grandest homes.
        box(body, paint, '#b89a72', [0, height + .01, width / 2 + .06], [width * .8, .03, .14]);
        mesh(body, new T.BoxGeometry(width * .8, .07, .015), wonder('blocks'), [0, height + .06, width / 2 + .13]);
        windows(body, paint, style, width * .84, height * 1.45, 2);
        roof(body, roofPaint, color, style, width * .84, height * 1.84);
    } else roof(body, roofPaint, color, style, width, height);
    if (stage >= 3) box(body, paint, '#b6a68b', [width * .26, height + .3, -width * .18], [.1, .26, .1]);
    return root;
}
