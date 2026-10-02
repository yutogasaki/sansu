import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { GardenTime } from '../life/fantasy/presentation';
import { boatProgress, docked } from '../../../domain/growingIsland';
import type { Cell, GrowingState, Moment, Villager } from '../../../domain/growingIsland';
import { makeVillagerActor } from './actors';
import { MomentEffects } from './momentEffects';
import { buildObjectLayer, type Ghost, type ObjectLayer } from './objectLayer';
import { frameCamera, initialView, panFromDrag } from './growingCamera';
import { createWorldScene } from './worldScene';
import { WorldEffects } from './worldEffects';
import type { SceneLayout } from './sceneLayout';
import { menuPictureMaker, type MenuPictures } from './menuMiniatures';

export interface WorldHandlers {
    onCell: (cell: Cell) => void;
    onSelect: (id?: string) => void;
    onOpen: (plotId: string) => void;
    onDisembark: () => void;
    onActorTap: (id: string) => void;
    onPop?: () => void;
    /** The world's own loading steps: the scene is built, then the first picture is on screen. */
    onStage?: (stage: 'scene' | 'ready') => void;
    onConcertStarted?: (receipt: number) => void;
}
/** Pictures of the island for the card and the island's story; never uploaded anywhere. */
export interface WorldCamera {
    capture: (width: number, height: number) => HTMLCanvasElement | undefined;
    portraits: (villagers: readonly Villager[], size: number) => Record<string, string>;
    menuPictures: (villagers: readonly Villager[]) => MenuPictures;
}
export interface ShownMoment { id: number; moment: Moment; cell?: Cell }
/** `cheer` makes the waiting friend jump (a home seed was planted); `festival` celebrates a new level. */
type Props = WorldHandlers & { state: GrowingState; time: GardenTime; ghost?: Ghost; selectedId?: string; turn: number; cheer: number; festival: number;
    hints?: readonly Cell[]; moment?: ShownMoment; show?: boolean; focus?: { id: string; n: number }; concert?: { cell: Cell; n: number }; onCamera?: (camera?: WorldCamera) => void };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function GrowingWorld({ state, time, ghost, selectedId, turn, cheer, festival, hints, moment, show, focus, concert, onCamera, ...handlers }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const handlerRef = useRef(handlers);
    useEffect(() => { handlerRef.current = handlers; });
    const api = useRef<{ rebuild: (state: GrowingState, ghost?: Ghost, selectedId?: string, hints?: readonly Cell[]) => void; setTime: (time: GardenTime) => void; turn: (by: number) => void;
        cheer: () => void; festival: () => void; moment: (m: ShownMoment) => void; focus: (id: string) => void; concert: (cell: Cell, receipt: number) => void } | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    const latest = useRef({ state, ghost, selectedId, time, hints, show });
    useEffect(() => { latest.current = { state, ghost, selectedId, time, hints, show }; });
    const cameraRef = useRef(onCamera);
    useEffect(() => { cameraRef.current = onCamera; });

    useEffect(() => {
        const node = host.current; if (!node) return;
        let renderer: T.WebGLRenderer;
        try { renderer = new T.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.domElement.setAttribute('aria-label', 'ぽこもこと なかまが くらす しま');
        renderer.domElement.style.touchAction = 'none';
        node.append(renderer.domElement);
        handlerRef.current.onStage?.('scene');
        const world = createWorldScene(renderer), effects = new WorldEffects(world.scene), moments = new MomentEffects(world.scene);
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100), view = initialView();
        let layout: SceneLayout = world.layout(latest.current.state), layer: ObjectLayer | undefined;
        let unopened = new Set<string>(), known: Set<string> | undefined, frame = 0, last = performance.now(), width = 1, height = 1, nextWave = 0, showing = false;
        const reduced = reducedMotion();
        let pendingConcert: number | undefined;

        const rebuild = (next: GrowingState, nextGhost?: Ghost, selected?: string, nextHints?: readonly Cell[]) => {
            layout = world.layout(next);
            node.dataset.growingBounds = JSON.stringify(layout.bounds);
            layer?.dispose();
            layer = buildObjectLayer(world.m, next, layout, nextGhost, selected, nextHints);
            world.scene.add(layer.root);
            const now = performance.now();
            for (const id of unopened) if (!next.unopened.includes(id)) {
                const opened = layer.objects.get(id);
                if (opened) {
                    effects.pop(opened, now, reduced); handlerRef.current.onPop?.();
                    if (!reduced && next.plots.some(p => p.id === id && p.kind === 'wonder')) effects.burst(opened.position, now);
                }
            }
            // Flowers that spread by themselves and gifts from a sibling grow in gently; they are not buds.
            if (known) for (const [id, object] of layer.objects) if (!known.has(id) && (next.plots.some(p => p.id === id && p.origin === 'spread')
                || next.landmarks.some(l => l.id === id && l.from))) effects.pop(object, now, true);
            known = new Set(layer.objects.keys());
            unopened = new Set(next.unopened);
            world.life.sync(next, layout, layer);
            frameCamera(camera, layout, view, width / height);
        };
        const resize = () => {
            width = Math.max(1, node.clientWidth); height = Math.max(1, node.clientHeight);
            renderer.setSize(width, height, false);
            frameCamera(camera, layout, view, width / height);
        };
        api.current = {
            rebuild, setTime: next => world.setTime(next),
            turn: by => { view.azimuth += by * Math.PI / 6; frameCamera(camera, layout, view, width / height); },
            cheer: () => { const now = performance.now(); world.life.hop('visitor', now); world.life.hop('pokomoko', now + 120); },
            moment: shown => {
                const at = shown.cell ? layout.point(shown.cell) : new T.Vector3(0, 0, 0);
                moments.play(shown.moment, at, performance.now(), reduced);
            },
            concert: (cell, receipt) => { world.life.startConcert(cell, performance.now()); pendingConcert = receipt; },
            focus: id => {
                const target = world.life.positionOf(id) ?? layer?.objects.get(id)?.position; if (!target) return;
                view.zoom = Math.max(view.zoom, 2.2);
                const home = frameCamera(camera, layout, { ...view, pan: { x: 0, z: 0 } }, width / height);
                view.pan = { x: target.x - home.x, z: target.z - home.z };
                frameCamera(camera, layout, view, width / height);
            },
            festival: () => {
                const now = performance.now();
                world.life.celebrate(now);
                if (!reduced) world.life.positions().forEach((position, i) => window.setTimeout(() => effects.confetti(position, performance.now()), i * 180));
            },
        };
        rebuild(latest.current.state, latest.current.ghost, latest.current.selectedId, latest.current.hints);
        const snap = (shotCamera: T.Camera, scene: T.Scene, w: number, h: number) => {
            // Render once at the picture size and copy it in the same task, then restore the view.
            const ratio = renderer.getPixelRatio();
            renderer.setPixelRatio(1); renderer.setSize(w, h, false);
            renderer.render(scene, shotCamera);
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(renderer.domElement, 0, 0, w, h);
            renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
            renderer.render(world.scene, camera);
            return canvas;
        };
        cameraRef.current?.({
            menuPictures: menuPictureMaker(renderer, world.m),
            capture: (w, h) => {
                const shot = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100);
                frameCamera(shot, layout, initialView(), w / h);
                try { return snap(shot, world.scene, w, h); } catch { return undefined; }
            },
            portraits: (villagers, size) => {
                const out: Record<string, string> = {}, scene = new T.Scene();
                scene.background = new T.Color('#fff4dc');
                scene.add(new T.HemisphereLight('#ffffff', '#c8b89a', 2.4));
                const key = new T.DirectionalLight('#ffffff', 1.4); key.position.set(1, 2, 3); scene.add(key);
                const lens = new T.PerspectiveCamera(30, 1, .1, 20);
                for (const villager of villagers) {
                    const actor = makeVillagerActor(world.m, villager); scene.add(actor.root);
                    actor.root.rotation.y = .3;
                    lens.position.set(.18, .7, 1.25); lens.lookAt(0, .6, 0);
                    try { out[villager.id] = snap(lens, scene, size, size).toDataURL('image/png'); } catch { /* A missing face falls back to its initial. */ }
                    actor.root.removeFromParent();
                    actor.root.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
                }
                return out;
            },
        });
        world.setTime(latest.current.time);
        resize();
        const observer = new ResizeObserver(resize); observer.observe(node);

        const loop = () => {
            frame = requestAnimationFrame(loop);
            const now = performance.now(), delta = Math.min(64, now - last); last = now;
            const current = latest.current.state;
            if (layer) {
                const sailing = !docked(current);
                layer.visitorBoat.visible = sailing;
                if (sailing) layer.visitorBoat.position.lerpVectors(layout.far, layout.dock, boatProgress(current));
                const bob = reduced ? 0 : Math.sin(now / 700) * .03;
                layer.visitorBoat.position.y = layout.dock.y + bob; layer.arrivalBoat.position.y = layout.dock.y + bob;
                layer.nextBoat.position.y = layout.farther.y + (reduced ? 0 : Math.sin(now / 900 + 1) * .03);
                for (const bud of layer.buds.values()) {
                    const inner = bud.children[0];
                    if (inner && !reduced) { inner.position.y = .42 + Math.sin(now / 420) * .05; inner.rotation.y = now / 1400; }
                }
            }
            if (layer) {
                const pulse = .6 + Math.sin(now / 280) * .4;
                for (const glow of layer.glows) { glow.scale.setScalar(.9 + pulse * .2); (glow.material as T.MeshBasicMaterial).opacity = pulse; (glow.material as T.MeshBasicMaterial).transparent = true; }
                layer.flag.getObjectByName('growing-flag-cloth')!.rotation.y = reduced ? 0 : Math.sin(now / 500) * .15;
            }
            if (latest.current.show !== showing) {
                showing = Boolean(latest.current.show);
                if (showing) { view.zoom = 1; view.pan = { x: 0, z: 0 }; }
            }
            if (latest.current.show) {
                // Show mode (§13): the camera slowly circles the whole island and friends wave in turn.
                view.azimuth += delta * (reduced ? .00004 : .00012);
                frameCamera(camera, layout, view, width / height);
                if (now > nextWave) { world.life.celebrate(now); nextWave = now + 6000; }
            }
            world.life.tick(now, delta, reduced, latest.current.time === 'night');
            effects.tick(now, delta);
            moments.ambient(now, latest.current.time === 'night', current.landmarks.filter(l => l.cell && (l.kind === 'lantern' || l.kind === 'lighthouse')).length, camera.position.clone().setY(0), reduced);
            moments.tick(now);
            world.animate(now, reduced);
            renderer.render(world.scene, camera);
            if (pendingConcert !== undefined && document.visibilityState === 'visible') {
                const receipt = pendingConcert; pendingConcert = undefined;
                if (world.life.concertActive(now)) handlerRef.current.onConcertStarted?.(receipt);
            }
            if (!shown) { shown = true; handlerRef.current.onStage?.('ready'); }
        };
        let shown = false;
        loop();

        // Touch: a still tap selects; a drag pans, or carries a friend; two fingers zoom.
        const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
        let moved = false, carrying: string | undefined, pendingActor: string | undefined, pinch = 0, twist = 0;
        const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -.04);
        const cast = (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
            ray.setFromCamera(ndc, camera); return ray;
        };
        const ground = (event: PointerEvent) => cast(event).ray.intersectPlane(plane, new T.Vector3());
        const actorAt = (event: PointerEvent) => cast(event).intersectObjects(world.life.objects(), true)[0]?.object.userData.actorId as string | undefined;
        const down = (event: PointerEvent) => {
            try { renderer.domElement.setPointerCapture(event.pointerId); } catch { /* A pointer that already ended cannot be captured. */ }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY });
            if (pointers.size === 1) { moved = false; pendingActor = actorAt(event); carrying = undefined; }
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                pinch = Math.hypot(a.x - b.x, a.y - b.y); twist = Math.atan2(b.y - a.y, b.x - a.x); pendingActor = undefined;
                if (carrying) { world.life.drop(carrying, performance.now()); carrying = undefined; }
            }
        };
        const move = (event: PointerEvent) => {
            const p = pointers.get(event.pointerId); if (!p) return;
            const dx = event.clientX - p.x, dy = event.clientY - p.y; p.x = event.clientX; p.y = event.clientY;
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0) view.zoom = Math.max(1, Math.min(4, view.zoom * distance / pinch));
                // Two fingers twisting turn the island, as on the current island.
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                let turn = angle - twist; if (turn > Math.PI) turn -= Math.PI * 2; if (turn < -Math.PI) turn += Math.PI * 2;
                view.azimuth += turn; twist = angle;
                pinch = distance; moved = true; frameCamera(camera, layout, view, width / height); return;
            }
            if (!moved && Math.hypot(event.clientX - p.sx, event.clientY - p.sy) < 7) return;
            moved = true;
            if (pendingActor && !carrying && world.life.pick(pendingActor)) carrying = pendingActor;
            pendingActor = undefined;
            if (carrying) { const point = ground(event); if (point) world.life.drag(carrying, point); return; }
            panFromDrag(camera, view, dx, dy, width, height); frameCamera(camera, layout, view, width / height);
        };
        const up = (event: PointerEvent) => {
            if (!pointers.delete(event.pointerId)) return;
            if (carrying) { world.life.drop(carrying, performance.now()); carrying = undefined; return; }
            if (moved || pointers.size) return;
            const h = handlerRef.current;
            if (latest.current.ghost) {
                // While placing, every tap chooses the cell under the finger.
                const point = ground(event); if (point) h.onCell(layout.cellAt(point)); return;
            }
            const hits = cast(event).intersectObjects([...(layer ? [layer.root] : []), ...world.life.objects(), world.scene], true);
            for (const hit of hits) {
                const data = hit.object.userData;
                if (data.budId) { h.onOpen(data.budId); return; }
                if (data.boat === 'arrival' && layer?.arrivalBoat.visible) { h.onDisembark(); return; }
                if (data.actorId) { world.life.hop(data.actorId, performance.now()); h.onActorTap(data.actorId); return; }
                if (data.objectId) { h.onSelect(data.objectId); return; }
            }
            const point = ground(event);
            if (point) { h.onSelect(undefined); h.onCell(layout.cellAt(point)); }
        };
        const wheel = (event: WheelEvent) => {
            event.preventDefault();
            view.zoom = Math.max(1, Math.min(4, view.zoom * Math.exp(-event.deltaY * .002)));
            frameCamera(camera, layout, view, width / height);
        };
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('wheel', wheel, { passive: false });
        return () => {
            cancelAnimationFrame(frame); observer.disconnect();
            canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
            canvas.removeEventListener('wheel', wheel);
            layer?.dispose(); effects.dispose(); moments.dispose(); world.dispose(); renderer.dispose(); canvas.remove();
            api.current = undefined; cameraRef.current?.(undefined);
        };
    }, []);

    useEffect(() => { api.current?.rebuild(state, ghost, selectedId, hints); }, [state, ghost, selectedId, hints]);
    useEffect(() => { if (moment) api.current?.moment(moment); }, [moment]);
    useEffect(() => { if (focus) api.current?.focus(focus.id); }, [focus]);
    useEffect(() => { if (concert) api.current?.concert(concert.cell, concert.n); }, [concert]);
    useEffect(() => { api.current?.setTime(time); }, [time]);
    useEffect(() => { if (cheer) api.current?.cheer(); }, [cheer]);
    useEffect(() => { if (festival) api.current?.festival(); }, [festival]);
    const lastTurn = useRef(turn);
    useEffect(() => { if (turn !== lastTurn.current) { api.current?.turn(turn - lastTurn.current); lastTurn.current = turn; } }, [turn]);

    return <div className="growing-world" ref={host} data-growing-world data-visual-candidate="growing-island-v1" data-growing-feature-enabled="true">
        {failed && <p className="growing-world-failed">しまを ひょうじ できなかったよ。よみなおしてみてね。</p>}
    </div>;
}
