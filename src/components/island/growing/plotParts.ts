import * as T from 'three';
import type { PlotStyle } from '../../../domain/growingIsland';

/** Roof colours children can paint (spec 52 §1). Index 0 follows the plot's own style. */
export const ROOF_COLORS = ['#a2644e', '#d77a86', '#e0b454', '#5f9ec4', '#78a86a', '#9a7cc4', '#e59a58', '#6f6a8e'] as const;
/** Two "ふしぎな やね" after the plain colours: red polka dots and bold colour blocks. */
export const WONDER_ROOFS = ['dots-red', 'blocks'] as const;
export const ROOF_CHOICES = ROOF_COLORS.length + WONDER_ROOFS.length;
export const STYLE_ROOF: Record<PlotStyle, string> = { water: '#5f9ec4', tree: '#6f9a5b', flower: '#d77a86', light: '#e0b454', plain: '#a2644e' };
export const WALL = '#f0e4c6', WOOD = '#9b7250', SOIL = '#8a6a48';

export type Paint = (color: string, roughness?: number) => T.Material;

export function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, position: [number, number, number]) {
    const m = new T.Mesh(geometry, material); m.position.set(...position);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
export const box = (p: T.Object3D, paint: Paint, color: string, pos: [number, number, number], size: [number, number, number]) =>
    mesh(p, new T.BoxGeometry(...size), paint(color), pos);
export const ball = (p: T.Object3D, paint: Paint, color: string, pos: [number, number, number], r: number, squash = 1) => {
    const m = mesh(p, new T.SphereGeometry(r, 12, 8), paint(color), pos); m.scale.y = squash; return m;
};
