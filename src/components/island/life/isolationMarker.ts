import * as T from 'three';
import { isFacility } from '../../../domain/islandLife/footprint';
import type { LifeItem } from '../../../domain/islandLife/model';

/** Static entrance sign: footprints and a question, readable without color or motion. */
export function isolationMarker(item: LifeItem, paint: (color: string) => T.Material) {
    const root = new T.Group(); root.name = `life-isolation-${item.id}`;
    root.userData.itemId = item.id;
    root.position.z = isFacility(item.kind) ? 1.7 : .48;
    const paper = paint('#fff9e9'), ink = paint('#63513e');
    const sign = new T.Group(); sign.name = 'life-isolation-sign'; sign.position.y = isFacility(item.kind) ? 1.9 : .95; root.add(sign);
    const stem = new T.Mesh(new T.CylinderGeometry(.013, .013, sign.position.y - .2, 6), paper); stem.position.y = (sign.position.y - .2) / 2; root.add(stem);
    const plate = new T.Mesh(new T.SphereGeometry(.25, 20, 12), paper); plate.scale.set(1.4, 1, .2); sign.add(plate);
    for (const x of [-.16, -.05]) {
        const sole = new T.Mesh(new T.SphereGeometry(.035, 10, 8), ink);
        sole.scale.set(.75, 1.65, .35); sole.position.set(x, -.04 + (x === -.05 ? .06 : 0), .065); sign.add(sole);
        const toe = new T.Mesh(new T.SphereGeometry(.027, 10, 8), ink);
        toe.scale.z = .4; toe.position.copy(sole.position); toe.position.y += .095; sign.add(toe);
    }
    const curve = new T.CatmullRomCurve3([[.05, .09], [.07, .145], [.15, .14], [.185, .08], [.13, .025], [.12, -.04]].map(([x, y]) => new T.Vector3(x, y, .065)));
    sign.add(new T.Mesh(new T.TubeGeometry(curve, 20, .016, 8, false), ink));
    const dot = new T.Mesh(new T.SphereGeometry(.021, 10, 8), ink); dot.position.set(.12, -.105, .065); sign.add(dot);
    return root;
}
