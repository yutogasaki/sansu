import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import { box, mesh, WOOD, type Paint } from './plotParts';

/** A short wooden pier from the south shore; the waiting friend stands at its end (§7.2). */
export function buildPier(m: IslandMaterials) {
    const paint: Paint = (color, roughness = .85) => m.surface(color, roughness);
    const root = new T.Group(); root.name = 'growing-pier';
    for (let i = 0; i < 5; i++) box(root, paint, i % 2 ? '#b08a62' : '#a07a55', [0, .02, i * .3], [.62, .05, .27]);
    for (const x of [-.3, .3]) for (const z of [.15, .75, 1.35]) box(root, paint, WOOD, [x, -.12, z], [.06, .36, .06]);
    return root;
}

/** A small boat. The next friend's boat is drawn as a silhouette on the sea. */
export function buildBoat(m: IslandMaterials, silhouette = false) {
    const paint: Paint = silhouette
        ? () => new T.MeshBasicMaterial({ color: '#2d5561', transparent: true, opacity: .55, depthWrite: false })
        : (color, roughness = .8) => m.surface(color, roughness);
    const root = new T.Group(); root.name = silhouette ? 'growing-next-boat' : 'growing-boat';
    // A rounded wooden hull with a pointed bow and a rim, riding on the water.
    const hull = mesh(root, new T.SphereGeometry(.5, 20, 12), paint('#8f6546'), [0, .06, 0]);
    hull.scale.set(1.25, .3, .62);
    const deck = mesh(root, new T.CylinderGeometry(.46, .46, .03, 20), paint('#c29a6b'), [0, .15, 0]);
    deck.scale.set(1.2, 1, .55);
    const rim = mesh(root, new T.TorusGeometry(.5, .035, 6, 28), paint('#b58b5e'), [0, .15, 0]);
    rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, .62, 1);
    mesh(root, new T.CylinderGeometry(.018, .018, .9, 6), paint(WOOD), [-.42, .6, 0]);
    const sail = mesh(root, new T.ConeGeometry(.26, .62, 3), paint(silhouette ? '#2d5561' : '#f3ecdc'), [-.3, .68, 0]);
    sail.rotation.z = -.08;
    root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return root;
}

/** A soft glow that marks a sparkling (rare-coloured) friend. */
export function buildSparkle() {
    const material = new T.MeshBasicMaterial({ color: '#fff2a6', transparent: true, opacity: .85, depthWrite: false });
    const star = new T.Mesh(new T.OctahedronGeometry(.07), material); star.name = 'growing-sparkle';
    return star;
}
