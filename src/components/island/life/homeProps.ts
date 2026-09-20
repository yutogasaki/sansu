import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import { homePropsEnabled, runtimeAssetSlot, type RuntimeAssetKind } from './runtimeAssetSlots';

/** Four fixed decorations inside the reserved house footprint; never purchasable/path obstacles. */
export function buildHomeProps(materials: IslandMaterials) {
    const root = new T.Group(); root.name = 'life-home-props';
    root.userData.visualCandidate = 'island-home-props-v1';
    if (!homePropsEnabled) return root;
    const box = (g: T.Group, color: string, size: number[], position: number[]) => {
        const m = new T.Mesh(new T.BoxGeometry(...size as [number, number, number]), materials.surface(color, .8));
        m.position.set(...position as [number, number, number]); m.castShadow = m.receiveShadow = true; g.add(m);
    };
    const add = (kind: RuntimeAssetKind, position: number[], size: number[], color: string) => {
        const g = new T.Group(); g.name = `life-home-${kind}`; g.position.set(...position as [number, number, number]);
        box(g, color, size, [0, size[1] / 2, 0]);
        runtimeAssetSlot(g, kind); root.add(g); return g;
    };
    const fence = add('fence', [-1.06, 0, -.8], [.65, .36, .12], '#a9753e');
    fence.rotation.y = Math.PI / 2;
    fence.children.forEach(o => (o as T.Mesh).geometry.dispose()); fence.clear();
    for (const x of [-.27, .27]) box(fence, '#a9753e', [.11, .36, .12], [x, .18, 0]);
    for (const y of [.12, .27]) box(fence, '#a9753e', [.65, .06, .07], [0, y, 0]);
    const post = add('mailbox', [-.82, 0, .75], [.25, .55, .24], '#ac5147');
    post.children.forEach(o => (o as T.Mesh).geometry.dispose()); post.clear(); box(post, '#926841', [.065, .31, .065], [0, .155, 0]);
    box(post, '#ac5147', [.25, .24, .24], [0, .43, 0]); box(post, '#f4dfb6', [.19, .16, .01], [0, .43, .125]);
    add('planter', [-1.085, 0, .25], [.29, .40, .29], '#ba694b');
    add('watering-can', [-1.06, 0, -.15], [.28, .22, .18], '#327e80');
    return root;
}
