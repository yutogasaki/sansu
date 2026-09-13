import * as T from 'three';
import { evaluateDiscovery, type RuleEligibility } from '../../../domain/islandLife/discovery';
import type { LifeState } from '../../../domain/islandLife/model';
const priority: Record<string, number> = { G0: 0, GF3: 1, GF6: 2, GP2: 1, GP3: 2, GT3: 1, GT6: 2, GW2: 1 };
export function displayedGatherings(state: LifeState, profileId: string) {
    const rules = evaluateDiscovery(state, profileId).filter(rule => rule.ruleId in priority);
    return rules.filter(rule => !rules.some(other => priority[other.ruleId] > priority[rule.ruleId]
        && rule.participantIds.every(id => other.participantIds.includes(id))));
}

/** Test the actual rendered meshes and connecting ground, including DOM covers.
 * A rule match, an invisible mesh or a clipped group is never visual evidence. */
export function gatheringVisible(state: LifeState, rule: RuleEligibility, root: T.Object3D, camera: T.Camera,
    point: (cell: { x: number; z: number }) => T.Vector3, onScreen: (ndc: T.Vector3) => boolean, diagnostic?: (reason: string) => void) {
    const reject = (reason: string) => { diagnostic?.(reason); return false; };
    const ray = new T.Raycaster();
    const visible = (object: T.Object3D) => {
        for (let current: T.Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
        return true;
    };
    const hitAt = (sample: T.Vector3, target: T.Object3D) => {
        const ndc = sample.clone().project(camera);
        if (Math.abs(ndc.x) > .99 || Math.abs(ndc.y) > .99 || Math.abs(ndc.z) > 1 || !onScreen(ndc)) return false;
        ray.setFromCamera(new T.Vector2(ndc.x, ndc.y), camera);
        const hit = ray.intersectObject(root, true).find(hit => {
            const materials = (hit.object as T.Mesh).material;
            return visible(hit.object) && materials && (Array.isArray(materials) ? materials : [materials])
                .some(material => material.visible && (!material.transparent || material.opacity >= .6));
        });
        for (let object = hit?.object; object; object = object.parent ?? undefined) if (object === target) return true;
        return false;
    };
    const ground = root.getObjectByName(rule.ruleId === 'G0' ? 'life-young-plant-ground' : ['GT3', 'GT6', 'GW2'].includes(rule.ruleId) ? 'life-extended-ground' : 'life-district-ground');
    if (!ground || !visible(ground)) return reject('ground');
    const grove = ['GT3', 'GT6'].includes(rule.ruleId);
    const joins = new Map<string, string[]>();
    const sandGroup = state.items.some(i => i.kind === 'sandbox' && rule.participantIds.includes(i.id));
    const joinSamples = sandGroup ? [0, -.3, .3, -.43, .43, -.53, .53] : grove ? [0, -.3, .3, -.42, .42, -.54, .54] : [0, -.3, .3, -.42, .42];
    const items = rule.participantIds.map(id => state.items.find(item => item.id === id));
    for (const item of items) {
        if (!item?.cell) return reject('item-missing');
        const object = root.getObjectByName(`life-item-${item.id}`); if (!object || !visible(object)) return reject(`item-hidden:${item.id}`);
        const box = new T.Box3().setFromObject(object); if (box.isEmpty()) return reject(`item-empty:${item.id}`);
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const ndc = new T.Vector3(x, y, z).project(camera);
            if (Math.abs(ndc.x) > .99 || Math.abs(ndc.y) > .99 || Math.abs(ndc.z) > 1) return reject(`item-clipped:${item.id}`);
        }
        const samples: T.Vector3[] = [];
        object.traverse(part => { if (part instanceof T.Mesh && visible(part)) {
            const center = new T.Box3().setFromObject(part).getCenter(new T.Vector3());
            if (center.y > box.min.y + (box.max.y - box.min.y) * .3) samples.push(center);
        } });
        const water = object.getObjectByName('life-bowl-water');
        if (water) for (const [x, y] of [[.2, 0], [-.2, 0], [0, .2], [0, -.2], [.14, .14], [-.14, .14]]) samples.push(water.localToWorld(new T.Vector3(x, y, 0)));
        if (!samples.some(sample => hitAt(sample, object))) return reject(`item-occluded:${item.id}`);
        const center = point(item.cell);
        const edge = item.kind === 'sandbox' ? .53 : .43;
        if (![[edge, edge], [-edge, edge], [edge, -edge], [-edge, -edge], [0, edge], [0, -edge], [edge, 0], [-edge, 0]].some(([x, z]) => hitAt(new T.Vector3(center.x + x, .065, center.z + z), ground))) return reject(`soil-occluded:${item.id}`);
        for (const other of items) {
            if (!other?.cell || other.id <= item.id) continue;
            const dx = other.cell.x - item.cell.x, dz = other.cell.z - item.cell.z;
            if (Math.abs(dx) + Math.abs(dz) !== 1) continue;
            const joined = joinSamples.some(offset => hitAt(new T.Vector3(center.x + dx * .5 + dz * offset, .065, center.z + dz * .5 + dx * offset), ground));
            if (!joined && !grove) return reject(`join-occluded:${item.id}:${other.id}`);
            if (joined) {
                joins.set(item.id, [...(joins.get(item.id) ?? []), other.id]);
                joins.set(other.id, [...(joins.get(other.id) ?? []), item.id]);
            }
        }
    }
    // Crowns may hide a redundant inner edge. Every tree and its shade must
    // still be visible, connected through actual ray-tested ground edges.
    if (grove) {
        const reached = new Set<string>(), pending = [rule.participantIds[0]];
        while (pending.length) {
            const id = pending.pop()!; if (reached.has(id)) continue;
            reached.add(id); pending.push(...(joins.get(id) ?? []).filter(next => !reached.has(next)));
        }
        if (reached.size !== items.length) return reject('grove-visible-ground-disconnected');
    }
    if (rule.ruleId === 'GW2') {
        let comparing = false;
        root.traverse(object => {
            const look = object.userData.waterLook;
            if (!look?.ready || !rule.participantIds.includes(look.itemId) || !rule.participantIds.includes(look.targetId)) return;
            const bounds = new T.Box3().setFromObject(object);
            if (!bounds.isEmpty() && hitAt(bounds.getCenter(new T.Vector3()), object)) comparing = true;
        });
        if (!comparing) return reject('water-comparison-not-visible');
    }
    return items.length >= 2;
}
