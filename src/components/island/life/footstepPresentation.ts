import * as T from 'three';
import { FOOTSTEP_LIFE_MS, FOOTSTEP_MAGIC_MS, footstepWalker, inLanternGround } from '../../../domain/islandLife/footstepMagic';
import { MAGIC_RETRY_MS } from '../../../domain/islandLife/magicTiming';
import { createDiscoveryScene, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { evaluateDiscovery } from '../../../domain/islandLife/discovery';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import type { LifeState } from '../../../domain/islandLife/model';
import type { buildLifeScene } from './scene';
import { visibleRelationObject } from './relationVisibility';

export type FootstepInput = { profileId: string; id: string; targetId: string; source: 'live' | 'current-context-test' | 'replay' };
type Content = ReturnType<typeof buildLifeScene>;
export function makeFootstepPresentation(scene: T.Scene, camera: T.Camera, node: HTMLElement, callbacks: {
    profileId: () => string | undefined;
    prepareReplay?: () => Promise<DiscoveryScene | undefined>;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    const root = new T.Group(); root.name = 'life-star-footprints'; scene.add(root);
    const path = new T.Shape();
    for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5, r = i % 2 ? .07 : .165;
        if (i) path.lineTo(Math.sin(a) * r, Math.cos(a) * r); else path.moveTo(0, r);
    }
    path.closePath();
    const geometry = new T.ShapeGeometry(path);
    const pool = Array.from({ length: 24 }, () => {
        const material = new T.MeshBasicMaterial({ color: '#bf8b3e', transparent: true, depthWrite: false });
        const mesh = new T.Mesh(geometry, material);
        const fill = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: '#ffe185', transparent: true, depthWrite: false })); fill.scale.set(.78, .78, 1); fill.position.z = .001; mesh.add(fill);
        mesh.rotation.x = -Math.PI / 2; mesh.visible = false; root.add(mesh);
        return { mesh, fill, born: -Infinity, lampId: '', point: [0, 0] as [number, number] };
    });
    let input: FootstepInput | undefined, seen = '', key = '', generation = 0, alive = true;
    let armedAt = 0, started: number | undefined, cooldown = 0, lampId = '', event: DiscoveryScene | undefined;
    let previousPosition: T.Vector3 | undefined;
    let collector: DiscoveryPresentation | undefined, prepared = false, delivered = false, auditAt = 0;
    const last = [new T.Vector3(Infinity, 0, 0), new T.Vector3(Infinity, 0, 0)];
    const cancel = () => {
        generation++; input = undefined; started = undefined; event = undefined; collector?.cancel(); collector = undefined;
        prepared = delivered = false; lampId = ''; previousPosition = undefined; pool.forEach(s => { s.mesh.visible = false; s.born = -Infinity; });
        delete node.dataset.footstepMagic; delete node.dataset.footstepPending;
    };
    const visible = (object: T.Object3D, focus?: T.Vector3) => visibleRelationObject(object, scene, camera, ndc => {
        const r = node.getBoundingClientRect(), x = r.left + (ndc.x + 1) * r.width / 2, y = r.top + (1 - ndc.y) * r.height / 2;
        return x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight && node.contains(document.elementFromPoint(x, y));
    }, focus);
    return { cancel,
        update(content: Content, state: LifeState, next: FootstepInput | undefined, at: number, enabled: boolean, reduced: boolean) {
            const nextKey = JSON.stringify([state.expanded, state.extraLand, state.heroStyle, state.worldStyle, state.items.map(i => [i.id, i.cell, i.style]), state.residents.find(r => r.id === 'pokomoko')?.visit?.start]);
            if (nextKey !== key) { cancel(); key = nextKey; }
            if (!enabled || next && next.profileId !== callbacks.profileId() || document.visibilityState !== 'visible') { cancel(); if (next) seen = next.id; return; }
            if (next && next.id !== seen) {
                seen = next.id;
                if (input?.targetId !== next.targetId || !input) {
                    const blocked = !input && at < cooldown; cancel();
                    if (!blocked) { input = next; armedAt = at; node.dataset.footstepPending = 'true'; last.forEach(p => p.set(Infinity, 0, 0)); }
                }
            }
            if (!input) return;
            if (started === undefined && at - armedAt >= FOOTSTEP_MAGIC_MS || started !== undefined && at - started >= FOOTSTEP_MAGIC_MS) {
                cancel(); cooldown = at + MAGIC_RETRY_MS; node.dataset.footstepRetryAt = String(cooldown); return;
            }
            const walker = footstepWalker(state, input.targetId);
            const position = content.root.getObjectByName('life-resident-pokomoko')?.getWorldPosition(new T.Vector3());
            const moving = Boolean(walker && position && previousPosition && position.distanceToSquared(previousPosition) > 1e-8);
            previousPosition = position;
            if (walker && moving && (started === undefined || at - started < FOOTSTEP_MAGIC_MS - FOOTSTEP_LIFE_MS)) {
                const origin = content.point({ x: 0, z: 0 });
                content.feet().forEach((foot, index) => {
                    if (foot.bottom > .075 || foot.point.distanceTo(last[index]) < .23
                        || pool.some(s => s.mesh.visible && foot.point.distanceTo(s.mesh.position) < .34)) return;
                    const point: [number, number] = [foot.point.x - origin.x, foot.point.z - origin.z];
                    const region = content.lightGround?.regions.find(r => inLanternGround(r.cells, point));
                    if (!region) return;
                    const slot = pool.find(s => !s.mesh.visible); if (!slot) return;
                    started ??= at; lampId ||= region.lampId;
                    slot.born = at; slot.point = point; slot.lampId = region.lampId;
                    slot.mesh.position.copy(foot.point); slot.mesh.visible = true; slot.mesh.material.opacity = slot.fill.material.opacity = 1; last[index].copy(foot.point);
                    if (!prepared) {
                        prepared = true; const token = generation, source = input!.source;
                        const frozen = structuredClone(state);
                        frozen.footstepTouch = { lampId, targetId: input!.targetId, point, visitStart: walker.visit!.start };
                        const owner = callbacks.profileId(), rule = owner && evaluateDiscovery(frozen, owner).find(r => r.ruleId === 'M1');
                        const request = source === 'replay' ? callbacks.prepareReplay?.() : owner && rule ? createDiscoveryScene(owner, frozen, rule, source, crypto.randomUUID(), Date.now(), ['pokomoko']) : undefined;
                        void request?.then(result => { if (alive && token === generation && result) { event = result; collector = new DiscoveryPresentation(result); } }).catch(() => {});
                    }
                });
            }
            pool.forEach(s => {
                const age = at - s.born; s.mesh.visible = age < FOOTSTEP_LIFE_MS;
                s.mesh.material.opacity = s.fill.material.opacity = reduced ? 1 : Math.min(1, (FOOTSTEP_LIFE_MS - age) / 300);
            });
            if (started !== undefined) { node.dataset.footstepMagic = 'stars'; delete node.dataset.footstepPending; }
            if (at - auditAt > 100) {
                node.dataset.footstepView = JSON.stringify({ targetId: input.targetId, lampId, started, elapsed: started === undefined ? -1 : at - started,
                    moving, eventId: event?.eventId, delivered,
                    stars: pool.filter(s => s.mesh.visible).map(s => ({ point: s.point, age: at - s.born, world: s.mesh.position.toArray() })),
                    regions: content.lightGround?.regions }); auditAt = at;
            }
        }, sample(content: Content, at: number) {
            if (!event || !collector || delivered) return;
            const actor = content.root.getObjectByName('life-resident-pokomoko'), head = actor?.getObjectByName('life-hero-head');
            const lamp = content.root.getObjectByName(`life-item-${lampId}`);
            const core = Boolean(actor && head && lamp && visible(actor, head.getWorldPosition(new T.Vector3())) && visible(lamp)
                && pool.some(s => s.mesh.visible && s.mesh.material.opacity >= .6 && visible(s.mesh)));
            const evidence = collector.sample(at, Date.now(), { rendered: true, foreground: document.visibilityState === 'visible', onScreen: core, unoccluded: core, preview: false, coreShown: core });
            if (evidence) { delivered = true; callbacks.presented(event, evidence); }
        }, dispose() { alive = false; cancel(); pool.forEach(s => { s.mesh.material.dispose(); s.fill.material.dispose(); }); geometry.dispose(); root.removeFromParent(); }
    };
}
