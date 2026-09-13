import { visibleRelationObject } from './relationVisibility';
import { displayedGatherings, gatheringVisible } from './gatheringVisibility';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { benchRelation, type RuleEligibility } from '../../../domain/islandLife/discovery';
import type { LifeState, ResidentId } from '../../../domain/islandLife/model';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { DiscoveryPresentation } from '../../../domain/islandLife/discoveryPresentation';
import { buildLifeScene } from './scene';

type Prepared = (state: LifeState, rule: RuleEligibility, residents: ResidentId[]) => Promise<DiscoveryScene | undefined>;
type Props = { state: LifeState; benchId?: string; gathering?: { ruleId: RuleEligibility['ruleId']; participantIds: string[] }; frozen?: boolean; prepare: Prepared;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void; target?: (id: string) => void; status?: (status: 'bench' | 'walking' | 'busy') => void };

/** Render committed geometry and real visits. The memory mode freezes the original
 * world clock; neither mode can write a placement or create its own resident. */
export default function RelationObservationView(props: Props) {
    const host = useRef<HTMLDivElement>(null), latest = useRef(props), update = useRef<(() => void) | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    useEffect(() => { latest.current = props; update.current?.(); }, [props]);
    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
        const scene = new T.Scene(); scene.background = new T.Color('#dcece6');
        scene.add(new T.HemisphereLight('#fff7ea', '#63806c', 1.15));
        const light = new T.DirectionalLight('#fff4e0', 2.3); light.position.set(-3, 8, 4); light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = -8; light.shadow.camera.right = 8; light.shadow.camera.top = 6; light.shadow.camera.bottom = -6;
        light.shadow.normalBias = .025; light.shadow.bias = -.0002; scene.add(light);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
        renderer.domElement.setAttribute('aria-hidden', 'true'); node.append(renderer.domElement);
        const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 100), ray = new T.Raycaster();
        let content: ReturnType<typeof buildLifeScene> | undefined, source: LifeState | undefined, benchId = '', start = performance.now();
        let key = '', epoch = 0, pending = false, event: DiscoveryScene | undefined, collector: DiscoveryPresentation | undefined;
        let alive = true, raf = 0, previousStatus = '', auditAt = 0, lastFrame = performance.now(), maxGap = 0, delivered = false, preparation = '';
        const cancel = () => { epoch++; key = ''; pending = false; event = undefined; delivered = false; preparation = ''; maxGap = 0; lastFrame = performance.now(); collector?.cancel(); collector = undefined; };
        const subjectObjects = () => {
            if (!source || !content) return [];
            const relation = benchRelation(source, '', benchId, source.relationTarget?.targetId);
            const ids = new Set(latest.current.gathering?.participantIds ?? [benchId, ...(relation?.participantIds ?? []), ...(source.relationTarget ? [source.relationTarget.targetId] : [])]);
            return [...ids].flatMap(id => { const object = content!.root.getObjectByName(`life-item-${id}`); return object ? [object] : []; })
                .concat(source.residents.filter(resident => resident.visit && ids.has(resident.visit.itemId))
                    .flatMap(resident => { const object = content!.root.getObjectByName(`life-resident-${resident.id}`); return object ? [object] : []; }));
        };
        const resize = () => {
            const width = Math.max(1, node.clientWidth), height = Math.max(1, node.clientHeight), aspect = width / height;
            renderer.setSize(width, height); if (!content) return;
            content.root.updateMatrixWorld(true);
            const boxes = subjectObjects().map(object => new T.Box3().setFromObject(object));
            const bounds = boxes.reduce((box, current) => box.union(current), new T.Box3());
            if (bounds.isEmpty()) return;
            const center = bounds.getCenter(new T.Vector3()); camera.position.copy(center).add(latest.current.gathering ? new T.Vector3(4.5, 7.8, 11) : new T.Vector3(4.5, 5, 7)); camera.lookAt(center); camera.updateMatrixWorld(true);
            const points = boxes.flatMap(box => [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z =>
                new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)))));
            const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
            const half = Math.max(.9, (maxY - minY) / 2, (maxX - minX) / aspect / 2) * 1.18;
            camera.left = (minX + maxX) / 2 - half * aspect; camera.right = (minX + maxX) / 2 + half * aspect;
            camera.bottom = (minY + maxY) / 2 - half; camera.top = (minY + maxY) / 2 + half; camera.updateProjectionMatrix();
        };
        update.current = () => {
            if (source === latest.current.state && benchId === (latest.current.benchId ?? '')) return;
            if (benchId !== (latest.current.benchId ?? '')) cancel();
            source = latest.current.state; benchId = latest.current.benchId ?? ''; start = performance.now();
            if (content) { scene.remove(content.root); content.dispose(); }
            content = buildLifeScene(source); scene.add(content.root); node.dataset.lifeWorldStyle = content.root.userData.worldStyle; content.animate(source.now, matchMedia('(prefers-reduced-motion: reduce)').matches); resize();
        };
        const observer = new ResizeObserver(resize); observer.observe(node); update.current();
        const frame = () => {
            if (!alive || !source || !content) return;
            const mono = performance.now(); maxGap = Math.max(maxGap, mono - lastFrame); lastFrame = mono;
            const foreground = document.visibilityState === 'visible' && !renderer.getContext().isContextLost();
            const at = source.now + (latest.current.frozen ? 0 : mono - start);
            if (foreground) {
                content.animate(at, matchMedia('(prefers-reduced-motion: reduce)').matches, latest.current.frozen ? source.now + Math.min(3000, mono - start) : at); renderer.render(scene, camera); node.dataset.rendered = 'true';
                const poses = content.audit(), sitter = poses.find(pose => pose.itemId === benchId && pose.phase === 'bench');
                const stateAtFrame = { ...source, now: at };
                const nextStatus = sitter ? 'bench' : poses.some(pose => pose.itemId === benchId && pose.phase === 'walking') ? 'walking' : 'busy';
                if (nextStatus !== previousStatus) { previousStatus = nextStatus; latest.current.status?.(nextStatus); }
                const gathering = latest.current.gathering;
                const rule = gathering ? displayedGatherings(source, '').find(rule => rule.ruleId === gathering.ruleId
                    && rule.participantIds.length === gathering.participantIds.length && rule.participantIds.every(id => gathering.participantIds.includes(id)))
                    : sitter?.relation?.ready ? benchRelation(source, '', benchId, source.relationTarget?.targetId) : undefined;
                const rect = node.getBoundingClientRect();
                const onscreen = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
                const uncovered = onscreen && [[.1, .1], [.9, .1], [.5, .5], [.1, .9], [.9, .9]].every(([x, y]) => node.contains(document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height)));
                const visibleObject = (object: T.Object3D, focus?: T.Vector3) => visibleRelationObject(object, content!.root, camera, ndc =>
                    node.contains(document.elementFromPoint(rect.left + (ndc.x + 1) / 2 * rect.width, rect.top + (1 - ndc.y) / 2 * rect.height)), focus);
                let core = Boolean(gathering && rule && uncovered && gatheringVisible(source, rule, content.root, camera, content.point, ndc =>
                    node.contains(document.elementFromPoint(rect.left + (ndc.x + 1) / 2 * rect.width, rect.top + (1 - ndc.y) / 2 * rect.height))));
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
                const nextKey = gathering && rule ? rule.semanticSignature : rule && sitter ? JSON.stringify([rule.semanticSignature, focal, source.residents.find(r => r.id === sitter.id)?.visit?.start]) : '';
                if (nextKey !== key) { cancel(); key = nextKey; }
                if (core && rule && !pending && !event) {
                    pending = true; preparation = 'pending'; const token = epoch;
                    void latest.current.prepare(stateAtFrame, rule, focal).then(result => {
                        if (!alive || token !== epoch) return;
                        preparation = result ? 'ready' : 'empty';
                        if (result) { event = result; collector = new DiscoveryPresentation(result); }
                    }).catch(cause => { if (alive && token === epoch) preparation = String(cause); });
                }
                const evidence = collector?.sample(mono, Date.now(), { rendered: true, foreground, onScreen: onscreen, unoccluded: uncovered, preview: false, coreShown: core });
                if (event && evidence) { delivered = true; latest.current.presented(event, evidence); }
                if (mono - auditAt > 200) { node.dataset.relationView = JSON.stringify({ at, core, status: nextStatus, poses, preparation, eventId: event?.eventId, delivered, maxGap, epoch }); auditAt = mono; }
            } else cancel();
            raf = requestAnimationFrame(frame);
        };
        const hidden = () => { if (document.visibilityState !== 'visible') cancel(); };
        const lost = (event: Event) => { event.preventDefault(); cancel(); setFailed(true); delete node.dataset.rendered; };
        const restored = () => { setFailed(false); resize(); };
        document.addEventListener('visibilitychange', hidden); renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', restored);
        const pick = (event: MouseEvent) => {
            if (!content || !source || !latest.current.target) return;
            const rect = renderer.domElement.getBoundingClientRect();
            ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
            const hit = ray.intersectObject(content.root, true).find(hit => {
                const material = (hit.object as T.Mesh).material;
                return !Array.isArray(material) && material && material.visible && (!material.transparent || material.opacity >= .6);
            });
            for (let object = hit?.object; object; object = object.parent ?? undefined) {
                if (!object.name.startsWith('life-item-')) continue;
                const id = object.name.slice('life-item-'.length), item = source.items.find(item => item.id === id);
                if (item?.cell && (item.kind === 'flower' || item.kind === 'swing')) latest.current.target(id);
                break;
            }
        };
        renderer.domElement.addEventListener('click', pick);
        // Parent persistence guards must finish mounting (including StrictMode's
        // cleanup/setup cycle) before an automatically visible scene is prepared.
        raf = requestAnimationFrame(frame);
        return () => { alive = false; cancel(); update.current = undefined; cancelAnimationFrame(raf); observer.disconnect(); content?.dispose();
            renderer.domElement.removeEventListener('click', pick); document.removeEventListener('visibilitychange', hidden); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
            light.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
    }, []);
    return <><div ref={host} className={`life-relation-view${props.gathering ? ' life-gathering-view' : ''}`} role="img" aria-label={props.gathering ? props.frozen ? 'あのときの あつまり' : 'あつまりの いまの ようす' : props.frozen ? 'あのときの ベンチ' : 'ベンチの いまの ようす'} />{failed && <p role="status">景色をひらけなかったよ。とじて、もういちど ためしてね。</p>}</>;
}
