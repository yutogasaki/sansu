import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { makePokomokoRig } from '../three/islandCharacters';
import type { Species, Villager } from '../../../domain/growingIsland';
import { disposeActor, makeVillagerActor, wrapPokomoko, type Actor } from './actors';
import { actorFootMinY, actorSeatContact, actorSeatSurface, actorSurfaceY, alignActorContact, alignActorOnSeat, resetActorVisualContact, setActorVisualScale } from './actorScale';
import { buildLifeItem } from '../life/itemGeometry';
import { buildBoat } from './pierGeometry';

const villager = (species: Species, accessory = 2, sparkle = false): Villager => ({ id: `scale-${species}`, species, home: 'pokomoko', arrivedAt: 0,
    trait: 'mellow', variant: { color: 2, accessory, sparkle } });
function hero(m: IslandMaterials) { const rig = makePokomokoRig(m); return wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet); }
const box = (actor: Actor) => { actor.root.updateWorldMatrix(true, true); return new T.Box3().setFromObject(actor.root, true); };

describe('authored visual units inside actor world anchors', () => {
    it.each(['pokomoko', 'rabbit', 'fox', 'otter'] as const)('keeps every %s source mesh/local pose and restores exact legacy dimensions', species => {
        const m = new IslandMaterials('moon-garden'), actor = species === 'pokomoko' ? hero(m) : makeVillagerActor(m, villager(species, 2, true));
        actor.root.position.set(4, 3, -8); actor.root.rotation.y = .37;
        const rootPosition = actor.root.position.clone(), rootRotation = actor.root.rotation.clone(), before = box(actor).getSize(new T.Vector3());
        const nodes: { node: T.Object3D; position: number[]; quaternion: number[]; scale: number[]; geometry?: T.BufferGeometry; material?: T.Material | T.Material[] }[] = [];
        actor.visual!.traverse(node => { if (node !== actor.visual) nodes.push({ node, position: node.position.toArray(), quaternion: node.quaternion.toArray(), scale: node.scale.toArray(),
            ...(node instanceof T.Mesh ? { geometry: node.geometry, material: node.material } : {}) }); });
        try {
            setActorVisualScale(actor, .45);
            const after = box(actor).getSize(new T.Vector3());
            after.toArray().forEach((value, i) => expect(value).toBeCloseTo(before.toArray()[i] * .45, 8));
            expect(actor.root.position).toEqual(rootPosition); expect(actor.root.rotation.toArray()).toEqual(rootRotation.toArray());
            expect(actor.root.scale.toArray()).toEqual([1, 1, 1]);
            nodes.forEach(({ node, position, quaternion, scale, geometry, material }) => {
                expect(node.position.toArray()).toEqual(position); expect(node.quaternion.toArray()).toEqual(quaternion); expect(node.scale.toArray()).toEqual(scale);
                if (node instanceof T.Mesh) { expect(node.geometry).toBe(geometry); expect(node.material).toBe(material); }
            });
            expect(actor.visual!.children[0].scale.toArray()).toEqual([.7, .7, .7]);
            setActorVisualScale(actor, 1);
            expect(box(actor).getSize(new T.Vector3()).toArray()).toEqual(before.toArray());
        } finally { disposeActor(actor); m.dispose(); }
    });

    it.each(['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'penguin', 'owl', 'girl', 'boy'] satisfies Species[])('puts actual posed %s sole vertices on a fixed ground without moving its world root', species => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager(species), .45);
        actor.root.position.set(9, 2.4, -5); actor.root.rotation.set(-.28, .83, .12);
        actor.body.rotation.x = -.31; actor.feet.forEach((foot, i) => { foot.rotation.x = i ? .47 : -.47; });
        const at = actor.root.position.clone(), angles = actor.root.quaternion.clone();
        try {
            const beforeXZ = actor.feet.map(foot => foot.getWorldPosition(new T.Vector3()).toArray().filter((_, i) => i !== 1));
            expect(alignActorContact(actor, 2.36)).toBe(true);
            expect(actorFootMinY(actor)).toBeCloseTo(2.36, 10);
            const min = Math.min(...actor.feet.map(foot => new T.Box3().setFromObject(foot, true).min.y));
            expect(min).toBeCloseTo(2.36, 10);
            expect(actor.root.position).toEqual(at); expect(actor.root.quaternion.toArray()).toEqual(angles.toArray());
            actor.feet.forEach((foot, i) => foot.getWorldPosition(new T.Vector3()).toArray().filter((_, axis) => axis !== 1)
                .forEach((value, axis) => expect(value).toBeCloseTo(beforeXZ[i][axis], 10)));
            resetActorVisualContact(actor); expect(actor.visual!.position.toArray()).toEqual([0, 0, 0]);
        } finally { disposeActor(actor); m.dispose(); }
    });

    it.each(['bench', 'swing', 'picnic-table'] as const)('uses the actual %s seat, never its beam/table, without feet penetrating the seat slab', kind => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('rabbit'), .45);
        const model = buildLifeItem({ id: 'seat', kind, growth: 0, style: 'original' }, m).root;
        model.position.set(4, 1.5, -8); actor.root.position.set(4, 1.7, -8);
        const neutral = actor.feet.map(foot => foot.position.toArray());
        try {
            const seat = actorSeatSurface(model, kind === 'bench' ? 'sit' : kind === 'swing' ? 'swing' : 'eat')!;
            expect(seat).toBeDefined(); expect(actorSurfaceY(seat, seat.getWorldPosition(new T.Vector3()))).toBeCloseTo(kind === 'swing' ? 1.82 : 1.84, 6);
            alignActorOnSeat(actor, seat, 1.5);
            const contact = actorSeatContact(actor)!;
            expect(contact.y).toBeCloseTo(actorSurfaceY(seat, contact)!, 10);
            const inverse = seat.matrixWorld.clone().invert(), top = seat.geometry.boundingBox!.max.y;
            for (const foot of actor.feet) foot.traverse(node => {
                if (!(node instanceof T.Mesh)) return;
                const positions = node.geometry.getAttribute('position'), transform = inverse.clone().multiply(node.matrixWorld), point = new T.Vector3();
                for (let i = 0; i < positions.count; i++) expect(point.fromBufferAttribute(positions, i).applyMatrix4(transform).y).toBeGreaterThan(top);
            });
            expect(actor.root.position.toArray()).toEqual([4, 1.7, -8]); expect(model.scale.toArray()).toEqual([1, 1, 1]);
            setActorVisualScale(actor, 1); expect(actor.feet.map(foot => foot.position.toArray())).toEqual(neutral);
        } finally { disposeActor(actor); m.dispose(); }
    });

    it.each(['rabbit', 'girl', 'boy'] satisfies Species[])('hands the %s perched feet continuously back to neutral ground during seat exit', species => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager(species), .45);
        const model = buildLifeItem({ id: 'seat', kind: 'bench', growth: 0, style: 'original' }, m).root;
        const seat = actorSeatSurface(model, 'sit')!, neutral = actor.feet.map(foot => foot.position.clone());
        try {
            const soleYs: number[] = [];
            for (const weight of [1, .5, .1, .01, .001, 0]) {
                resetActorVisualContact(actor); alignActorOnSeat(actor, seat, 0, 0, weight);
                soleYs.push(actorFootMinY(actor)!);
                if (weight <= .01) actor.feet.forEach((foot, i) => expect(foot.position.distanceTo(neutral[i])).toBeLessThan(weight * 1.2 + 1e-10));
            }
            expect(soleYs[0]).toBeCloseTo(.341, 6);
            for (let i = 1; i < soleYs.length; i++) expect(soleYs[i]).toBeLessThan(soleYs[i - 1]);
            expect(soleYs.at(-2)).toBeLessThan(.001); expect(soleYs.at(-1)).toBeCloseTo(0, 8);
            expect(actor.feet.map(foot => foot.position.toArray())).toEqual(neutral.map(point => point.toArray()));
        } finally { disposeActor(actor); m.dispose(); }
    });

    it('matches the actual bench torso contact and boat deck, retaining their world dimensions', () => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('rabbit'), .45);
        const bench = buildLifeItem({ id: 'seat', kind: 'bench', growth: 0, style: 'original' }, m).root;
        bench.position.set(4, 1.5, -8); const boat = buildBoat(m); boat.position.set(9, -.16, 2);
        actor.root.position.set(4, 1.7, -8); actor.root.rotation.x = -.24; actor.body.rotation.x = -.38;
        actor.feet.forEach(foot => { foot.rotation.x = .5; });
        try {
            const contact = actorSeatContact(actor)!;
            expect(contact).toBeDefined();
            const seatY = actorSurfaceY(bench, contact)!;
            expect(seatY).toBeCloseTo(1.84, 6);
            expect(alignActorContact(actor, 1.5, seatY, 1)).toBe(true);
            expect(actorSeatContact(actor)!.y).toBeCloseTo(seatY, 10);
            expect(actor.root.position.toArray()).toEqual([4, 1.7, -8]);
            resetActorVisualContact(actor); actor.root.position.copy(boat.position).add(new T.Vector3(0, .12, 0)); actor.root.rotation.set(0, -.7, 0);
            const deckY = actorSurfaceY(boat, actor.root.position)!;
            // The existing closed hull is higher than the inset cylinder deck.
            expect(deckY).toBeCloseTo(.05, 6);
            alignActorContact(actor, deckY);
            expect(actorFootMinY(actor)).toBeCloseTo(deckY, 10);
            expect(boat.position.toArray()).toEqual([9, -.16, 2]); expect(bench.scale.toArray()).toEqual([1, 1, 1]);
        } finally { disposeActor(actor); m.dispose(); }
    });

    it('does not manufacture contact for an empty actor or accumulate wrappers/resources across scale changes', () => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('fox', 3, true));
        const geometries = new Set<T.BufferGeometry>(); actor.root.traverse(node => { if (node instanceof T.Mesh) geometries.add(node.geometry); });
        const disposal = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
        const sparkle = actor.sparkle as T.Mesh, sparkleDispose = vi.spyOn(sparkle.material as T.Material, 'dispose');
        try {
            const visual = actor.visual;
            for (let i = 0; i < 20; i++) setActorVisualScale(actor, i % 2 ? 1 : .45);
            expect(actor.visual).toBe(visual); expect(actor.root.children).toEqual([visual]);
            expect(disposal.every(spy => spy.mock.calls.length === 0)).toBe(true);
            disposeActor(actor); disposeActor(actor);
            expect(disposal.every(spy => spy.mock.calls.length === 1)).toBe(true); expect(sparkleDispose).toHaveBeenCalledTimes(1);
            const empty: Actor = { id: 'empty', root: new T.Group(), body: new T.Group(), feet: [] };
            setActorVisualScale(empty, .45); expect(alignActorContact(empty, 2)).toBe(false);
            expect(() => setActorVisualScale(empty, Number.NaN)).toThrow();
            disposeActor(empty);
        } finally { disposeActor(actor); m.dispose(); }
    });
});
