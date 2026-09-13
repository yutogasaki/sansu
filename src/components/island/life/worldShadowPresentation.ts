import * as T from 'three';
import { createDiscoveryScene, type DiscoveryScene, type PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { shadowResident } from '../../../domain/islandLife/shadowMagic';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import { evaluateDiscovery, type RuleEligibility } from '../../../domain/islandLife/discovery';
import { makeShadowObservation } from './shadowObservation';

export function prepareWorldShadowScene(profileId: string, state: LifeState, input: RuleEligibility, residents: ResidentId[]) {
    // The visual controller identifies a subject without an owner. Resolve its
    // rule again for this profile before the immutable scene validates signatures.
    const rule = evaluateDiscovery(state, profileId).find(rule => rule.ruleId === 'M3'
        && input.ruleId === 'M3' && rule.participantIds.length === input.participantIds.length
        && rule.participantIds.every(id => input.participantIds.includes(id)));
    return rule ? createDiscoveryScene(profileId, state, rule, 'live', crypto.randomUUID(), Date.now(), residents) : Promise.resolve(undefined);
}

/** All actual bench users are touchable; never call or move an idle resident. */
export function makeWorldShadowPresentation(node: HTMLElement, scene: T.Scene, camera: T.Camera, callbacks: {
    profileId: () => string | undefined;
    touched: () => void;
    inspect?: (itemId: string, residentId: ResidentId, worldAt: number) => void;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    const controllers = new Map<ResidentId, ReturnType<typeof makeShadowObservation>>();
    let owner: string | undefined, walkingRequest: string | undefined;
    const cancel = () => controllers.forEach(controller => controller.cancel());
    const clear = () => { controllers.forEach(controller => controller.dispose()); controllers.clear(); };
    return { cancel, clear, active: () => [...controllers.values()].some(c => c.active()),
        update(state: LifeState, root: T.Object3D, at: number, reduced: boolean, enabled: boolean, walkId?: string) {
            const began = performance.now();
            const currentOwner = callbacks.profileId();
            if (!enabled || !currentOwner || document.visibilityState !== 'visible' || owner !== currentOwner) clear();
            owner = currentOwner;
            if (!enabled || !owner || document.visibilityState !== 'visible') return;
            if (walkId !== walkingRequest) { cancel(); walkingRequest = walkId; }
            const eligible = state.residents.filter(r => r.visit && shadowResident(state, r.visit.itemId, r.id));
            for (const [id, controller] of controllers) if (!eligible.some(r => r.id === id)) { controller.dispose(); controllers.delete(id); }
            for (const resident of eligible) {
                let controller = controllers.get(resident.id);
                if (!controller) {
                    controller = makeShadowObservation(node, scene, camera, {
                        prepare: (frozen, rule, residents) => callbacks.profileId()
                            ? prepareWorldShadowScene(callbacks.profileId()!, frozen, rule, residents)
                            : Promise.resolve(undefined),
                        presented: callbacks.presented, ready: () => {},
                    }, `worldShadow${resident.id}`);
                    controllers.set(resident.id, controller);
                }
                controller.update(state, root, resident.visit!.itemId, resident.id, at, reduced);
            }
            node.dataset.worldShadowUpdateMs = String(performance.now() - began);
        }, pick(ray: T.Raycaster) {
            const target = [...controllers.values()].map(controller => ({ controller, distance: controller.hitDistance(ray) }))
                .filter(entry => entry.distance !== undefined).sort((a, b) => a.distance! - b.distance!)[0]?.controller;
            if (!target) { node.dataset.worldShadowTap = 'miss'; return false; }
            controllers.forEach(controller => { if (controller !== target) controller.cancel(); });
            callbacks.touched();
            const subject = target.subject();
            if (callbacks.inspect && subject && !target.canShowGesture()) {
                target.cancel(); node.dataset.worldShadowTap = 'close-view'; callbacks.inspect(subject.itemId, subject.residentId, subject.worldAt); return true;
            }
            node.dataset.worldShadowTap = target.start() ? 'started' : 'not-ready'; return true;
        }, sample(at: number) {
            const began = performance.now();
            controllers.forEach(controller => controller.sample(at, document.visibilityState === 'visible', true, true));
            node.dataset.worldShadowSampleMs = String(performance.now() - began);
        }, dispose: clear,
    };
}
