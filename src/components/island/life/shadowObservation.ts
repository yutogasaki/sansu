import { MAGIC_RETRY_MS } from '../../../domain/islandLife/magicTiming';
import * as T from 'three';
import { shadowResident } from '../../../domain/islandLife/shadowMagic';
import { evaluateDiscovery, type RuleEligibility } from '../../../domain/islandLife/discovery';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import { buildResidentShadow, SHADOW_MAGIC_MS } from './residentShadow';
import { visibleRelationObject } from './relationVisibility';
type Prepare = (state: LifeState, rule: RuleEligibility, residents: ResidentId[]) => Promise<DiscoveryScene | undefined>;
function visible(object: T.Object3D) {
    for (let p: T.Object3D | null = object; p; p = p.parent) if (!p.visible) return false;
    const material = (object as T.Mesh).material;
    return material && (Array.isArray(material) ? material : [material]).some(m => m.visible && (!m.transparent || m.opacity >= .6));
}
export function makeShadowObservation(node: HTMLElement, scene: T.Scene, camera: T.Camera, callbacks: {
    prepare: Prepare; presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void; ready: (ready: boolean) => void;
}) {
    let actor: T.Object3D | undefined, shape: ReturnType<typeof buildResidentShadow> | undefined, content: T.Object3D | undefined;
    let state: LifeState | undefined, who: ResidentId | undefined, itemId = '', key = '', generation = 0, preparing = false, alive = true;
    let event: DiscoveryScene | undefined, collector: DiscoveryPresentation | undefined, started: number | undefined, cooldown = 0, ready = false;
    const domVisible = (ndc: T.Vector3) => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left+(ndc.x+1)*r.width/2,r.top+(1-ndc.y)*r.height/2)); };
    const cancel = () => { generation++; preparing = false; event = undefined; collector?.cancel(); collector = undefined; started = undefined; delete node.dataset.shadowMagic; };
    const clearShape = () => { shape?.dispose(); shape = undefined; actor = undefined; };
    const coreVisible = () => {
        if (!shape || !actor) return false;
        const head = actor.getObjectByName(who === 'pokomoko' ? 'life-hero-head' : 'resident-head');
        return Boolean(head && visibleRelationObject(actor,scene,camera,domVisible,head.getWorldPosition(new T.Vector3())) && visibleRelationObject(shape.root,scene,camera,domVisible));
    };
    const exposedPoint = () => {
        if (!shape) return undefined;
        const probe = new T.Raycaster();
        const boxes = shape.root.children.filter(o=>o.visible).map(o=>new T.Box3().setFromObject(o)).sort((a,b)=>b.getSize(new T.Vector3()).lengthSq()-a.getSize(new T.Vector3()).lengthSq());
        for (const box of boxes.slice(0,8)) for (const x of [.5,.25,.75]) for (const z of [.5,.25,.75]) {
            const point = new T.Vector3(T.MathUtils.lerp(box.min.x,box.max.x,x),.09,T.MathUtils.lerp(box.min.z,box.max.z,z));
            const projected = point.clone().project(camera); if (!domVisible(projected)) continue;
            probe.setFromCamera(new T.Vector2(projected.x,projected.y),camera);
            const hit = probe.intersectObject(scene,true).find(h=>visible(h.object));
            if (hit && shape.root.children.includes(hit.object)) return point.toArray();
        }
        return undefined;
    };
    let auditAt = 0;
    const start = () => {
        if (!state || !who || !shape || event || preparing || performance.now() < cooldown || document.visibilityState !== 'visible' || !coreVisible()) return;
        const rule = evaluateDiscovery(state,'').find(r => r.ruleId === 'M3' && r.participantIds.includes(itemId)); if (!rule) return;
        const frozen = structuredClone(state); frozen.shadowTouch = { itemId, residentId: who };
        preparing = true; const token = ++generation;
        void callbacks.prepare(frozen,rule,[who]).then(next => {
            if (!alive || token !== generation) return; preparing = false;
            if (next?.ruleId === 'M3' && next.snapshot.scene.shadowTouch?.residentId === who && next.snapshot.scene.shadowTouch?.itemId === itemId) {
                event = next; collector = new DiscoveryPresentation(next); started = performance.now();
            }
        }).catch(() => { if (alive && token === generation) preparing = false; });
    };
    return { cancel, start, coreVisible, objects: () => shape ? [shape.root] : [],
        update(next: LifeState, root: T.Object3D, benchId: string, residentId: ResidentId | undefined, at: number, reduced: boolean) {
            state = next; content = root; itemId = benchId;
            const resident = shadowResident(next,benchId,residentId);
            const nextKey = resident ? JSON.stringify([resident.id,benchId,resident.visit!.start,resident.visit!.end,next.expanded,next.extraLand,next.heroStyle,next.worldStyle,next.items.map(i=>[i.id,i.cell,i.style])]) : '';
            if (nextKey !== key) { cancel(); key = nextKey; }
            const nextActor = resident ? root.getObjectByName(`life-resident-${resident.id}`) : undefined;
            let changed = false;
            if (nextActor !== actor) { clearShape(); actor = nextActor; who = resident?.id; if (actor) { shape = buildResidentShadow(actor); scene.add(shape.root); } changed = true; }
            if (ready !== Boolean(shape)) { ready = Boolean(shape); callbacks.ready(ready); }
            let elapsed = started === undefined ? -1 : at - started;
            if (elapsed >= SHADOW_MAGIC_MS) { cancel(); cooldown = at + MAGIC_RETRY_MS; elapsed = -1; }
            shape?.update(elapsed,reduced);
            if (at - auditAt > 200) { node.dataset.shadowView = JSON.stringify({ residentId: who, itemId, active: Boolean(event), elapsed, visitEnd: resident?.visit?.end, visitStart: resident?.visit?.start, eventId: event?.eventId, touchPoint: exposedPoint() }); auditAt = at; }
            if (event) node.dataset.shadowMagic = 'greeting';
            return changed;
        }, sample(at: number, foreground: boolean, onScreen: boolean, unoccluded: boolean) {
            if (!event || !collector || started === undefined) return;
            const elapsed = at - started;
            const evidence = collector.sample(at,Date.now(),{rendered:true,foreground,onScreen,unoccluded,preview:false,coreShown:elapsed>=350&&elapsed<SHADOW_MAGIC_MS-400&&coreVisible()&&Boolean(shape?.gesture.some(part=>visibleRelationObject(part,scene,camera,domVisible)))});
            if (evidence) callbacks.presented(event,evidence);
        }, pick(ray: T.Raycaster) {
            if (!shape || !content) return false;
            const hit = ray.intersectObject(shape.root,true).find(h=>visible(h.object)); if (!hit) return false;
            const obstruction = ray.intersectObject(content,true).find(h=>visible(h.object));
            if (obstruction && obstruction.distance < hit.distance - .002) return false;
            start(); return true;
        }, dispose() { alive = false; cancel(); clearShape(); }
    };
}
