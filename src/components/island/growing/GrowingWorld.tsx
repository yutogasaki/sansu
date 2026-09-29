import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import type { GardenTime } from '../life/fantasy/presentation';
import { boatProgress, docked } from '../../../domain/growingIsland';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import { buildObjectLayer, type Ghost, type ObjectLayer } from './objectLayer';
import { frameCamera, initialView, panFromDrag } from './growingCamera';
import { createWorldScene } from './worldScene';
import { WorldEffects } from './worldEffects';
import type { SceneLayout } from './sceneLayout';

export interface WorldHandlers {
    onCell: (cell: Cell) => void;
    onSelect: (id?: string) => void;
    onOpen: (plotId: string) => void;
    onDisembark: () => void;
    onActorTap: (id: string) => void;
}
/** `cheer` makes the waiting friend jump (a home seed was planted); `festival` celebrates a new level. */
type Props = WorldHandlers & { state: GrowingState; time: GardenTime; ghost?: Ghost; selectedId?: string; turn: number; cheer: number; festival: number };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function GrowingWorld({ state, time, ghost, selectedId, turn, cheer, festival, ...handlers }: Props) {
    const host = useRef<HTMLDivElement>(null);
    const handlerRef = useRef(handlers);
    useEffect(() => { handlerRef.current = handlers; });
    const api = useRef<{ rebuild: (state: GrowingState, ghost?: Ghost, selectedId?: string) => void; setTime: (time: GardenTime) => void; turn: (by: number) => void;
        cheer: () => void; festival: () => void } | undefined>(undefined);
    const [failed, setFailed] = useState(false);
    const latest = useRef({ state, ghost, selectedId, time });
    useEffect(() => { latest.current = { state, ghost, selectedId, time }; });

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
        const world = createWorldScene(renderer), effects = new WorldEffects(world.scene);
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100), view = initialView();
        let layout: SceneLayout = world.layout(latest.current.state), layer: ObjectLayer | undefined;
        let unopened = new Set<string>(), frame = 0, last = performance.now(), width = 1, height = 1;
        const reduced = reducedMotion();

        const rebuild = (next: GrowingState, nextGhost?: Ghost, selected?: string) => {
            layout = world.layout(next);
            layer?.dispose();
            layer = buildObjectLayer(world.m, next, layout, nextGhost, selected);
            world.scene.add(layer.root);
            const now = performance.now();
            for (const id of unopened) if (!next.unopened.includes(id)) {
                const opened = layer.objects.get(id); if (opened) effects.pop(opened, now, reduced);
            }
            unopened = new Set(next.unopened);
            world.life.sync(next, layout, layer);
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
            festival: () => {
                const now = performance.now();
                world.life.celebrate(now);
                if (!reduced) world.life.positions().forEach((position, i) => window.setTimeout(() => effects.confetti(position, performance.now()), i * 180));
            },
        };
        rebuild(latest.current.state, latest.current.ghost, latest.current.selectedId);
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
            world.life.tick(now, delta, reduced, latest.current.time === 'night');
            effects.tick(now, delta);
            world.animate(now, reduced);
            renderer.render(world.scene, camera);
        };
        loop();

        // Touch: a still tap selects; a drag pans, or carries a friend; two fingers zoom.
        const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
        let moved = false, carrying: string | undefined, pendingActor: string | undefined, pinch = 0;
        const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -.04);
        const cast = (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
            ray.setFromCamera(ndc, camera); return ray;
        };
        const ground = (event: PointerEvent) => cast(event).ray.intersectPlane(plane, new T.Vector3());
        const actorAt = (event: PointerEvent) => cast(event).intersectObjects(world.life.objects(), true)[0]?.object.userData.actorId as string | undefined;
        const down = (event: PointerEvent) => {
            renderer.domElement.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY });
            if (pointers.size === 1) { moved = false; pendingActor = actorAt(event); carrying = undefined; }
            if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); pendingActor = undefined; }
        };
        const move = (event: PointerEvent) => {
            const p = pointers.get(event.pointerId); if (!p) return;
            const dx = event.clientX - p.x, dy = event.clientY - p.y; p.x = event.clientX; p.y = event.clientY;
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0) view.zoom = Math.max(1, Math.min(4, view.zoom * distance / pinch));
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
            layer?.dispose(); effects.dispose(); world.dispose(); renderer.dispose(); canvas.remove();
            api.current = undefined;
        };
    }, []);

    useEffect(() => { api.current?.rebuild(state, ghost, selectedId); }, [state, ghost, selectedId]);
    useEffect(() => { api.current?.setTime(time); }, [time]);
    useEffect(() => { if (cheer) api.current?.cheer(); }, [cheer]);
    useEffect(() => { if (festival) api.current?.festival(); }, [festival]);
    const lastTurn = useRef(turn);
    useEffect(() => { if (turn !== lastTurn.current) { api.current?.turn(turn - lastTurn.current); lastTurn.current = turn; } }, [turn]);

    return <div className="growing-world" ref={host} data-growing-world>
        {failed && <p className="growing-world-failed">しまを ひょうじ できなかったよ。よみなおしてみてね。</p>}
    </div>;
}
