import * as T from 'three';
import type { LifeState } from '../../../../domain/islandLife/model';
import { evaluateDiscovery } from '../../../../domain/islandLife/discovery';
import { createDiscoveryScene, type DiscoveryScene, type PresentationEvidence } from '../../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../../domain/islandLife/discoveryPresentation';
import { waterSurfacePoint } from '../../../../domain/islandLife/waterMagic';
import { buildWaterMagic, WATER_MAGIC_MS, WATER_RIPPLE_MS, WATER_RETRY_MS } from '../../life/waterMagic';
import { visibleRelationObject } from '../../life/relationVisibility';

export function prepareGardenWater(profileId: string, state: LifeState, itemId: string, point: [number, number]) {
    const captured = { ...state, waterTouch: { itemId, point } };
    const rule = evaluateDiscovery(captured, profileId).find(rule => rule.ruleId === 'M4' && rule.participantIds.includes(itemId));
    return rule ? createDiscoveryScene(profileId, captured, rule, 'live', crypto.randomUUID(), Date.now()) : Promise.resolve(undefined);
}

type Target = { id: string; anchor: T.Object3D; water: T.Object3D; magic: ReturnType<typeof buildWaterMagic>; button: HTMLButtonElement };
export type GardenWaterReplay = { original: DiscoveryScene; prepare: () => Promise<DiscoveryScene | undefined> };
/** A real surface in the ordinary garden, with an equivalent keyboard target.
 * Eligibility alone never writes a memory; only visible frames after render do. */
export function makeGardenWater(node: HTMLElement, camera: T.Camera, callbacks: {
    profileId: () => string | undefined;
    touched: () => void;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
    replay?: () => GardenWaterReplay | undefined;
}) {
    const targets = new Map<string, Target>();
    let root: T.Object3D | undefined, owner: string | undefined, state: LifeState | undefined;
    let generation = 0, pending = false, reduced = false, cooldown = 0;
    let visibilityAt = -Infinity, validationAt = -Infinity;
    let active: { target: Target; point: [number, number]; started: number; event?: DiscoveryScene; evidence?: DiscoveryPresentation } | undefined;
    const cancel = () => {
        generation++; pending = false; active?.evidence?.cancel(); active = undefined;
        targets.forEach(target => { target.magic.root.visible = false; }); delete node.dataset.gardenWater;
    };
    const clear = () => {
        cancel(); targets.forEach(target => { target.magic.root.removeFromParent(); target.magic.dispose(); target.button.remove(); }); targets.clear(); root = undefined; visibilityAt = validationAt = -Infinity;
    };
    const start = (target: Target, point: [number, number]) => {
        if (!state || !owner || owner !== callbacks.profileId() || targets.get(target.id) !== target || pending || active || performance.now() < cooldown || document.visibilityState !== 'visible') return;
        callbacks.touched(); const token = ++generation; pending = true;
        // Copy before awaiting the digest. Profile, geometry or placement changes invalidate this token.
        const captured = structuredClone({ ...state, poseReducedMotion: reduced });
        const replay = callbacks.replay?.();
        void (replay ? replay.prepare() : prepareGardenWater(owner, captured, target.id, point)).then(event => {
            if (token !== generation || owner !== callbacks.profileId()) return;
            pending = false;
            if (replay && !event || event && (event.profileId !== owner || event.ruleId !== 'M4' || event.snapshot.scene.waterTouch?.itemId !== target.id)) return;
            active = { target, point: event?.snapshot.scene.waterTouch?.point ?? point, started: performance.now(), event, evidence: event ? new DiscoveryPresentation(event) : undefined };
        }).catch(() => { if (token === generation) pending = false; });
    };
    const firstSolid = (ray: T.Raycaster) => root && ray.intersectObject(root, true).find(hit => {
        for (let parent: T.Object3D | null = hit.object; parent; parent = parent.parent) if (!parent.visible) return false;
        const material = (hit.object as T.Mesh).material;
        return material && !Array.isArray(material) && material.visible && (!material.transparent || material.opacity >= .6);
    });
    const onScreen = (ndc: T.Vector3) => {
        const rect = node.getBoundingClientRect(), x = rect.left + (ndc.x + 1) * rect.width / 2, y = rect.top + (1 - ndc.y) * rect.height / 2;
        return Math.abs(ndc.x) < .99 && Math.abs(ndc.y) < .99 && Math.abs(ndc.z) < 1 && x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight && node.contains(document.elementFromPoint(x,y));
    };
    return { cancel, clear, dispose: clear, active: () => Boolean(active || pending),
        update(next: LifeState, nextRoot: T.Object3D, at: number, reduce: boolean, enabled: boolean) {
            const nextOwner = callbacks.profileId();
            if (!enabled || !nextOwner || next.worldStyle !== 'fantasy-garden-v1' || document.visibilityState !== 'visible') { clear(); state = undefined; return; }
            if (nextRoot !== root || nextOwner !== owner) clear();
            root = nextRoot; owner = nextOwner; reduced = reduce; state = next;
            for (const item of next.items) {
                if (item.kind !== 'water-bowl' || !item.cell || targets.has(item.id)) continue;
                const replay = callbacks.replay?.();
                if (replay && replay.original.snapshot.scene.waterTouch?.itemId !== item.id) continue;
                const water = root.getObjectByName(`life-item-${item.id}`)?.getObjectByName('life-bowl-water');
                const anchor = water?.parent; if (!water || !anchor) continue;
                const magic = buildWaterMagic(); anchor.add(magic.root);
                const button = document.createElement('button'); button.type = 'button'; button.className = 'garden-water-touch';
                button.setAttribute('aria-label', `水ばちに ふれる（${targets.size + 1}）`); button.dataset.gardenWaterTarget = item.id;
                const target = { id: item.id, anchor, water, magic, button }; targets.set(item.id, target); node.append(button);
                button.addEventListener('click', () => start(target, [0,0]));
            }
            if (active?.event && at - validationAt >= 250) {
                validationAt = at;
                if (!evaluateDiscovery(next, owner).some(rule => JSON.stringify([rule.semanticSignature,[]]) === active!.event!.semanticSignature)) cancel();
            }
            if (active) {
                const elapsed = at - active.started, magic = Boolean(active.event);
                active.target.magic.sample(elapsed, magic, active.point, reduce);
                node.dataset.gardenWater = JSON.stringify({ id: active.target.id, kind: magic ? 'stars' : 'ripple', elapsed, eventId: active.event?.eventId });
                if (elapsed >= (magic ? WATER_MAGIC_MS : WATER_RIPPLE_MS)) { cancel(); cooldown = magic ? at + WATER_RETRY_MS : 0; }
            }
            if (at - visibilityAt < 100) return;
            visibilityAt = at; root.updateMatrixWorld(true);
            targets.forEach(target => {
                const position = target.water.getWorldPosition(new T.Vector3()).project(camera);
                target.button.hidden = !visibleRelationObject(active?.target === target && target.magic.root.visible ? target.magic.root : target.water, root!, camera, onScreen);
                target.button.style.left = `${(position.x + 1) * node.clientWidth / 2}px`;
                target.button.style.top = `${(1 - position.y) * node.clientHeight / 2}px`;
            });
        },
        pick(ray: T.Raycaster) {
            const hit = firstSolid(ray); if (!hit) return false;
            for (const target of targets.values()) for (let parent: T.Object3D | null = hit.object; parent; parent = parent.parent) if (parent === target.anchor) {
                const local = target.anchor.worldToLocal(hit.point.clone()); start(target, waterSurfacePoint(local.x,local.z)); return true;
            }
            return false;
        },
        sample(at: number) {
            if (!active?.event || !active.evidence || !root) return;
            const elapsed = at - active.started, surface = active.target.magic.root;
            const visible = surface.visible && elapsed >= 250 && elapsed < WATER_MAGIC_MS - 500 && visibleRelationObject(surface,root,camera,onScreen);
            const box = new T.Box3().setFromObject(surface);
            const left = box.min.clone().project(camera), right = box.max.clone().project(camera);
            const legible = Math.abs(right.x-left.x) * node.clientWidth / 2 >= 22;
            const evidence = active.evidence.sample(at,Date.now(),{rendered:true,foreground:document.visibilityState==='visible',onScreen:visible,unoccluded:visible,preview:false,coreShown:visible&&legible});
            if (evidence) callbacks.presented(active.event,evidence);
        },
    };
}
