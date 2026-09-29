import * as T from 'three';
import type { PlotStyle } from '../../../domain/growingIsland';
import { ball, box, mesh, ROOF_COLORS, STYLE_ROOF, WALL, WOOD, type Paint } from './plotParts';

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
    const glow = paint(style === 'light' ? '#ffe39a' : '#f6ca80', .5);
    const total = style === 'light' ? count + 1 : count;
    for (let i = 0; i < total; i++) {
        const x = (i - (total - 1) / 2) * width / (total + .5);
        mesh(parent, new T.PlaneGeometry(.12, .14), glow, [x, y, width / 2 + .005]);
    }
}

/** Homes grow upward: 1 tent, 2 hut, 3 house, 4 two storeys. Seeds show stakes and a flag. */
export function buildHome(paint: Paint, stage: number, style: PlotStyle, roofColor?: number) {
    const root = new T.Group(), color = roofColor ? ROOF_COLORS[roofColor] : STYLE_ROOF[style];
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
        const tent = mesh(body, new T.ConeGeometry(.38, .6, 6), paint(color), [0, .3, 0]);
        tent.rotation.y = Math.PI / 6;
        mesh(body, new T.PlaneGeometry(.16, .26), paint('#4a3a2e'), [0, .13, .31]).rotation.x = -.45;
        return root;
    }
    const width = stage === 2 ? .56 : .7, height = stage === 2 ? .42 : .52;
    box(body, paint, WALL, [0, height / 2, 0], [width, height, width]);
    box(body, paint, '#865a3f', [0, .13, width / 2 + .005], [.14, .24, .02]);
    windows(body, paint, style, width, height * .62, stage === 2 ? 1 : 2);
    if (stage === 4) {
        box(body, paint, WALL, [0, height + height * .42, 0], [width * .84, height * .84, width * .84]);
        windows(body, paint, style, width * .84, height * 1.45, 2);
        roof(body, paint, color, style, width * .84, height * 1.84);
    } else roof(body, paint, color, style, width, height);
    if (stage >= 3) box(body, paint, '#b6a68b', [width * .26, height + .3, -width * .18], [.1, .26, .1]);
    return root;
}
