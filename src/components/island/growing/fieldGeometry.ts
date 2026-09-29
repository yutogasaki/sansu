import * as T from 'three';
import type { PlotStyle } from '../../../domain/growingIsland';
import { ball, box, mesh, SOIL, WOOD, type Paint } from './plotParts';
import { wonder } from './wonderPaint';

const CROP: Record<PlotStyle, { color: string; shape: 'pad' | 'cap' | 'berry' | 'pumpkin' | 'root' }> = {
    water: { color: '#6fa87a', shape: 'pad' }, tree: { color: '#c98c5a', shape: 'cap' }, flower: { color: '#d6455a', shape: 'berry' },
    light: { color: '#e79a3c', shape: 'pumpkin' }, plain: { color: '#e8893a', shape: 'root' },
};

/** A seed shows furrows; the built field carries the crop its surroundings chose. */
export function buildFarm(paint: Paint, stage: number, style: PlotStyle, market = false) {
    const root = new T.Group();
    box(root, paint, SOIL, [0, .03, 0], [.86, .06, .86]);
    for (const z of [-.26, 0, .26]) box(root, paint, '#6f5236', [0, .07, z], [.8, .03, .07]);
    if (stage === 0) return root;
    const crop = CROP[style];
    for (let i = 0; i < 9; i++) {
        const x = (i % 3 - 1) * .26, z = (Math.floor(i / 3) - 1) * .26;
        ball(root, paint, '#6f9a52', [x, .12, z], .07, .6);
        if (crop.shape === 'pad') mesh(root, new T.CylinderGeometry(.1, .1, .015, 10), paint(crop.color), [x + .04, .1, z]);
        else if (crop.shape === 'cap') { mesh(root, new T.CylinderGeometry(.02, .02, .08, 6), paint('#efe1c4'), [x, .12, z]); mesh(root, new T.SphereGeometry(.06, 12, 8), wonder('dots-red'), [x, .17, z]).scale.y = .55; }
        else if (crop.shape === 'berry') ball(root, paint, crop.color, [x + .05, .12, z + .03], .035);
        else if (crop.shape === 'pumpkin') mesh(root, new T.SphereGeometry(.07, 12, 8), i % 3 === 1 ? wonder('dots-yellow') : paint(crop.color), [x, .12, z]).scale.y = .75;
        else mesh(root, new T.ConeGeometry(.03, .1, 6), paint(crop.color), [x, .1, z]).rotation.x = Math.PI;
    }
    if (market) {
        for (const x of [-.36, .36]) box(root, paint, WOOD, [x, .35, -.36], [.05, .7, .05]);
        const awning = mesh(root, new T.BoxGeometry(.86, .05, .4), paint('#d77a86'), [0, .72, -.3]); awning.rotation.x = .25;
    }
    return root;
}

export function buildPlay(paint: Paint, stage: number, style: PlotStyle, festival = false) {
    const root = new T.Group();
    if (stage === 0) {
        for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) box(root, paint, WOOD, [x, .09, z], [.04, .18, .04]);
        return root;
    }
    mesh(root, new T.CylinderGeometry(.44, .46, .04, 20), festival ? wonder('blocks') : paint('#d8c8a2'), [0, .02, 0]);
    if (festival) {
        mesh(root, new T.SphereGeometry(.12, 14, 10), wonder('dots-red'), [0, .92, 0]);
        mesh(root, new T.CylinderGeometry(.025, .025, .9, 6), paint(WOOD), [0, .45, 0]);
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            const flag = mesh(root, new T.ConeGeometry(.05, .12, 3), paint(['#d77a86', '#e0b454', '#5f9ec4'][i % 3]), [Math.cos(a) * .3, .75 - i * .04, Math.sin(a) * .3]);
            flag.rotation.x = Math.PI;
        }
        return root;
    }
    if (style === 'water') mesh(root, new T.CylinderGeometry(.26, .26, .05, 18), paint('#7fb8c8', .3), [0, .05, 0]);
    else if (style === 'tree') {
        for (const x of [-.28, .28]) box(root, paint, WOOD, [x, .3, 0], [.05, .6, .05]);
        box(root, paint, WOOD, [0, .6, 0], [.62, .05, .05]);
        box(root, paint, '#c89b62', [0, .22, 0], [.2, .03, .1]);
    } else if (style === 'flower') {
        box(root, paint, WOOD, [0, .14, -.1], [.5, .05, .16]);
        for (let i = 0; i < 6; i++) ball(root, paint, i % 2 ? '#f6c6d4' : '#fff0a8', [-.3 + i * .12, .08, .22], .05);
    } else if (style === 'light') {
        for (let i = 0; i < 4; i++) ball(root, paint, '#ffd98a', [-.3 + i * .2, .5 + Math.sin(i) * .04, 0], .05);
        for (const x of [-.36, .36]) box(root, paint, WOOD, [x, .27, 0], [.04, .54, .04]);
    } else for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7; ball(root, paint, '#bdb194', [Math.cos(a) * .3, .05, Math.sin(a) * .3], .05, .6);
    }
    return root;
}

/** Wild plants start as a sprout and fill out as they bloom (growth 0-6 hours). */
export function buildWild(paint: Paint, stage: number, style: PlotStyle, growth: number) {
    const root = new T.Group(), scale = stage === 0 ? .35 : .45 + Math.min(1, growth / 6) * .55;
    const leaf = style === 'water' ? '#6f9a62' : style === 'tree' ? '#4f7a4a' : '#6f9a52';
    for (let i = 0; i < 5; i++) {
        const a = i * 2.4, blade = mesh(root, new T.ConeGeometry(.04, .3, 5), paint(leaf), [Math.cos(a) * .12, .15, Math.sin(a) * .12]);
        blade.rotation.z = Math.cos(a) * .3; blade.rotation.x = Math.sin(a) * .3;
    }
    if (stage > 0 && growth >= 6) {
        const bloom = style === 'light' ? '#fff2a6' : style === 'water' ? '#b9d9ef' : style === 'tree' ? '#7aa06a' : '#f3a9c0';
        for (let i = 0; i < 3; i++) ball(root, paint, bloom, [Math.cos(i * 2.1) * .1, .3, Math.sin(i * 2.1) * .1], .05);
    }
    root.scale.setScalar(scale);
    return root;
}
