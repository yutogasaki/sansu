import * as T from 'three';
import { readingOtter } from '../../../domain/islandLife/readingEncounter';
import { evaluateDiscovery, type RuleEligibility } from '../../../domain/islandLife/discovery';
import { growthStage, type LifeState, type ResidentId } from '../../../domain/islandLife/model';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import { LifePresentationClock } from './presentationClock';
import { visibleRelationObject } from './relationVisibility';
import { poseReadingBook, READING_GESTURE_MS } from './readingBookPose';

export function makeReadingObservation(node: HTMLElement, scene: T.Scene, camera: T.Camera, callbacks: {
    prepare: (state: LifeState, rule: RuleEligibility, residents: ResidentId[]) => Promise<DiscoveryScene | undefined>;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    let state: LifeState | undefined, reader: ReturnType<typeof readingOtter>, layout = '', observed = false, spent = false, preparing = false, alive = true, generation = 0;
    let book: T.Object3D | undefined, actor: T.Object3D | undefined, bench: T.Object3D | undefined, base = 0, elapsed = 0, stage = '', upsideSeen = 0;
    let event: DiscoveryScene | undefined, collector: DiscoveryPresentation | undefined, previousAt: number | undefined, previousUpside = false, previousFocus = false;
    const clock = new LifePresentationClock();
    const visible = (object: T.Object3D) => visibleRelationObject(object, scene, camera, ndc => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + (ndc.x + 1) * r.width / 2, r.top + (1 - ndc.y) * r.height / 2));
    });
    const coreVisible = () => {
        const head = actor?.getObjectByName('resident-head'), tree = book?.getObjectByName('life-book-tree'), sun = book?.getObjectByName('life-book-sun');
        return Boolean(book?.visible && actor && bench && head && tree && sun && [actor, head, bench, book, tree, sun].every(visible));
    };
    const cancel = () => {
        if (book) { book.rotation.y = base; book.updateWorldMatrix(true, true); }
        if (event) node.dataset.readingLast = JSON.stringify({ eventId: event.eventId, elapsed, upsideSeen, stage });
        generation++; preparing = false; event = undefined; collector?.cancel(); collector = undefined;
        elapsed = 0; upsideSeen = 0; previousAt = undefined; previousUpside = false; spent = true;
    };
    return { cancel, coreVisible, active: () => Boolean(event),
        focusObjects: () => event && actor && bench && book ? [actor, bench, book] : [],
        directions: () => {
            const q = actor?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();
            return [[2,5,7],[-2,5,7],[0,7,5]].map(([x,y,z]) => new T.Vector3(x,y,z).applyQuaternion(q));
        },
        normalPresented(shown: DiscoveryScene) {
            const original = shown.snapshot.scene.residents.find(r => r.id === 'otter')?.visit;
            if (reader && shown.ruleId === 'R5' && shown.focalResidentIds.includes('otter') && original?.itemId === reader.bench.id && original.start === reader.visit.start) observed = true;
        },
        update(next: LifeState, root: T.Object3D, benchId: string, residentId: ResidentId | undefined, replay: boolean, enabled: boolean, at: number, reduced: boolean) {
            state = next;
            const natural = enabled && residentId === 'otter' ? readingOtter(next) : undefined;
            reader = natural?.bench.id === benchId ? natural : undefined;
            const nextLayout = JSON.stringify([next.readingEncounterVersion, next.expanded, next.extraLand, next.heroStyle, next.worldStyle,
                next.items.map(i => [i.id,i.cell,i.style,i.access,growthStage(i)]), reader?.visit, reader?.trip]);
            if (layout !== nextLayout) { cancel(); layout = nextLayout; observed = Boolean(replay && reader && next.readingObservation?.visitStart === reader.visit.start); spent = false; }
            const nextActor = reader && root.getObjectByName('life-resident-otter'), nextBook = nextActor?.getObjectByName('life-held-book');
            const rebuilt = nextBook !== book;
            if (rebuilt) {
                if (book) book.rotation.y = base;
                book = nextBook; actor = nextActor; bench = reader && root.getObjectByName(`life-item-${reader.bench.id}`); base = book?.rotation.y ?? 0;
                if (event) clock.prepare({ now: elapsed }, at);
            }
            if (reader && observed && !spent && !preparing && !event && book?.visible && book.getObjectByName('life-book-tree')) {
                const rule = evaluateDiscovery(next, '').find(r => r.ruleId === 'X3');
                if (rule) {
                    const frozen = structuredClone(state); frozen.readingObservation = { benchId: reader.bench.id, libraryId: reader.library.id, visitStart: reader.visit.start };
                    preparing = true; const token = ++generation;
                    void callbacks.prepare(frozen, rule, ['otter']).then(result => {
                        if (!alive || token !== generation) return; preparing = false;
                        if (result?.ruleId === 'X3') { event = result; collector = new DiscoveryPresentation(result); clock.prepare({ now: 0 }, performance.now()); }
                    }).catch(() => { if (alive && token === generation) preparing = false; });
                }
            }
            if (event && book) { elapsed = clock.sample(at); if (elapsed >= READING_GESTURE_MS) cancel(); else stage = poseReadingBook(book, elapsed, reduced, base); }
            node.dataset.readingView = JSON.stringify({ available: Boolean(reader), observed, active: Boolean(event), elapsed, stage, upsideSeen, eventId: event?.eventId });
            const focused = Boolean(event), changed = focused !== previousFocus || focused && rebuilt; previousFocus = focused; return changed;
        },
        sample(at: number, foreground: boolean, onScreen: boolean, unoccluded: boolean) {
            if (!event || !collector) return;
            clock.resume(performance.now());
            const core = foreground && onScreen && unoccluded && coreVisible(), upside = core && stage === 'upside-down';
            if (upside && previousUpside && previousAt !== undefined && at - previousAt <= 250) upsideSeen += Math.max(0, at - previousAt);
            previousAt = at; previousUpside = upside;
            const evidence = collector.sample(at, Date.now(), { rendered: true, foreground, onScreen, unoccluded, preview: false, coreShown: core && stage === 'upright' && upsideSeen >= 1000 });
            if (evidence) callbacks.presented(event, evidence);
        },
        dispose() { alive = false; cancel(); }
    };
}
