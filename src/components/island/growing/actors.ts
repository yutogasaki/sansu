import * as T from 'three';
import { isKid } from '../../../domain/growingIsland/rules';
import { makeFriendRig } from './friendRig';
import { wonder } from './wonderPaint';
import type { IslandMaterials } from '../three/primitives';
import type { Villager } from '../../../domain/growingIsland';
import { buildSparkle } from './pierGeometry';

/** Accessory colours tell same-species friends apart (spec 52 §7.1). */
export const ACCENT_COLORS = ['#d77a86', '#5f9ec4', '#e0b454', '#78a86a', '#9a7cc4', '#e59a58'] as const;

export interface Actor {
    id: string;
    root: T.Group;
    body: T.Object3D;
    feet: T.Object3D[];
    sparkle?: T.Object3D;
    /** Shoulder pivots for waving; Pokomoko keeps its own established rig and has none here. */
    arms?: T.Object3D[];
    trait?: Villager['trait'];
}

type Rig = ReturnType<typeof makeFriendRig>;

function accessory(rig: Rig, m: IslandMaterials, villager: Villager) {
    // A sparkling (rare) friend's item is dotted: a small wonder in Pokomoko's lineage.
    const color = villager.variant.sparkle ? wonder('dots-red') : m.surface(ACCENT_COLORS[(villager.outfit?.color ?? villager.variant.color) % ACCENT_COLORS.length], .7);
    const group = new T.Group(); group.name = 'growing-accessory';
    const hat = villager.outfit?.hat;
    if (hat) { rig.head.add(buildHat(m, hat, rig.headTop)); return; }
    // えま and えいた wear their own clothes; animals tell each other apart by a small item.
    if (isKid(villager.species)) return;
    const kind = villager.variant.accessory % 4, top = rig.headTop;
    if (kind === 0) {
        for (const side of [-1, 1]) {
            const loop = new T.Mesh(new T.SphereGeometry(.07, 10, 8), color);
            loop.scale.set(1.2, .7, .5); loop.position.set(side * .07, top, .05); group.add(loop);
        }
        rig.head.add(group);
    } else if (kind === 1) {
        const cap = new T.Mesh(new T.CylinderGeometry(.13, .17, .1, 14), color);
        cap.position.set(0, top, 0); group.add(cap); rig.head.add(group);
    } else if (kind === 2) {
        const scarf = new T.Mesh(new T.TorusGeometry(.2, .04, 8, 20), color);
        scarf.rotation.x = Math.PI / 2; scarf.position.set(0, rig.head.position.y - .24, .02); group.add(scarf); rig.body.add(group);
    } else {
        const bag = new T.Mesh(new T.BoxGeometry(.14, .14, .08), color);
        bag.position.set(.24, .42, .12); group.add(bag); rig.body.add(group);
    }
}

/** Island Lv9 hats (§8): straw hat, beret, flower crown, knit cap, little crown. */
export function buildHat(m: IslandMaterials, hat: number, top: number) {
    const group = new T.Group(); group.name = 'growing-hat'; group.position.y = top - .04;
    const add = (geometry: T.BufferGeometry, color: string, y: number, scale?: [number, number, number]) => {
        const piece = new T.Mesh(geometry, m.surface(color, .75)); piece.position.y = y; if (scale) piece.scale.set(...scale); group.add(piece); return piece;
    };
    if (hat === 1) { add(new T.CylinderGeometry(.3, .3, .02, 20), '#e8c878', 0); add(new T.CylinderGeometry(.15, .17, .12, 16), '#e8c878', .06); add(new T.CylinderGeometry(.172, .172, .03, 16), '#d77a86', .02); }
    else if (hat === 2) add(new T.SphereGeometry(.2, 16, 10), '#9a3f4f', .04, [1, .35, 1]);
    else if (hat === 3) for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2, flower = add(new T.SphereGeometry(.045, 8, 6), ['#f6c6d4', '#fff1b0', '#b9d9ef'][i % 3], .02);
        flower.position.x = Math.cos(a) * .18; flower.position.z = Math.sin(a) * .18;
    }
    else if (hat === 4) { add(new T.SphereGeometry(.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#5f9ec4', -.02); add(new T.SphereGeometry(.05, 8, 6), '#f3ecdc', .2); }
    else { add(new T.CylinderGeometry(.13, .12, .1, 5), '#f0cf6a', .05); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, point = add(new T.ConeGeometry(.03, .07, 6), '#f0cf6a', .12); point.position.x = Math.cos(a) * .11; point.position.z = Math.sin(a) * .11; } }
    group.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return group;
}

export function makeVillagerActor(m: IslandMaterials, villager: Villager): Actor {
    const clothes = isKid(villager.species) && villager.outfit?.color !== undefined ? ACCENT_COLORS[villager.outfit.color] : undefined;
    const rig = makeFriendRig(villager.species, m, clothes);
    accessory(rig, m, villager);
    const root = new T.Group(); root.name = `growing-villager-${villager.id}`; root.userData.actorId = villager.id;
    rig.pose.scale.setScalar(.7); root.add(rig.pose);
    let sparkle: T.Object3D | undefined;
    if (villager.variant.sparkle) { sparkle = buildSparkle(); sparkle.position.set(0, 1.25, 0); root.add(sparkle); }
    root.traverse(o => { o.userData.actorId = villager.id; });
    return { id: villager.id, root, body: rig.body, feet: rig.feet, sparkle, arms: rig.arms, trait: villager.trait };
}

export function wrapPokomoko(hero: T.Group, heroBody: T.Object3D, heroFeet: T.Object3D[]): Actor {
    const root = new T.Group(); root.name = 'growing-pokomoko';
    hero.removeFromParent(); hero.position.set(0, 0, 0); hero.scale.setScalar(.7); root.add(hero);
    root.traverse(o => { o.userData.actorId = 'pokomoko'; });
    return { id: 'pokomoko', root, body: heroBody, feet: heroFeet };
}
