import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIslandExpressionSelection } from '../../../domain/island/expression';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { ExpressionFootTrails, expressionFootContact } from './expressionFootTrails';
import { SharedJobActor } from './sharedJobActor';
import type { ResidentSpecies } from './residentRig';

const species: ResidentSpecies[] = ['otter', 'rabbit', 'fox'];
function fixture() {
    const materials = new IslandMaterials(), scene = new THREE.Scene();
    const residents = species.map((id, i) => new IslandResident(id, materials, [i * 1.5 - 1.5, 0, 2], () => {}));
    const trails = new ExpressionFootTrails(residents); scene.add(trails.group, ...residents.map(resident => resident.group));
    const selection = createIslandExpressionSelection(); species.forEach(id => { selection.residents[id].trail = id === 'rabbit' ? 'water-ring-trail' : 'leaf-trail'; });
    const walking = new Set(species), actors = residents.map(resident => new SharedJobActor(resident));
    return { residents, trails, selection, walking, actors, scene, dispose() { trails.dispose(); residents.forEach(r => r.disposeAppearance()); disposeGeometry(scene); materials.dispose(); } };
}
describe('foot marks come from actual planted feet', () => {
    it('follows real stride contact, keeps 24 fixed slots, expires while idle, and never creates marks from an idle timer', () => {
        const f = fixture(), uuids = f.trails.describe().flatMap(track => track.marks.map(mark => mark.uuid));
        expect(uuids).toHaveLength(24);
        for (let t = 0; t <= 3600; t += 40) {
            f.actors.forEach((actor, i) => actor.walk({ points: [{ x: i * 1.5 - 1.5, z: 2 }, { x: i * 1.5 - 1.5, z: -.6 }], yaw: 0 }, t / 4000, 0, false));
            f.trails.update(f.selection, f.walking, 0, t, true, false);
            f.trails.describe().forEach((track, i) => {
                expect(track.marks.filter(mark => mark.visible).length).toBeLessThanOrEqual(8);
                for (const mark of track.marks.filter(mark => mark.visible && mark.born === t)) {
                    const contact = expressionFootContact(f.residents[i], mark.foot);
                    expect(new THREE.Vector3(...mark.contact).distanceTo(contact)).toBeLessThan(1e-8);
                    expect(mark.position[1] - contact.y).toBeCloseTo(.012); expect(Math.abs(contact.y)).toBeLessThanOrEqual(.024);
                }
            });
        }
        expect(f.trails.describe().some(track => track.marks.some(mark => mark.visible))).toBe(true);
        f.trails.update(f.selection, new Set(), 0, 5000, true, false);
        expect(f.trails.describe().flatMap(track => track.marks).filter(mark => mark.visible)).toHaveLength(0);
        for (let t = 6000; t <= 10000; t += 100) f.trails.update(f.selection, f.walking, 0, t, true, false);
        expect(f.trails.describe().flatMap(track => track.marks).filter(mark => mark.visible)).toHaveLength(0);
        expect(f.trails.describe().flatMap(track => track.marks.map(mark => mark.uuid))).toEqual(uuids); f.dispose();
    });
    it('reduced motion leaves at most two static actual contact marks per resident, including real shortened preview steps', () => {
        const f = fixture();
        for (let t = 0; t < 3000; t += 50) {
            f.actors.forEach((actor, i) => actor.walk({ points: [{ x: i * 1.5 - 1.5, z: 2 }, { x: i * 1.5 - 1.5, z: 1.4 }], yaw: 0 }, (t % 600) / 600, 0, true));
            f.trails.update(f.selection, f.walking, 0, t, true, true);
            for (const track of f.trails.describe()) {
                expect(track.marks.filter(mark => mark.visible).length).toBeLessThanOrEqual(2);
                track.marks.filter(mark => mark.visible).forEach(mark => expect(mark.ringScale).toBe(1));
            }
        }
        expect(f.trails.describe().every(track => track.marks.some(mark => mark.visible))).toBe(true); f.dispose();
    });
    it('removes all marks on lifecycle exit, ignores raised/carried feet and releases only its own resources once', () => {
        const f = fixture();
        f.trails.update(f.selection, f.walking, 0, 0, true, false);
        f.residents.forEach(resident => { resident.group.position.x += .05; });
        f.trails.update(f.selection, f.walking, 0, 50, true, false);
        expect(f.trails.describe().some(track => track.marks.some(mark => mark.visible))).toBe(true);
        f.trails.update(f.selection, f.walking, 0, 60, false, false);
        expect(f.trails.describe().every(track => track.marks.every(mark => !mark.visible))).toBe(true);
        for (let t = 100; t < 1500; t += 30) {
            f.residents.forEach(resident => { resident.group.position.x += .01; resident.group.position.y = .35; });
            f.trails.update(f.selection, f.walking, 0, t, true, false);
        }
        expect(f.trails.describe().every(track => track.marks.every(mark => !mark.visible))).toBe(true);
        const resources = new Set<THREE.BufferGeometry | THREE.Material>();
        f.trails.group.traverse(child => { if (child instanceof THREE.Mesh) { resources.add(child.geometry); resources.add(child.material as THREE.Material); } });
        const counts = new Map<string, number>(); resources.forEach(resource => resource.addEventListener('dispose', () => counts.set(resource.uuid, (counts.get(resource.uuid) ?? 0) + 1)));
        f.trails.dispose(); f.trails.dispose(); expect(counts.size).toBe(resources.size); expect([...counts.values()].every(count => count === 1)).toBe(true); f.dispose();
    });
});
