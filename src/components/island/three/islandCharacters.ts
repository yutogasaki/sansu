import * as T from 'three';
import { applyFabricPanel } from './residentFabric';
import { IslandMaterials, ellipsoid, disposeGeometry } from './primitives';
import { makeResidentRig } from './residentRig';

/** Original Pokomoko meshes shared by the island, house and learning actor. */
export function makePokomokoRig(m: IslandMaterials) {
    const wall = m.surface('#fff0d4', .8);
    const paint = (hex: string) => m.surface(hex, .8);
    const hero = new T.Group(), heroBody = new T.Group(); hero.name = 'pokomoko'; hero.add(heroBody);
    const fabric = (panel: Parameters<typeof applyFabricPanel>[1], position: [number,number,number], scale: [number,number,number]) =>
        applyFabricPanel(ellipsoid(heroBody, wall, position, scale, 32), panel, m.residentFabric());
    fabric('body', [0,.43,0],[.24,.30,.20]);
    fabric('head', [0,.88,0],[.34,.30,.27]);
    for (const side of [-1,1]) {
        fabric(side < 0 ? 'navyDots' : 'roseDots',[side*.27,1.12,-.015],[.125,.135,.08]);
        fabric(side < 0 ? 'tealDots' : 'roseDots',[side*.27,.46,.025],[.095,.18,.095]);
        ellipsoid(heroBody,m.surface('#252535',.25),[side*.12,.90,.249],[.035,.041,.025]);
        ellipsoid(heroBody,wall,[side*.11,.913,.269],[.009,.012,.008]);
    }
    fabric('cream',[0,.77,.25],[.16,.095,.065]);
    ellipsoid(heroBody,m.surface('#282333',.32),[0,.79,.31],[.044,.029,.023]);
    const mouth = new T.Mesh(new T.TorusGeometry(.041,.007,6,16,Math.PI),paint('#34293c'));
    mouth.rotation.z=Math.PI; mouth.position.set(0,.748,.31); heroBody.add(mouth);
    const heroFeet = [-1,1].map(side => applyFabricPanel(ellipsoid(hero,wall,[side*.12,.10,.09],[.10,.10,.14],24),side<0?'cream':'roseDots',m.residentFabric()));
    return { hero, heroBody, heroFeet };
}

/** Owns the shared materials and character geometry, without prototype scenery. */
export function buildIslandCharacters(options: { naturalOtter?: boolean } = {}) {
    const world = new T.Group(), m = new IslandMaterials('moon-garden');
    const rig = makePokomokoRig(m);
    const rabbit = makeResidentRig('rabbit', m), otter = makeResidentRig('otter', m, options.naturalOtter ? 'natural' : undefined);
    rabbit.pose.scale.setScalar(.7); otter.pose.scale.setScalar(.7);
    world.add(rig.hero, rabbit.pose, otter.pose);
    return { world, m, ...rig, rabbit, otter,
        dispose: () => { disposeGeometry(world); m.dispose(); } };
}
