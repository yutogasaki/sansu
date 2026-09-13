import { discoveryParticipants } from '../../../domain/islandLife/discoveryRecall';
import * as T from 'three';
import { evaluateDiscovery, type RuleEligibility } from '../../../domain/islandLife/discovery';
import { groupEncounters } from '../../../domain/islandLife/groupEncounters';
import { growthStage, type LifeState } from '../../../domain/islandLife/model';
import { MAGIC_RETRY_MS } from '../../../domain/islandLife/magicTiming';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import type { buildLifeScene } from './scene';
import { buildEncounterVisual, encounterDuration, encounterTiming } from './encounterVisual';
import { visibleRelationObject } from './relationVisibility';
import { LifePresentationClock } from './presentationClock';

type Group = { ruleId: RuleEligibility['ruleId']; participantIds: string[] };
type Candidate = ReturnType<typeof groupEncounters>[number];
type Visual = ReturnType<typeof buildEncounterVisual>;
export function makeEncounterObservation(node: HTMLElement, scene: T.Scene, camera: T.Camera, callbacks: {
    prepare: (state: LifeState, rule: RuleEligibility) => Promise<DiscoveryScene | undefined>;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
    hint: (kind: 'X1' | 'X2' | undefined) => void;
}) {
    let state: LifeState | undefined, group: Group | undefined, content: ReturnType<typeof buildLifeScene> | undefined;
    let candidate: Candidate | undefined, rule: RuleEligibility | undefined, visual: Visual, plant: T.Object3D | undefined, bowl: T.Object3D | undefined;
    let layout = '', normal = false, started: number | undefined, generation = 0, preparing = false, alive = true, cooldown = 0;
    let event: DiscoveryScene | undefined, collector: DiscoveryPresentation | undefined, stage = '', departed = false, waterSeen = 0;
    let lastAt: number | undefined, lastWaterVisible = false, previousHint: string | undefined, previousFocus = false, auditAt = 0, poseAt = 0, reducedPose = false;
    let lastCore = false, maxFrameGap = 0, activeRebuilds = 0, returnSeen = 0, lastReturnVisible = false;
    const clock = new LifePresentationClock();
    const domVisible = (p: T.Vector3) => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + (p.x + 1) * r.width / 2, r.top + (1 - p.y) * r.height / 2)); };
    const visible = (object: T.Object3D) => visibleRelationObject(object, scene, camera, domVisible);
    const coreVisible = () => Boolean(visual && candidate && plant && bowl && visible(visual.visitor) && visible(plant) && visible(bowl)
        && (candidate.ruleId === 'X1' ? visual.features.every(visible)
            : Boolean(visual.perch && visible(visual.perch)) && visible(visual.features[0]) && visible(visual.features[visual.features.length - 1]) && visual.markings.some(visible)));
    const cancel = () => { if (event) node.dataset.encounterLast = JSON.stringify({ ruleId: event.ruleId, eventId: event.eventId, departed, waterSeen, returnSeen, lastCore, maxFrameGap, activeRebuilds, elapsed: poseAt });
        generation++; preparing = false; started = undefined; event = undefined; collector?.cancel(); collector = undefined;
        lastCore = false; maxFrameGap = 0; activeRebuilds = 0; returnSeen = 0; lastReturnVisible = false;
        departed = false; waterSeen = 0; lastAt = undefined; lastWaterVisible = false; delete node.dataset.encounterMagic; };
    const start = () => {
        if (!normal || !state || !group || !candidate || !visual || !rule || preparing || event || performance.now() < cooldown
            || document.visibilityState !== 'visible' || !visible(visual.cue)) return;
        const frozen = structuredClone(state);
        frozen.encounterTouch = { ruleId: candidate.ruleId, waterId: candidate.water.id, plantId: candidate.plant.id,
            normalRuleId: group.ruleId as 'GF6' | 'GT3' | 'GT6', normalGroupIds: [...group.participantIds] };
        const token = ++generation; preparing = true;
        void callbacks.prepare(frozen, rule).then(result => {
            if (!alive || token !== generation) return; preparing = false;
            if (result && candidate && result.ruleId === candidate.ruleId) {
                event = result; collector = new DiscoveryPresentation(result); started = performance.now(); clock.prepare({ now: 0 }, started);
            }
        }).catch(() => { if (alive && token === generation) preparing = false; });
    };
    return { start, cancel, coreVisible, active: () => started !== undefined,
        routeVisible() {
            if (!visual || !candidate) return false;
            // Choose a view for the whole gesture, including the bowl where a resident may be standing.
            const result = [750, 3500, encounterTiming(candidate.ruleId).returnEnd + 200].every(at => {
                visual!.animate(at, reducedPose); return coreVisible();
            });
            visual.animate(poseAt, reducedPose); return result;
        },
        focusObjects: () => started !== undefined && visual && plant && bowl ? [plant, bowl, visual.visitor] : [],
        extraObjects: () => normal && visual ? [visual.cue] : [],
        cueVisible: () => Boolean(visual && visual.cue.visible && visible(visual.cue)),
        normalPresented(shown: DiscoveryScene) {
            const ids = discoveryParticipants(shown).map(i => i.id);
            if (group && shown.ruleId === group.ruleId && ids.length === group.participantIds.length && group.participantIds.every(id => ids.includes(id))) normal = true;
        },
        update(next: LifeState, nextContent: ReturnType<typeof buildLifeScene>, nextGroup: Group | undefined, replay: boolean, at: number, reduced: boolean) {
            state = next; group = nextGroup; content = nextContent;
            const nextLayout = JSON.stringify([next.encounterVersion, next.expanded, next.extraLand, next.heroStyle, next.worldStyle,
                next.items.map(i => [i.id, i.cell, i.style, i.access, growthStage(i)]), nextGroup]);
            if (layout !== nextLayout) {
                cancel(); normal = false; layout = nextLayout;
                const rules = evaluateDiscovery(next, '');
                const choices = nextGroup ? groupEncounters(next, rules).filter(c => c.group.participantIds.length === nextGroup.participantIds.length
                    && c.group.participantIds.every(id => nextGroup.participantIds.includes(id))
                    && (c.ruleId === 'X1' ? nextGroup.ruleId === 'GF6' : nextGroup.ruleId === 'GT3' || nextGroup.ruleId === 'GT6')) : [];
                candidate = choices.filter(c => !replay || c.water.id === next.encounterTouch?.waterId && c.plant.id === next.encounterTouch?.plantId)
                    .sort((a, b) => a.distance - b.distance || a.water.id.localeCompare(b.water.id))[0];
                rule = candidate && rules.find(r => r.ruleId === candidate!.ruleId && r.participantIds.includes(candidate!.water.id)
                    && candidate!.group.participantIds.every(id => r.participantIds.includes(id)));
                normal = Boolean(replay && candidate && next.encounterTouch?.ruleId === candidate.ruleId);
                visual?.dispose(); visual = undefined; plant = bowl = undefined;
            }
            const nextPlant = candidate && content.root.getObjectByName(`life-item-${candidate.plant.id}`);
            const nextBowl = candidate && content.root.getObjectByName(`life-item-${candidate.water.id}`);
            let changed = false;
            if (nextPlant !== plant || nextBowl !== bowl) {
                // A refreshed world rebuilds its meshes. Preserve the current gesture
                // until those replacement meshes have rendered, just as on first open.
                if (started !== undefined) { clock.prepare({ now: poseAt }, at); activeRebuilds++; }
                visual?.dispose(); plant = nextPlant; bowl = nextBowl;
                visual = candidate && plant && bowl ? buildEncounterVisual(candidate.ruleId, plant, bowl) : undefined;
                if (visual) scene.add(visual.root); changed = true;
            }
            const elapsed = started === undefined ? 0 : clock.sample(at);
            if (candidate && started !== undefined && elapsed >= encounterDuration(candidate.ruleId)) { cancel(); cooldown = at + MAGIC_RETRY_MS; }
            if (visual) {
                visual.cue.visible = normal && started === undefined; visual.visitor.visible = started !== undefined;
                poseAt = started === undefined ? 0 : elapsed; reducedPose = reduced;
                stage = visual.animate(poseAt, reduced);
            }
            const hint = normal && visual ? candidate?.ruleId : undefined;
            if (hint !== previousHint) { previousHint = hint; callbacks.hint(hint); changed = true; }
            const focused = started !== undefined; if (focused !== previousFocus) { previousFocus = focused; changed = true; }
            if (event) node.dataset.encounterMagic = event.ruleId;
            if (at - auditAt > 150) {
                node.dataset.encounterView = JSON.stringify({ kind: candidate?.ruleId, normal, ready: Boolean(hint), active: focused, stage,
                    elapsed: started === undefined ? -1 : elapsed, departed, waterSeen, returnSeen, core: lastCore, maxFrameGap, activeRebuilds, eventId: event?.eventId,
                    visitor: visual?.visitor.position.toArray(), cue: visual?.cue.position.toArray(), plantId: candidate?.plant.id, waterId: candidate?.water.id }); auditAt = at;
            }
            return changed;
        }, sample(at: number, foreground: boolean, onScreen: boolean, unoccluded: boolean) {
            if (!visual || !candidate || !event || !collector || started === undefined || !plant || !bowl) return;
            clock.resume(performance.now());
            const core = foreground && onScreen && unoccluded && coreVisible();
            lastCore = core; if (lastAt !== undefined) maxFrameGap = Math.max(maxFrameGap, at - lastAt);
            if (stage === 'outbound' && poseAt < 1800 && core) departed = true;
            const waterVisible = stage === 'water' && core;
            if (lastWaterVisible && waterVisible && lastAt !== undefined && at - lastAt <= 250) waterSeen += Math.max(0, at - lastAt);
            const returned = stage === 'plant' && poseAt >= encounterTiming(candidate.ruleId).returnEnd;
            const returnVisible = returned && core;
            if (lastReturnVisible && returnVisible && lastAt !== undefined && at - lastAt <= 250) returnSeen += Math.max(0, at - lastAt);
            lastReturnVisible = returnVisible;
            lastAt = at; lastWaterVisible = waterVisible;
            const meaning = candidate.ruleId === 'X1' ? departed && stage === 'water' : departed && waterSeen >= 1000 && returned;
            const evidence = collector.sample(at, Date.now(), { rendered: true, foreground, onScreen, unoccluded, preview: false, coreShown: core && meaning });
            if (evidence) callbacks.presented(event, evidence);
        }, pick(ray: T.Raycaster) {
            if (!visual?.cue.visible || !content) return false;
            const hit = ray.intersectObject(visual.cue, true)[0]; if (!hit) return false;
            const obstruction = ray.intersectObject(content.root, true).find(h => {
                for (let p: T.Object3D | null = h.object; p; p = p.parent) if (!p.visible) return false;
                const m = (h.object as T.Mesh).material; return m && !Array.isArray(m) && m.visible && (!m.transparent || m.opacity >= .6);
            });
            if (obstruction && obstruction.distance < hit.distance - .002) return false;
            start(); return true;
        }, dispose() { alive = false; cancel(); visual?.dispose(); }
    };
}
