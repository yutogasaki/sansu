import { relationTargetBusy } from '../../../domain/islandLife/relationObservation';
import { canopyClearanceCandidate } from './canopyClearanceStudy';
import { canopyAtmosphereStudy, createCanopyLightingStudy } from './canopyAtmosphereStudy';
import { makeEncounterObservation } from './encounterObservation';
import { makeReadingObservation } from './readingObservation';
import { makeShadowObservation, shadowObservationTime, shadowRequestExpired, type ShadowRequest } from './shadowObservation';
import { facilityRelations } from './facilityRelations';
import { visibleRelationObject } from './relationVisibility';
import { displayedGatherings, gatheringVisible } from './gatheringVisibility';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { benchRelation, visitRelation, type RuleEligibility } from '../../../domain/islandLife/discovery';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import { buildLifeScene } from './scene';

type Prepared = (state: LifeState, rule: RuleEligibility, residents: ResidentId[]) => Promise<DiscoveryScene | undefined>;
type Props = { state: LifeState; residentId?: ResidentId; selectedTarget?: (id?: string) => void; benchId?: string; gathering?: { ruleId: RuleEligibility['ruleId']; participantIds: string[] }; frozen?: boolean; prepare: Prepared;
    readingPrepare?: Prepared; readingPresented?: (event: DiscoveryScene, evidence: PresentationEvidence) => void; readingReplay?: boolean;
    encounterPrepare?: Prepared; encounterPresented?: (event: DiscoveryScene, evidence: PresentationEvidence) => void; encounterReplay?: boolean;
    shadowRequest?: ShadowRequest; shadowRequestCancelled?: boolean; shadowPrepare?: Prepared; shadowPresented?: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void; target?: (id: string) => void; status?: (status: 'bench' | 'walking' | 'busy' | 'target-busy') => void };

/** Render committed geometry and real visits. The memory mode freezes the original
 * world clock; neither mode can write a placement or create its own resident. */
export default function RelationObservationView(props: Props) {
    const host = useRef<HTMLDivElement>(null), latest = useRef(props), update = useRef<(() => void) | undefined>(undefined);
    const [failed, setFailed] = useState(false), [shadowReady, setShadowReady] = useState(false);
    const [encounterHint, setEncounterHint] = useState<'X1' | 'X2'>();
    const encounterTrigger = useRef<(() => void) | undefined>(undefined);
    const shadowTrigger = useRef<(() => void) | undefined>(undefined);
    useEffect(() => { latest.current = props; update.current?.(); }, [props]);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
        const scene = new T.Scene(); scene.background = new T.Color('#dcece6');
        const targetRing = new T.Mesh(new T.RingGeometry(.65, .70, 48), new T.MeshBasicMaterial({ color: '#ffeaa2', transparent: true, opacity: .7, side: T.DoubleSide, depthWrite: false }));
        targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false; scene.add(targetRing);
        const hemi = new T.HemisphereLight('#fff7ea', '#63806c', 1.15); scene.add(hemi);
        const light = new T.DirectionalLight('#fff4e0', 2.3); light.position.set(-3, 8, 4); light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = -8; light.shadow.camera.right = 8; light.shadow.camera.top = 6; light.shadow.camera.bottom = -6;
        light.shadow.normalBias = .025; light.shadow.bias = -.0002; scene.add(light);
        const studyLighting = canopyAtmosphereStudy ? createCanopyLightingStudy(scene, hemi, light) : undefined;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
        renderer.domElement.setAttribute('aria-hidden', 'true'); node.append(renderer.domElement);
        const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 100), ray = new T.Raycaster();
        let consumedShadowRequest: string | undefined;
        const shadow = makeShadowObservation(node,scene,camera,{
            prepare: (state,rule,residents) => latest.current.shadowPrepare?.(state,rule,residents) ?? Promise.resolve(undefined),
            presented: (event,evidence) => latest.current.shadowPresented?.(event,evidence), ready: setShadowReady,
        });
        const reading = makeReadingObservation(node, scene, camera, {
            prepare: (state,rule,residents) => latest.current.readingPrepare?.(state,rule,residents) ?? Promise.resolve(undefined),
            presented: (event,evidence) => latest.current.readingPresented?.(event,evidence),
        });
        shadowTrigger.current = () => { consumedShadowRequest = latest.current.shadowRequest?.id; reading.cancel(); shadow.start(); };
        const encounter = makeEncounterObservation(node,scene,camera,{
            prepare: (state,rule) => latest.current.encounterPrepare?.(state,rule,[]) ?? Promise.resolve(undefined),
            presented: (event,evidence) => latest.current.encounterPresented?.(event,evidence), hint: setEncounterHint,
        }); encounterTrigger.current = encounter.start;
        let content: ReturnType<typeof buildLifeScene> | undefined, source: LifeState | undefined, benchId = '', start = performance.now();
        let previousTarget: string | undefined;
        let key = '', epoch = 0, pending = false, event: DiscoveryScene | undefined, collector: DiscoveryPresentation | undefined;
        let alive = true, raf = 0, previousStatus = '', auditAt = 0, lastFrame = performance.now(), maxGap = 0, delivered = false, preparation = '';
        const cancel = () => { epoch++; key = ''; pending = false; event = undefined; delivered = false; preparation = ''; maxGap = 0; lastFrame = performance.now(); collector?.cancel(); collector = undefined; };
        const subjectObjects = () => {
            if (!source || !content) return [];
            if (reading.active()) return reading.focusObjects();
            if (encounter.active()) return encounter.focusObjects();
            const selectedVisit = source.residents.find(r => r.id === latest.current.residentId)?.visit;
            const targetId = selectedVisit?.relationTargetId ?? source.relationTarget?.targetId;
            const relation = benchRelation(source, '', benchId, targetId);
            const trip = source.residents.find(r => r.facilityTrip && [r.facilityTrip.facilityId, r.facilityTrip.targetId].includes(benchId))?.facilityTrip;
            const ids = new Set(latest.current.gathering?.participantIds ?? [benchId, ...(relation?.participantIds ?? []), ...(targetId ? [targetId] : []), ...(trip ? [trip.facilityId, trip.targetId] : [])]);
            return [...ids].flatMap(id => { const object = content!.root.getObjectByName(`life-item-${id}`); return object ? [object] : []; })
                .concat(source.residents.filter(resident => resident.id === latest.current.residentId || resident.visit && ids.has(resident.visit.itemId))
                    .flatMap(resident => { const object = content!.root.getObjectByName(`life-resident-${resident.id}`); return object ? [object] : []; })).concat(shadow.objects()).concat(encounter.extraObjects());
        };
        const resize = () => {
            const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight), aspect = width / height;
            renderer.setSize(width, height); if (!content) return;
            content.root.updateMatrixWorld(true);
            const boxes = subjectObjects().map(object => new T.Box3().setFromObject(object));
            const bounds = boxes.reduce((box, current) => box.union(current), new T.Box3());
            if (bounds.isEmpty()) return;
            const center = bounds.getCenter(new T.Vector3());
            const directions = reading.active() ? reading.directions() : encounter.active() ? [new T.Vector3(4,8,9),new T.Vector3(-4,8,7),new T.Vector3(0,10,-7),new T.Vector3(-8,9,-4),new T.Vector3(8,9,-4)] : shadow.objects().length ? [new T.Vector3(3,10,7),new T.Vector3(-6,10,4),new T.Vector3(0,12,-5)] : latest.current.gathering ? [new T.Vector3(4.5, 7.8, 11),new T.Vector3(-5,10,7),new T.Vector3(5,10,-7),new T.Vector3(-5,10,-7),new T.Vector3(0,15,1)] : [new T.Vector3(4.5, 5, 7)];
            const visible = content.snapshot();
            const gathering = latest.current.gathering;
            const group = gathering && displayedGatherings(visible, '').find(r => r.ruleId === gathering.ruleId
                && r.participantIds.length === gathering.participantIds.length && r.participantIds.every(id => gathering.participantIds.includes(id)));
            const transporting = visible.residents.some(r => r.facilityTrip && [r.facilityTrip.facilityId, r.facilityTrip.targetId].includes(benchId));
            if (transporting) directions.push(new T.Vector3(-8,10,1),new T.Vector3(8,10,1),new T.Vector3(0,10,-8));
            const fit = (direction: T.Vector3) => {
            camera.position.copy(center).add(direction); camera.lookAt(center); camera.updateMatrixWorld(true);
            const points = boxes.flatMap(box => [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z =>
                new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)))));
            const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
            const half = Math.max(reading.active() ? .58 : .9, (maxY - minY) / 2, (maxX - minX) / aspect / 2) * (shadow.objects().length || encounter.active() ? 1.35 : 1.18);
            camera.left = (minX + maxX) / 2 - half * aspect; camera.right = (minX + maxX) / 2 + half * aspect;
            camera.bottom = (minY + maxY) / 2 - half; camera.top = (minY + maxY) / 2 + half; camera.updateProjectionMatrix();
            };
            for (const direction of directions) {
                fit(direction);
                if (reading.active() ? reading.coreVisible() : encounter.active() ? encounter.routeVisible() : group ? gatheringVisible(visible, group, content.root, camera, content.point, () => true)
                    && (!encounter.extraObjects().length || encounter.cueVisible()) : shadow.objects().length ? shadow.coreVisible() : !transporting || facilityRelations(visible, '', content, camera, () => true, true).some(c => c.core && c.rule.participantIds.includes(benchId))) return;
            }
            fit(directions[0]);
        };
        update.current = () => {
            if (source === latest.current.state && benchId === (latest.current.benchId ?? '')) return;
            if (benchId !== (latest.current.benchId ?? '')) cancel();
            source = latest.current.state; benchId = latest.current.benchId ?? ''; start = performance.now();
            if (content) { scene.remove(content.root); content.dispose(); }
            studyLighting?.set(source.worldStyle === 'canopy-dots-c3-v1' ? canopyAtmosphereStudy : undefined);
            if (studyLighting) node.dataset.lifeStudyLighting = JSON.stringify(studyLighting.snapshot());
            content = buildLifeScene(source); scene.add(content.root); node.dataset.lifeWorldStyle = content.root.userData.worldStyle; content.animate(source.now, matchMedia('(prefers-reduced-motion: reduce)').matches); resize();
        };
        const observer = new ResizeObserver(resize); observer.observe(node); update.current();
        const frame = () => {
            if (!alive || !source || !content) return;
            const mono = performance.now(); maxGap = Math.max(maxGap, mono - lastFrame); lastFrame = mono;
            const foreground = document.visibilityState === 'visible' && !renderer.getContext().isContextLost();
            const at = latest.current.frozen ? source.now : shadowObservationTime(source.now + (mono - start), latest.current.shadowRequest, mono);
            if (foreground) {
                content.animate(at, matchMedia('(prefers-reduced-motion: reduce)').matches, latest.current.frozen ? source.now + Math.min(3000, mono - start) : at);
                const poses = content.audit(), stateAtFrame = content.snapshot();
                if (shadow.update(stateAtFrame,content.root,benchId,latest.current.residentId,mono,matchMedia('(prefers-reduced-motion: reduce)').matches,Boolean(latest.current.shadowPrepare))) resize();
                if (encounter.update(stateAtFrame,content,latest.current.encounterPrepare ? latest.current.gathering : undefined,Boolean(latest.current.encounterReplay),mono,matchMedia('(prefers-reduced-motion: reduce)').matches)) resize();
                if (shadow.active()) reading.cancel();
                else if (reading.update(stateAtFrame, content.root, benchId, latest.current.residentId, Boolean(latest.current.readingReplay), Boolean(latest.current.readingPrepare), mono, matchMedia('(prefers-reduced-motion: reduce)').matches)) resize();
                const request = latest.current.shadowRequest;
                if (request && consumedShadowRequest !== request.id) {
                    if (latest.current.shadowRequestCancelled || shadowRequestExpired(request, mono)) consumedShadowRequest = request.id;
                    else if (node.dataset.rendered === 'true' && shadow.coreVisible()) {
                        reading.cancel(); if (shadow.start()) consumedShadowRequest = request.id;
                    }
                }
                const selectedVisit = stateAtFrame.residents.find(r => r.id === latest.current.residentId)?.visit;
                const selectedTarget = selectedVisit?.observationSubjectId === benchId ? selectedVisit.relationTargetId : undefined;
                if (selectedTarget !== previousTarget) { previousTarget = selectedTarget; latest.current.selectedTarget?.(selectedTarget); }
                const selectedItem = stateAtFrame.items.find(i => i.id === selectedTarget && i.cell);
                targetRing.visible = Boolean(selectedItem);
                if (selectedItem?.cell) {
                    const facility = selectedItem.kind === 'library' || selectedItem.kind === 'garden-hut';
                    targetRing.position.copy(content.root.localToWorld(content.point({ x: selectedItem.cell.x + (facility ? .5 : 0), z: selectedItem.cell.z + (facility ? .5 : 0) }).setY(.09)));
                    targetRing.scale.setScalar(facility ? 2 : 1);
                }
                const canopy = content.root.getObjectByName('life-canopy-c3');
                node.dataset.lifeSculptStatus = canopy?.userData.sculptStatus ?? 'none';
                node.dataset.lifeVisualCandidate = source?.worldStyle === 'canopy-dots-c3-v1' && canopyAtmosphereStudy ? (canopyClearanceCandidate ?? `canopy-atmosphere-${canopyAtmosphereStudy}-study-v1`) : canopy?.userData.sculptStatus ? canopy.userData.visualCandidate : content.root.getObjectByName('life-landscape')?.userData.visualCandidate ?? canopy?.userData.visualCandidate ?? content.root.userData.worldStyle;
                renderer.render(scene, camera); node.dataset.rendered = 'true';
                const findTransport = () => facilityRelations(stateAtFrame, '', content!, camera, ndc => {
                    const rect = node.getBoundingClientRect();
                    return node.contains(document.elementFromPoint(rect.left + (ndc.x + 1) / 2 * rect.width, rect.top + (1 - ndc.y) / 2 * rect.height));
                }, true).find(candidate => candidate.rule.participantIds.includes(benchId) && (!latest.current.residentId || candidate.focalResidentIds?.includes(latest.current.residentId)));
                let transport = findTransport();
                const sitter = transport ? poses.find(pose => pose.id === transport?.focalResidentIds?.[0])
                    : poses.find(pose => (!latest.current.residentId || pose.id === latest.current.residentId) && pose.itemId === benchId && (['bench', 'picnic-table', 'library', 'garden-hut'].includes(pose.phase)));
                const collectingForBench = stateAtFrame.relationSelectionVersion && stateAtFrame.residents.some(r => (!latest.current.residentId || r.id === latest.current.residentId) && r.facilityTrip?.targetId === benchId && r.facilityTrip.phase === 'collect');
                const nextStatus = relationTargetBusy(stateAtFrame, benchId, latest.current.residentId, selectedTarget) ? 'target-busy' : sitter ? 'bench' : collectingForBench || poses.some(pose => (!latest.current.residentId || pose.id === latest.current.residentId) && (pose.itemId === benchId || stateAtFrame.residents.find(r => r.id === pose.id)?.facilityTrip?.facilityId === benchId) && pose.phase === 'walking') ? 'walking' : 'busy';
                if (nextStatus !== previousStatus) { previousStatus = nextStatus; if (transport) { resize(); renderer.render(scene, camera); transport = findTransport(); } latest.current.status?.(nextStatus); }
                const gathering = latest.current.gathering;
                const rule = gathering ? displayedGatherings(stateAtFrame, '').find(rule => rule.ruleId === gathering.ruleId
                    && rule.participantIds.length === gathering.participantIds.length && rule.participantIds.every(id => gathering.participantIds.includes(id)))
                    : transport?.rule ?? (sitter?.relation?.ready ? visitRelation(stateAtFrame, '', stateAtFrame.residents.find(r => r.id === sitter.id)!.visit!) : undefined);
                const rect = node.getBoundingClientRect();
                const onscreen = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
                const uncovered = onscreen && [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]].every(([x, y]) => node.contains(document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height)));
                const visibleObject = (object: T.Object3D, focus?: T.Vector3) => visibleRelationObject(object, content!.root, camera, ndc =>
                    node.contains(document.elementFromPoint(rect.left + (ndc.x + 1) / 2 * rect.width, rect.top + (1 - ndc.y) / 2 * rect.height)), focus);
                shadow.sample(mono,foreground,onscreen,uncovered); encounter.sample(mono,foreground,onscreen,uncovered); reading.sample(mono,foreground,onscreen,uncovered);
                let core = Boolean(gathering && rule && uncovered && gatheringVisible(stateAtFrame, rule, content.root, camera, content.point, ndc =>
                    node.contains(document.elementFromPoint(rect.left + (ndc.x + 1) / 2 * rect.width, rect.top + (1 - ndc.y) / 2 * rect.height))));
                if (transport) core = uncovered && transport.core;
                if (sitter?.relation && rule) {
                    const actor = content.root.getObjectByName(`life-resident-${sitter.id}`)!;
                    const head = actor.getObjectByName(sitter.id === 'pokomoko' ? 'life-hero-head' : 'resident-head')!;
                    const target = content.root.getObjectByName(`life-item-${sitter.relation.targetId}`)!;
                    core = uncovered && visibleObject(actor, head.getWorldPosition(new T.Vector3())) && visibleObject(target);
                    if (core && sitter.relation.targetResidentId) {
                        const other = content.root.getObjectByName(`life-resident-${sitter.relation.targetResidentId}`)!;
                        const otherHead = other.getObjectByName(sitter.relation.targetResidentId === 'pokomoko' ? 'life-hero-head' : 'resident-head')!;
                        core = visibleObject(other, otherHead.getWorldPosition(new T.Vector3()));
                    }
                }
                const focal = sitter ? [sitter.id, ...(sitter.relation?.targetResidentId ? [sitter.relation.targetResidentId] : [])] as ResidentId[] : [];
                const nextKey = transport?.key ?? (gathering && rule ? rule.semanticSignature : rule && sitter ? JSON.stringify([rule.semanticSignature, focal, stateAtFrame.residents.find(r => r.id === sitter.id)?.visit?.start, stateAtFrame.residents.find(r => r.id === sitter.id)?.visit?.observationSubjectId, stateAtFrame.residents.find(r => r.id === sitter.id)?.visit?.relationTargetId]) : '');
                if (nextKey !== key) { cancel(); key = nextKey; }
                if (core && rule && !pending && !event) {
                    pending = true; preparation = 'pending'; const token = epoch;
                    void latest.current.prepare(stateAtFrame, rule, focal).then(result => {
                        if (!alive || token !== epoch) return;
                        preparation = result ? 'ready' : 'empty';
                        if (result) { event = result; collector = new DiscoveryPresentation(result); }
                    }).catch(cause => { if (alive && token === epoch) preparation = String(cause); });
                }
                const evidence = collector?.sample(mono, Date.now(), { rendered: true, foreground, onScreen: onscreen, unoccluded: uncovered, preview: false, coreShown: core && !shadow.active() });
                if (event && evidence) { delivered = true; encounter.normalPresented(event); reading.normalPresented(event); latest.current.presented(event, evidence); }
                if (mono - auditAt > 200) { node.dataset.relationView = JSON.stringify({ at, core, status: nextStatus, poses, preparation, eventId: event?.eventId, delivered, maxGap, epoch, camera: { projection: camera.projectionMatrix.elements, view: camera.matrixWorldInverse.elements } }); auditAt = mono; }
            } else cancel();
            raf = requestAnimationFrame(frame);
        };
        const hidden = () => { if (document.visibilityState !== 'visible') { consumedShadowRequest = latest.current.shadowRequest?.id; cancel(); shadow.cancel(); encounter.cancel(); reading.cancel(); } };
        const lost = (event: Event) => { event.preventDefault(); consumedShadowRequest = latest.current.shadowRequest?.id; cancel(); shadow.cancel(); encounter.cancel(); reading.cancel(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => { setFailed(false); resize(); };
        document.addEventListener('visibilitychange', hidden); renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        const pick = (event: MouseEvent) => {
            if (!content || !source) return;
            consumedShadowRequest = latest.current.shadowRequest?.id;
            const rect = renderer.domElement.getBoundingClientRect();
            ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
            if (encounter.pick(ray)) return;
            if (shadow.pick(ray)) { reading.cancel(); return; }
            if (!latest.current.target) return;
            const hit = ray.intersectObject(content.root, true).find(hit => {
                for (let object: T.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
                const material = (hit.object as T.Mesh).material;
                return !Array.isArray(material) && material && material.visible && (!material.transparent || material.opacity >= .6);
            });
            for (let object = hit?.object; object; object = object.parent ?? undefined) {
                if (!object.name.startsWith('life-item-')) continue;
                const id = object.name.slice('life-item-'.length), item = source.items.find(item => item.id === id);
                if (item?.cell && item.id !== benchId) latest.current.target(id);
                break;
            }
        };
        renderer.domElement.addEventListener('click', pick);
        // Parent persistence guards must finish mounting (including StrictMode's
        // cleanup/setup cycle) before an automatically visible scene is prepared.
        raf = requestAnimationFrame(frame);
        return () => { alive = false; cancel(); update.current = undefined; cancelAnimationFrame(raf); observer.disconnect(); reading.dispose(); encounter.dispose(); encounterTrigger.current = undefined; shadow.dispose(); shadowTrigger.current = undefined; studyLighting?.dispose(); content?.dispose();
            renderer.domElement.removeEventListener('click', pick); document.removeEventListener('visibilitychange', hidden); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            targetRing.geometry.dispose(); targetRing.material.dispose(); light.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
    }, []);
    return <><div ref={host} className={`life-relation-view${props.gathering ? ' life-gathering-view' : ''}`} role="img" aria-label={props.gathering ? props.frozen ? 'あのときの あつまり' : 'あつまりの いまの ようす' : props.state.items.some(i => i.id === props.benchId && (i.kind === 'library' || i.kind === 'garden-hut')) ? props.frozen ? 'あのときの ようす' : 'たてものの いまの ようす' : props.frozen ? 'あのときの ベンチ' : 'ベンチの いまの ようす'} />{encounterHint && props.encounterPrepare && <button type="button" className="life-shadow-touch" onClick={() => encounterTrigger.current?.()}>{encounterHint === 'X1' ? 'はねの けはい' : 'えだの けはい'}</button>}{shadowReady && props.shadowPrepare && <button type="button" className="life-shadow-touch" onClick={() => shadowTrigger.current?.()}>かげに ふれる</button>}{failed && <p role="status">景色をひらけなかったよ。とじて、もういちど ためしてね。</p>}</>;
}
