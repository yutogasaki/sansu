import * as THREE from 'three';
import { WORKSHOP_SPECIMEN_IDS, type WorkshopSpecimenId } from '../../../domain/island/workshop';
import { WORKSHOP_PART_IDS, type WorkshopAnchor, type WorkshopPartId } from '../../../domain/island/workshopLayout';
import { batch, box, curve, cylinder, disposeGeometry, ellipsoid, IslandMaterials, mesh, pole } from './primitives';

// Transfer the island's broad cream/pink/blue masses, grounded forms and
// material-specific detail. Do not transfer UI labels or ambient particles
// onto the specimen: the six removable surfaces are the observation itself.
export const WORKSHOP_CELL_SIZE = 1.08;
export const WORKSHOP_BOARD_Y = .28;
export const workshopAnchorToWorld = (anchor: WorkshopAnchor, y = WORKSHOP_BOARD_Y + .12) =>
    new THREE.Vector3((anchor.col - 1.5) * WORKSHOP_CELL_SIZE, y, (anchor.row - 1.5) * WORKSHOP_CELL_SIZE);
export const WORKSHOP_HOME_POINTS: Record<WorkshopSpecimenId, THREE.Vector3> = {
    driftwood: new THREE.Vector3(-2.35, .32, -1.8), seaglass: new THREE.Vector3(-.6, .32, -1.8), 'striped-shell': new THREE.Vector3(1.15, .32, -1.8),
};
export const WORKSHOP_STATIONS = {
    brush: new THREE.Vector3(-2, .36, .7), lamp: new THREE.Vector3(0, .36, .7), water: new THREE.Vector3(2, .38, .7),
    'shelf-1': new THREE.Vector3(-1.6, .36, -1.05), 'shelf-2': new THREE.Vector3(0, .36, -1.05), 'shelf-3': new THREE.Vector3(1.6, .36, -1.05),
};
export const WORKSHOP_WATER_SURFACE_Y = .93;
export const WORKSHOP_WATER_BOTTOM_Y = .41;
export type WorkshopGeometryHit = { kind: 'specimen' | 'sand'; specimenId: WorkshopSpecimenId; section?: number }
    | { kind: 'part' | 'socket'; partId: WorkshopPartId }
    | { kind: 'station'; station: keyof typeof WORKSHOP_STATIONS }
    | { kind: 'source' };
export const markWorkshopHit = (object: THREE.Object3D, hit: WorkshopGeometryHit) => { object.userData.workshopHit = hit; };
export interface WorkshopSpecimenVisual { group: THREE.Group; patches: THREE.Mesh[]; surfacePoints: THREE.Vector3[] }
export interface WorkshopPartVisual { group: THREE.Group; finished: THREE.Group; frame: THREE.Group; rotor?: THREE.Group; bell?: THREE.Group; insert: THREE.Group }

function ring(parent: THREE.Object3D, material: THREE.Material, center: [number, number, number], radius: number, tube = .018) {
    const result = mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 40), material, center); result.rotation.x = -Math.PI / 2; return result;
}

export function makeWorkshopSpecimen(id: WorkshopSpecimenId, m: IslandMaterials, glass: THREE.Material): WorkshopSpecimenVisual {
    const group = new THREE.Group(); group.name = `workshop-specimen-${id}`; markWorkshopHit(group, { kind: 'specimen', specimenId: id });
    if (id === 'driftwood') {
        ellipsoid(group, m.get('#c89156'), [0, .19, 0], [.66, .2, .3], 18).rotation.y = -.08;
        for (let i = 0; i < 4; i++) {
            const points: [number, number, number][] = [-.55, -.3, 0, .3, .55].map(x => {
                const z = -.13 + i * .085 + Math.sin(x * 5 + i) * .015;
                return [x, .19 + .2 * Math.sqrt(Math.max(0, 1 - (x / .66) ** 2 - (z / .3) ** 2)) + .022, z];
            });
            curve(group, m.get(i % 2 ? '#9b663e' : '#805333'), points, .017);
        }
        for (const x of [-.64, .64]) {
            const end = cylinder(group, m.get('#f1d095'), [x, .18, 0], .16, .04, .16, 20); end.rotation.z = Math.PI / 2;
            const grain = ring(group, m.get('#936643'), [x + Math.sign(x) * .014, .18, 0], .09, .01); grain.rotation.set(0, Math.PI / 2, 0);
        }
    } else if (id === 'seaglass') {
        const body = ellipsoid(group, glass, [0, .26, 0], [.54, .31, .37], 20); body.rotation.z = .22;
        curve(group, m.get('#e0fff2', true), [[-.37, .39, .13], [-.26, .52, .17], [-.05, .54, .16]], .024);
        ellipsoid(group, m.get('#64baa7'), [.14, .23, -.14], [.24, .1, .06], 10);
    } else {
        ellipsoid(group, m.get('#f4d8aa'), [0, .19, 0], [.57, .25, .41], 18);
        for (let i = -3; i <= 3; i++) {
            const points: [number, number, number][] = [-.30, -.16, 0, .17, .30].map(z => {
                const x = i * .105 * (.5 + (z + .3) * 1.1);
                return [x, .19 + .25 * Math.sqrt(Math.max(0, 1 - (x / .57) ** 2 - (z / .41) ** 2)) + .018, z];
            });
            curve(group, m.get(i % 2 ? '#bd789b' : '#98547d'), points, .024);
            ellipsoid(group, m.get('#f8e6bf'), [i * .115, .15, .32 - Math.abs(i) * .025], [.082, .063, .09], 10);
        }
        ellipsoid(group, m.get('#f8e6bf'), [0, .08, .22], [.36, .07, .22], 12);
    }
    const patches: THREE.Mesh[] = [], surfacePoints: THREE.Vector3[] = [];
    for (let section = 0; section < 6; section++) {
        const x = (section % 3 - 1) * .32, z = section < 3 ? -.15 : .15;
        const y = id === 'driftwood' ? .365 - Math.abs(x) * .1 : .465 - Math.abs(x) * .15;
        const patch = ellipsoid(group, m.get(section % 2 ? '#c3ad80' : '#d8c297'), [x, y, z], [.24, .085, .22], 12);
        patch.name = `sand-section-${section}`; markWorkshopHit(patch, { kind: 'sand', specimenId: id, section }); patches.push(patch);
        surfacePoints.push(new THREE.Vector3(x, y + .07, z));
        for (let dot = 0; dot < 3; dot++) {
            const grain = ellipsoid(patch, m.get('#e8d9ad'), [(-.5 + dot * .48), .75, dot % 2 ? .36 : -.3], [.08, .13, .08], 6);
            grain.castShadow = false;
        }
    }
    return { group, patches, surfacePoints };
}

export function makeWorkshopPart(id: WorkshopPartId, m: IslandMaterials): WorkshopPartVisual {
    const group = new THREE.Group(); group.name = `workshop-part-${id}`; markWorkshopHit(group, { kind: 'part', partId: id });
    const finished = new THREE.Group(), frame = new THREE.Group(), insert = new THREE.Group();
    group.add(finished, frame, insert); finished.name = 'assembled-part'; frame.name = 'empty-socket'; insert.name = 'material-insert';
    const wood = m.get('#bb804c'), edge = m.get('#edc483'), dark = m.get('#76523c');
    box(frame, wood, [0, .04, 0], [.88, .09, .84]);
    const socket = ring(frame, m.get('#ffe498'), [0, .1, 0], .22, .055); markWorkshopHit(socket, { kind: 'socket', partId: id });
    const well = box(frame, m.get('#554e5b'), [0, .091, 0], [.23, .007, .23]);
    markWorkshopHit(well, { kind: 'socket', partId: id });
    let rotor: THREE.Group | undefined, bell: THREE.Group | undefined;
    if (id === 'straight' || id === 'elbow') {
        if (id === 'straight') {
            box(finished, wood, [0, .02, 0], [WORKSHOP_CELL_SIZE, .1, .42]);
            for (const z of [-.24, .24]) box(finished, edge, [0, .13, z], [WORKSHOP_CELL_SIZE, .23, .08]);
            for (let i = 0; i < 4; i++) box(finished, dark, [-.38 + i * .25, .078, 0], [.009, .01, .38]);
        } else {
            box(finished, wood, [-.25, .02, 0], [.58, .1, .42]); box(finished, wood, [0, .02, .25], [.42, .1, .58]);
            box(finished, edge, [-.15, .13, -.24], [.8, .23, .08]); box(finished, edge, [.24, .13, .15], [.08, .23, .8]);
            box(finished, edge, [-.4, .13, .24], [.3, .23, .08]); box(finished, edge, [-.24, .13, .4], [.08, .23, .3]);
        }
        box(insert, edge, [0, .15, 0], [.55, .1, .23]);
    } else if (id === 'wheel') {
        box(finished, wood, [0, .01, 0], [.96, .1, .68]);
        for (const x of [-.37, .37]) box(finished, edge, [x, .25, 0], [.08, .5, .16]);
        pole(finished, dark, [-.54, .12, 0], [0, .12, 0], .065);
        pole(finished, m.get('#d0a448'), [0, .3, 0], [.54, .3, 0], .045);
        rotor = new THREE.Group(); rotor.position.set(0, .3, 0); finished.add(rotor);
        for (let i = 0; i < 8; i++) {
            const blade = box(rotor, i % 2 ? wood : edge, [0, Math.cos(i * Math.PI / 4) * .25, Math.sin(i * Math.PI / 4) * .25], [.38, .09, .18]);
            blade.rotation.x = i * Math.PI / 4;
        }
        const rim = mesh(rotor, new THREE.TorusGeometry(.27, .027, 6, 32), dark); rim.rotation.y = Math.PI / 2;
        ellipsoid(rotor, m.surface('#77cbb2', .25), [.215, 0, 0], [.025, .14, .14], 16);
        ellipsoid(insert, m.surface('#77cbb2', .25), [0, .1, 0], [.16, .11, .16], 16);
    } else {
        box(finished, wood, [0, .01, 0], [.84, .1, .7]);
        for (const z of [-.27, .27]) pole(finished, edge, [.08, .05, z], [.08, .67, z], .055);
        pole(finished, edge, [.08, .67, -.29], [.08, .67, .29], .06);
        pole(finished, m.get('#d0a448'), [-.54, .3, 0], [0, .3, 0], .045);
        bell = new THREE.Group(); bell.position.set(.08, .6, 0); finished.add(bell);
        pole(bell, dark, [0, 0, 0], [0, -.15, 0], .017);
        ellipsoid(bell, m.get('#f5d39b'), [0, -.27, 0], [.22, .2, .16], 16);
        for (const x of [-.1, 0, .1]) curve(bell, m.get('#ba7794'), [[x, -.14, .08], [x * 1.4, -.27, .16], [x, -.43, .05]], .02);
        ellipsoid(insert, m.get('#f5d39b'), [0, .1, 0], [.25, .12, .2], 14);
    }
    insert.visible = false;
    return { group, finished, frame, insert, rotor, bell };
}

export function createWorkshopGeometry() {
    const group = new THREE.Group(); group.name = 'island-workshop';
    const observe = new THREE.Group(), build = new THREE.Group(); observe.name = 'specimen-inlet'; build.name = 'construction-inlet'; group.add(observe, build);
    const m = new IslandMaterials(), extra: THREE.Material[] = [];
    const glass = new THREE.MeshPhysicalMaterial({ color: '#289b78', roughness: .23, metalness: 0, transparent: true, opacity: .85, clearcoat: .7 }); extra.push(glass);
    const water = new THREE.MeshStandardMaterial({ color: '#45afe1', transparent: true, opacity: .22, roughness: .22, depthWrite: false }); extra.push(water);
    for (const root of [observe, build]) {
        const ground = new THREE.Group();
        ellipsoid(ground, m.get('#f2d89a'), [0, -.2, 0], [4.35, .24, 3.08], 32);
        ellipsoid(ground, m.get('#84d1c8'), [0, -.38, 0], [4.5, .16, 3.24], 32);
        for (let i = 0; i < 9; i++) ellipsoid(ground, m.get(i % 2 ? '#b46ec1' : '#e898bc'), [-3.9 + i * .94, .03, -2.48], [.24, .18, .2], 10);
        batch(ground, m.painted); root.add(ground);
    }
    box(observe, m.get('#ce995f'), [0, .19, -1.05], [4.65, .17, .76]);
    const stationHits: THREE.Object3D[] = [];
    for (const [station, point] of Object.entries(WORKSHOP_STATIONS)) {
        const pad = cylinder(observe, m.get(station === 'water' ? '#a9dce4' : station === 'lamp' ? '#f1bb68' : station === 'brush' ? '#c2a8d2' : '#e4c291'), [point.x, .25, point.z], station.startsWith('shelf') ? .46 : .8, .12, undefined, 28);
        markWorkshopHit(pad, { kind: 'station', station: station as keyof typeof WORKSHOP_STATIONS }); stationHits.push(pad);
        if (station.startsWith('shelf')) ring(observe, m.get('#fff0c4'), [point.x, .318, point.z], .42, .025);
    }
    const basin = new THREE.Group(); basin.position.copy(WORKSHOP_STATIONS.water); observe.add(basin);
    cylinder(basin, m.get('#f1e7c6'), [0, .015, 0], .72, .065, .72, 32);
    const basinGlass = new THREE.MeshPhysicalMaterial({ color: '#b6e3e3', transparent: true, opacity: .19, roughness: .16,
        clearcoat: .9, depthWrite: false, side: THREE.DoubleSide }); extra.push(basinGlass);
    mesh(basin, new THREE.CylinderGeometry(.74, .74, .53, 40, 1, true), basinGlass, [0, .28, 0]);
    ring(basin, m.get('#c78dac'), [0, .55, 0], .75, .075);
    ring(basin, m.get('#69c5d1'), [0, .055, 0], .73, .027);
    for (const y of [.15, .29, .43]) curve(basin, m.get('#f6fff6', true), [[.57, y, .46], [.62, y, .41], [.66, y, .34]], .016);
    cylinder(basin, water, [0, WORKSHOP_WATER_SURFACE_Y - WORKSHOP_STATIONS.water.y, 0], .71, .018, .71, 40);
    ring(basin, m.get('#d4fff6', true), [0, .545, 0], .69, .017);
    const brush = new THREE.Group(); observe.add(brush); brush.visible = false;
    box(brush, m.get('#ca8449'), [0, .15, 0], [.15, .36, .16]);
    for (let i = 0; i < 6; i++) pole(brush, m.get('#f4ddb0'), [(i % 3 - 1) * .045, -.015, (i < 3 ? -.035 : .035)], [(i % 3 - 1) * .05, -.14, i < 3 ? -.04 : .04], .019);
    const lamp = new THREE.Group(); lamp.position.set(-.78, .33, .48); observe.add(lamp);
    box(observe, m.get('#ad8156'), [.12, .278, .88], [2.14, .045, 1.7]);
    box(observe, m.get('#f4e9ce'), [.12, .3, .88], [2.08, .06, 1.64]);
    cylinder(lamp, m.get('#705098'), [0, .03, 0], .21, .075); pole(lamp, m.get('#6c548e'), [0, .06, 0], [0, .76, 0], .04);
    ellipsoid(lamp, m.get('#ffd964'), [.08, .75, 0], [.24, .19, .21], 16);
    const shade = mesh(lamp, new THREE.ConeGeometry(.24, .34, 16, 1, true), m.get('#f2bd58'), [.20, .66, .09]);
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-.7, .6, -.25).normalize());
    const lampTip = new THREE.Vector3(-.61, 1.06, .52);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff9df', transparent: true, opacity: .72, depthWrite: false }); extra.push(beamMat);
    const beam = mesh(observe, new THREE.CylinderGeometry(.09, .21, 1, 16), beamMat); beam.visible = false; beam.castShadow = false;
    const coloredMat = new THREE.MeshBasicMaterial({ color: '#39b889', transparent: true, opacity: .62, depthWrite: false }); extra.push(coloredMat);
    const transmittedBeam = mesh(observe, new THREE.CylinderGeometry(.11, .28, 1, 12), coloredMat); transmittedBeam.visible = false;
    const shadowMat = new THREE.MeshBasicMaterial({ color: '#493d5e', transparent: true, opacity: .65, depthWrite: false }); extra.push(shadowMat);
    const shadow = ellipsoid(observe, shadowMat, [0, .329, 0], [.43, .008, .3], 20); shadow.visible = false; shadow.castShadow = false;
    const lightPool = ellipsoid(observe, coloredMat, [0, .33, 0], [.46, .009, .32], 20); lightPool.visible = false; lightPool.castShadow = false;
    const ripple = ring(observe, m.get('#e0fff3', true), [2, WORKSHOP_WATER_SURFACE_Y + .02, .7], .45, .019); ripple.visible = false;
    const selection = ring(observe, m.get('#fff0a3', true), [0, .1, 0], .75, .035); selection.visible = false;
    const specimens = Object.fromEntries(WORKSHOP_SPECIMEN_IDS.map(id => {
        const visual = makeWorkshopSpecimen(id, m, glass); observe.add(visual.group); return [id, visual];
    })) as Record<WorkshopSpecimenId, WorkshopSpecimenVisual>;
    const board = new THREE.Group(); build.add(board);
    box(board, m.get('#87638f'), [0, .12, 0], [4.52, .22, 4.52]); box(board, m.get('#a8c7ba'), [0, .25, 0], [4.42, .055, 4.42]);
    for (let n = 0; n <= 4; n++) {
        const pos = (n - 2) * WORKSHOP_CELL_SIZE;
        box(board, m.get('#698e8c'), [pos, .283, 0], [.018, .008, 4.32]); box(board, m.get('#698e8c'), [0, .283, pos], [4.32, .008, .018]);
    }
    batch(board, m.painted);
    const parts = Object.fromEntries(WORKSHOP_PART_IDS.map(id => { const part = makeWorkshopPart(id, m); build.add(part.group); return [id, part]; })) as Record<WorkshopPartId, WorkshopPartVisual>;
    const source = new THREE.Group(); source.position.copy(workshopAnchorToWorld({ col: -1, row: 1 }, .28)); build.add(source); markWorkshopHit(source, { kind: 'source' });
    cylinder(source, m.get('#a279b2'), [0, .22, 0], .31, .4, .36, 24); cylinder(source, water, [0, .43, 0], .31, .015, .31, 28);
    pole(source, m.get('#cca668'), [0, .3, 0], [.54, .13, 0], .07);
    const handle = new THREE.Group(); handle.position.set(-.05, .58, .2); source.add(handle);
    pole(handle, m.get('#805235'), [0, 0, 0], [0, .23, 0], .035); pole(handle, m.get('#e9ba77'), [-.13, .23, 0], [.13, .23, 0], .045);
    const sourceHandle = source.position.clone().add(handle.position).add(new THREE.Vector3(0, .23, 0));
    const flow = ellipsoid(build, m.get('#80e2de', true), [0, 0, 0], [.095, .055, .085], 12); flow.visible = false; flow.castShadow = false;
    const trail = mesh(build, new THREE.CylinderGeometry(.035, .035, 1, 10), m.get('#67c8d4', true)); trail.visible = false; trail.castShadow = false;
    const partSelection = ring(build, m.get('#fff0a3', true), [0, .295, 0], .46, .025); partSelection.visible = false;
    const previewMat = new THREE.MeshBasicMaterial({ color: '#58b687', transparent: true, opacity: .3, depthWrite: false }); extra.push(previewMat);
    const preview = box(build, previewMat, [0, .292, 0], [1.04, .01, 1.04]); preview.visible = false; preview.castShadow = false;
    let disposed = false;
    return { group, observe, build, specimens, parts, brush, lamp, lampTip, beam, transmittedBeam, shadow, lightPool, ripple, selection,
        source, handle, sourceHandle, flow, trail, partSelection, preview, previewMat, stationHits,
        dispose() { if (disposed) return; disposed = true; group.removeFromParent(); disposeGeometry(group); m.dispose(); extra.forEach(material => material.dispose()); } };
}
