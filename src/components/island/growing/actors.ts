import * as T from 'three';
import { makeResidentRig, type ResidentSpecies } from '../three/residentRig';
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
}

const RIG_SPECIES: Record<Villager['species'], ResidentSpecies> = {
    rabbit: 'rabbit', otter: 'otter', fox: 'fox',
    // Friends without art yet never sail in (AVAILABLE_SPECIES); these keep old saves drawable.
    duck: 'otter', squirrel: 'fox', hedgehog: 'rabbit', bird: 'rabbit',
};

function accessory(rig: ReturnType<typeof makeResidentRig>, m: IslandMaterials, villager: Villager) {
    const color = m.surface(ACCENT_COLORS[villager.variant.color % ACCENT_COLORS.length], .7);
    const kind = villager.variant.accessory % 4;
    const group = new T.Group(); group.name = 'growing-accessory';
    if (kind === 0) {
        // A bow on the head.
        for (const side of [-1, 1]) {
            const loop = new T.Mesh(new T.SphereGeometry(.07, 10, 8), color);
            loop.scale.set(1.2, .7, .5); loop.position.set(side * .07, .3, .05); group.add(loop);
        }
        rig.head.add(group);
    } else if (kind === 1) {
        const hat = new T.Mesh(new T.CylinderGeometry(.16, .2, .12, 14), color);
        hat.position.set(0, .3, 0); group.add(hat); rig.head.add(group);
    } else if (kind === 2) {
        const scarf = new T.Mesh(new T.TorusGeometry(.2, .04, 8, 20), color);
        scarf.rotation.x = Math.PI / 2; scarf.position.set(0, .72, .02); group.add(scarf); rig.body.add(group);
    } else {
        const bag = new T.Mesh(new T.BoxGeometry(.14, .14, .08), color);
        bag.position.set(.26, .42, .12); group.add(bag); rig.body.add(group);
    }
}

export function makeVillagerActor(m: IslandMaterials, villager: Villager): Actor {
    const rig = makeResidentRig(RIG_SPECIES[villager.species], m, 'natural');
    accessory(rig, m, villager);
    const root = new T.Group(); root.name = `growing-villager-${villager.id}`; root.userData.actorId = villager.id;
    rig.pose.scale.setScalar(.7); root.add(rig.pose);
    let sparkle: T.Object3D | undefined;
    if (villager.variant.sparkle) { sparkle = buildSparkle(); sparkle.position.set(0, 1.25, 0); root.add(sparkle); }
    root.traverse(o => { o.userData.actorId = villager.id; });
    return { id: villager.id, root, body: rig.body, feet: rig.feet, sparkle };
}

export function wrapPokomoko(hero: T.Group, heroBody: T.Object3D, heroFeet: T.Object3D[]): Actor {
    const root = new T.Group(); root.name = 'growing-pokomoko';
    hero.removeFromParent(); hero.position.set(0, 0, 0); hero.scale.setScalar(.7); root.add(hero);
    root.traverse(o => { o.userData.actorId = 'pokomoko'; });
    return { id: 'pokomoko', root, body: heroBody, feet: heroFeet };
}
