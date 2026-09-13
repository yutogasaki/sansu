import * as T from 'three';
import { ellipsoid } from '../three/primitives';

export const encounterTiming = (kind: 'X1' | 'X2') => kind === 'X1'
    ? { outboundEnd: 2500, waterEnd: 4500, returnEnd: 6500, end: 7000 }
    : { outboundEnd: 3000, waterEnd: 6000, returnEnd: 8000, end: 11000 };
export const encounterDuration = (kind: 'X1' | 'X2') => encounterTiming(kind).end;

/** Small physical visitors, allocated once for the selected real plant and bowl.
 * Existing residents and their rigs are never cloned, posed or recolored here. */
export function buildEncounterVisual(kind: 'X1' | 'X2', plant: T.Object3D, bowl: T.Object3D) {
    plant.updateWorldMatrix(true, true); bowl.updateWorldMatrix(true, true);
    const plantBox = new T.Box3().setFromObject(plant), bowlBox = new T.Box3().setFromObject(bowl);
    const perch = kind === 'X2' ? plant.getObjectByName('life-tree-perch') : undefined;
    if (kind === 'X2' && !perch) return undefined;
    const center = perch ? perch.localToWorld(new T.Vector3(.375, .85, .014)) : plantBox.getCenter(new T.Vector3()), waterCenter = bowl.getWorldPosition(new T.Vector3());
    const probe = new T.Raycaster(new T.Vector3(center.x, plantBox.max.y + 1, center.z + (perch ? 0 : .15)), new T.Vector3(0, -1, 0));
    let contact = probe.intersectObject(perch ?? plant, true)[0]?.point;
    if (!contact) { probe.ray.origin.z = center.z; contact = probe.intersectObject(perch ?? plant, true)[0]?.point; }
    if (!contact) return undefined;
    const start = contact.clone().add(new T.Vector3(0, kind === 'X1' ? .20 : .008, 0));
    const towardPlant = start.clone().sub(waterCenter).setY(0).normalize();
    const water = waterCenter.clone().addScaledVector(towardPlant, kind === 'X1' ? 0 : .349);
    water.y = kind === 'X1' ? bowlBox.max.y + .22 : bowlBox.max.y + .003;
    const root = new T.Group(), visitor = new T.Group(), cue = new T.Group();
    root.name = 'life-encounter'; visitor.name = 'life-encounter-visitor'; cue.name = 'life-encounter-cue'; root.add(visitor, cue);
    const materials = new Map<string, T.MeshStandardMaterial>();
    const paint = (color: string) => { let m = materials.get(color); if (!m) { m = new T.MeshStandardMaterial({ color, roughness: .85 }); materials.set(color, m); } return m; };
    const wings: T.Group[] = [], features: T.Object3D[] = [], markings: T.Object3D[] = [];
    let head: T.Group | undefined;
    if (kind === 'X1') {
        features.push(ellipsoid(visitor, paint('#405653'), [0, 0, 0], [.022, .024, .085], 12));
        for (const side of [-1, 1]) {
            const wing = new T.Group(); visitor.add(wing); wings.push(wing);
            ellipsoid(wing, paint('#fffaf0'), [side * .095, 0, .025], [.115, .015, .105], 16);
            ellipsoid(wing, paint('#f5f4df'), [side * .075, 0, -.085], [.08, .012, .075], 16);
            features.push(wing);
            ellipsoid(visitor, paint('#405653'), [side * .025, .01, .103], [.006, .006, .032], 8).rotation.y = side * .35;
        }
    } else {
        ellipsoid(visitor, paint('#6c9c91'), [0, .17, 0], [.115, .12, .10], 16);
        ellipsoid(visitor, paint('#f5e8c6'), [0, .12, .07], [.075, .085, .035], 12);
        head = new T.Group(); head.position.set(0, .265, .025); visitor.add(head);
        features.push(ellipsoid(head, paint('#7ba99a'), [0, 0, 0], [.10, .09, .095], 16));
        for (const side of [-1, 1]) {
            features.push(ellipsoid(head, paint('#314a47'), [side * .045, .02, .081], [.012, .014, .008], 10));
            const wing = new T.Group(); wing.position.set(side * .10, .145, -.018); visitor.add(wing); wings.push(wing);
            ellipsoid(wing, paint('#527a73'), [0, 0, 0], [.032, .095, .068], 12);
            for (const [y, z] of [[.04, .018], [-.01, .035], [-.045, -.006]])
                { const spot = ellipsoid(wing, paint('#f7e4af'), [side * .030, y, z], [.009, .017, .016], 10); features.push(spot); markings.push(spot); }
            ellipsoid(visitor, paint('#c2a26c'), [side * .04, .018, .025], [.012, .025, .028], 10);
        }
        const beak = new T.Mesh(new T.ConeGeometry(.028, .065, 10), paint('#e3b55f')); beak.rotation.x = Math.PI / 2; beak.position.set(0, -.008, .11); head.add(beak); features.push(beak);
        ellipsoid(visitor, paint('#527a73'), [0, .08, -.105], [.06, .024, .095], 12).rotation.x = -.3;
    }
    // The hint is a neutral trace, not a spoiler naming the encounter or its recipe.
    for (const side of [-1, 1]) ellipsoid(cue, paint(kind === 'X1' ? '#fffaf0' : '#e5c988'), [side * .05, 0, 0], [.055, .025, .11], 12).rotation.y = side * .5;
    cue.position.copy(start).add(new T.Vector3(0, kind === 'X1' ? .05 : .25, 0));
    visitor.visible = false; cue.visible = false;
    const mix = (a: T.Vector3, b: T.Vector3, t: number) => {
        const eased = t * t * (3 - 2 * t), p = a.clone().lerp(b, eased);
        p.y += Math.sin(t * Math.PI) * .16; return p;
    };
    return { root, visitor, cue, features, markings, start, water, perch,
        animate(elapsed: number, reduced: boolean) {
            const t = Math.max(0, elapsed), { outboundEnd, waterEnd, returnEnd } = encounterTiming(kind);
            const stage = t < 500 ? 'plant' : t < outboundEnd ? 'outbound' : t < waterEnd ? 'water' : t < returnEnd ? 'return' : 'plant';
            visitor.position.copy(t < 500 ? start : t < outboundEnd ? mix(start, water, (t - 500) / (outboundEnd - 500))
                : t < waterEnd ? water : t < returnEnd ? mix(water, start, (t - waterEnd) / (returnEnd - waterEnd)) : start);
            const direction = stage === 'return' ? start.clone().sub(water) : water.clone().sub(start);
            visitor.rotation.y = Math.atan2(direction.x, direction.z);
            if (head) head.rotation.x = stage === 'water' ? .42 : 0;
            wings.forEach((wing, i) => { wing.rotation.z = (i ? 1 : -1) * (kind === 'X1' ? reduced ? .18 : .18 + Math.sin(t / 130) * .36 : stage === 'outbound' || stage === 'return' ? reduced ? .38 : .4 + Math.sin(t / 110) * .35 : 0); });
            root.updateMatrixWorld(true); return stage;
        }, dispose() {
            const geometry = new Set<T.BufferGeometry>(); root.traverse(o => { if (o instanceof T.Mesh) geometry.add(o.geometry); });
            geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent();
        }
    };
}
