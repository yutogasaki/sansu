import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as T from 'three';
import readyAtlas from '../../assets/pokomoko-learning-poses.webp';
import type { PokomokoBurst, PokomokoInputCue } from './usePokomokoFeedback';
import type { Style } from '../../domain/islandLife/model';
import { makeLearningActorRig, learningScarfColor } from './learningActor/rig';
import { ACTOR_CATCH_MS, ACTOR_PLACE_MS, ACTOR_JUMP_MS, ACTOR_LAND_MS, sampleInputGesture, sampleBurstGesture } from './learningActor/motion';
import { poseLearningActor } from './learningActor/pose';
import { learningActorFrames } from './learningActor/frame';

type ActorCue = 'catch' | 'place' | 'jump' | 'land';
type TimedInput = PokomokoInputCue & { fromX?: number; fromY?: number; startedAt?: number };
type Props = {
    active: boolean;
    level: number;
    inputCue?: PokomokoInputCue;
    burst?: PokomokoBurst;
    pulse?: () => number;
    onCue?: (kind: ActorCue) => void;
    heroStyle?: Style;
};
type Input = { cue: TimedInput; start: number; side: number; caught: boolean; placed: boolean };
type Burst = { start: number; leap: boolean; big: boolean; jumped: boolean; landed: boolean };

/** A live, articulated rendering of the existing island model. All state here
 * is disposable presentation: it never submits, advances or locks an answer. */
export default function PokomokoLearningActor(props: Props) {
    const root = useRef<HTMLSpanElement>(null);
    const canvasHost = useRef<HTMLSpanElement>(null);
    const anchor = useRef<HTMLSpanElement>(null);
    const shadow = useRef<HTMLSpanElement>(null);
    const latest = useRef(props);
    const [ready, setReady] = useState(false);
    useLayoutEffect(() => { latest.current = props; });

    useEffect(() => {
        const element = root.current, host = canvasHost.current, marker = anchor.current;
        if (!props.active || !element || !host || !marker) { setReady(false); return; }
        // WebGL context loss is asynchronous. Each effect owns a fresh canvas so
        // a StrictMode cleanup cannot invalidate the following setup's context.
        const surface = document.createElement('canvas');
        Object.assign(surface.style, { width: '100%', height: '100%', display: 'block' });
        host.append(surface);
        let renderer: T.WebGLRenderer | undefined;
        let rig: ReturnType<typeof makeLearningActorRig> | undefined;
        try {
            renderer = new T.WebGLRenderer({ canvas: surface, alpha: true, antialias: true, powerPreference: 'low-power' });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setClearColor(0, 0);
            renderer.outputColorSpace = T.SRGBColorSpace;
            renderer.toneMapping = T.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.15;
            rig = makeLearningActorRig();
        } catch {
            renderer?.dispose(); renderer?.forceContextLoss(); rig?.dispose(); surface.remove();
            setReady(false);
            return;
        }
        const actor = rig, view = renderer;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        let width = 1, height = 1, frame = 0, disposed = false, lost = false, rendered = false, renderCount = 0;
        element.dataset.reducedMotion = String(reduced.matches);
        let seenInput: number | undefined, seenBurst: string | undefined;
        let seenStyle: Style = 'original';
        let input: Input | undefined, burst: Burst | undefined;
        let bounds = element.getBoundingClientRect();
        let panelBounds = element.closest('.island-learning')?.getBoundingClientRect() ?? bounds;
        const handPoint = new T.Vector3();
        const localPoint = (x: number, y: number) => ({
            x: x + panelBounds.left - bounds.left,
            y: y + panelBounds.top - bounds.top,
        });
        const resize = () => {
            bounds = element.getBoundingClientRect();
            panelBounds = element.closest('.island-learning')?.getBoundingClientRect() ?? bounds;
            width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
            view.setSize(width, height, false);
            actor.camera.left = -.82 * width / height;
            actor.camera.right = .82 * width / height;
            actor.camera.updateProjectionMatrix();
        };
        const projectHand = (side: number) => {
            actor.hero.updateMatrixWorld(true);
            actor.arms[side < 0 ? 0 : 1].hand.getWorldPosition(handPoint).project(actor.camera);
            const x = (handPoint.x * .5 + .5) * width, y = (-handPoint.y * .5 + .5) * height;
            marker.style.left = `${x}px`; marker.style.top = `${y}px`;
            return { x, y };
        };
        const draw = (now: number) => {
            frame = 0;
            if (disposed || lost || !latest.current.active || document.visibilityState !== 'visible') return;
            const current = latest.current;
            const heroStyle = current.heroStyle ?? 'original';
            if (heroStyle !== seenStyle) {
                actor.scarf.material = actor.m.surface(learningScarfColor(heroStyle), .85);
                seenStyle = heroStyle;
            }
            const cue = current.inputCue as TimedInput | undefined;
            if (cue?.id !== seenInput) {
                seenInput = cue?.id;
                if (cue) {
                    bounds = element.getBoundingClientRect();
                    panelBounds = element.closest('.island-learning')?.getBoundingClientRect() ?? bounds;
                    const from = localPoint(cue.fromX ?? cue.x, cue.fromY ?? cue.y);
                    input = { cue, start: cue.startedAt ?? now, side: from.x < width / 2 ? -1 : 1, caught: false, placed: false };
                    // A new accepted digit owns the body immediately; a previous
                    // celebration cannot pull its catching paw away mid-flight.
                    burst = undefined;
                } else if (input && now - input.start < 400) input = undefined;
            }
            if (current.burst?.id !== seenBurst) {
                seenBurst = current.burst?.id;
                if (current.burst) {
                    const origin = current.burst.origin as TimedInput | undefined;
                    burst = {
                        start: Math.max(current.burst.startedAt, (origin?.startedAt ?? input?.start ?? now - ACTOR_PLACE_MS) + ACTOR_PLACE_MS),
                        leap: ['jump', 'ride', 'stamp', 'section'].includes(current.burst.kind),
                        big: ['ride', 'stamp'].includes(current.burst.kind),
                        jumped: false, landed: false,
                    };
                } else burst = undefined;
            }
            const elapsed = input ? now - input.start : Infinity;
            const gesture = sampleInputGesture(elapsed, reduced.matches);
            const reaction = sampleBurstGesture(burst ? now - burst.start : Infinity, burst?.leap ?? false, reduced.matches, burst?.big);
            const beat = reduced.matches ? 0 : T.MathUtils.clamp(current.pulse?.() ?? 0, 0, 1);
            const hasContact = elapsed >= 0 && elapsed <= ACTOR_PLACE_MS;
            // Beat sway is intentionally tiny and stops during a handoff, keeping
            // both the ground contact and the numeral's catching point stable.
            const sway = hasContact ? 0 : beat * (.006 + Math.min(3, current.level) * .004);
            const side = input?.side ?? -1;
            poseLearningActor(actor, gesture, reaction, side, sway, burst?.big ?? false);
            const paw = projectHand(side);
            actor.head.rotation.set(0, 0, 0, 'YXZ');
            if (input && gesture.look) {
                const from = localPoint(input.cue.fromX ?? input.cue.x, input.cue.fromY ?? input.cue.y);
                const to = localPoint(input.cue.x, input.cue.y);
                const arriving = T.MathUtils.smoothstep(elapsed, 0, ACTOR_CATCH_MS);
                const focusX = elapsed < ACTOR_CATCH_MS ? T.MathUtils.lerp(from.x, paw.x, arriving)
                    : T.MathUtils.lerp(paw.x, to.x, gesture.follow);
                const focusY = elapsed < ACTOR_CATCH_MS ? T.MathUtils.lerp(from.y, paw.y, arriving)
                    : T.MathUtils.lerp(paw.y, to.y, gesture.follow);
                actor.head.rotation.y = T.MathUtils.clamp((focusX / width - .5) * .48, -.32, .32) * gesture.look;
                actor.head.rotation.x = T.MathUtils.clamp((focusY / height - .36) * .30, -.14, .24) * gesture.look;
                actor.head.rotation.z = -side * gesture.reach * .035;
            } else if (!reduced.matches) actor.head.rotation.z = -sway * .65;
            if (shadow.current) {
                shadow.current.style.transform = `scale(${1 - reaction.height * 1.2})`;
                shadow.current.style.opacity = String(.18 - reaction.height * .35);
            }
            view.render(actor.scene, actor.camera);
            if (!reduced.matches && current.burst && ['ride', 'stamp'].includes(current.burst.kind)) {
                let copy = learningActorFrames.get(element);
                if (!copy) { copy = document.createElement('canvas'); learningActorFrames.set(element, copy); }
                if (copy.width !== surface.width || copy.height !== surface.height) {
                    copy.width = surface.width; copy.height = surface.height;
                }
                const ink = copy.getContext('2d');
                ink?.clearRect(0, 0, copy.width, copy.height);
                ink?.drawImage(surface, 0, 0);
            } else learningActorFrames.delete(element);
            element.dataset.renderCount = String(++renderCount);
            if (!rendered) { rendered = true; setReady(true); }
            if (input && elapsed >= 0 && elapsed < 620) {
                if (!input.caught && (reduced.matches || elapsed >= ACTOR_CATCH_MS)) { input.caught = true; current.onCue?.('catch'); }
                if (!input.placed && (reduced.matches || elapsed >= ACTOR_PLACE_MS)) { input.placed = true; current.onCue?.('place'); }
            }
            if (burst?.leap && !reduced.matches) {
                const age = now - burst.start;
                if (!burst.jumped && age >= ACTOR_JUMP_MS && age < ACTOR_LAND_MS) { burst.jumped = true; current.onCue?.('jump'); }
                if (!burst.landed && age >= ACTOR_LAND_MS && age < 880) { burst.landed = true; current.onCue?.('land'); }
            }
            frame = requestAnimationFrame(draw);
        };
        const start = () => {
            if (!frame && !disposed && !lost && document.visibilityState === 'visible') frame = requestAnimationFrame(draw);
        };
        const stop = () => { cancelAnimationFrame(frame); frame = 0; };
        const visibility = () => {
            stop(); input = undefined; burst = undefined;
            // Returning to the tab must never replay an old touch or celebration.
            seenInput = latest.current.inputCue?.id; seenBurst = latest.current.burst?.id;
            if (document.visibilityState === 'visible') { resize(); start(); }
        };
        const motionPreference = () => {
            element.dataset.reducedMotion = String(reduced.matches);
            input = undefined; burst = undefined; start();
        };
        const contextLost = (event: Event) => { event.preventDefault(); lost = true; rendered = false; stop(); setReady(false); };
        const contextRestored = () => { lost = false; resize(); start(); };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        document.addEventListener('visibilitychange', visibility);
        reduced.addEventListener('change', motionPreference);
        surface.addEventListener('webglcontextlost', contextLost);
        surface.addEventListener('webglcontextrestored', contextRestored);
        resize(); draw(performance.now());
        return () => {
            learningActorFrames.delete(element);
            disposed = true; stop(); observer.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            reduced.removeEventListener('change', motionPreference);
            surface.removeEventListener('webglcontextlost', contextLost);
            surface.removeEventListener('webglcontextrestored', contextRestored);
            actor.dispose(); view.dispose(); view.forceContextLoss(); surface.remove();
        };
    }, [props.active]);

    return <span ref={root} className="pokomoko-learning-actor pokomoko-learning-actor-live" aria-hidden="true" data-renderer={ready ? 'live-original' : 'original-fallback'} data-fallback-url={readyAtlas} data-hero-style={props.heroStyle ?? 'original'}>
        <span ref={shadow} style={{ position: 'absolute', left: '28%', width: '44%', height: '8%', bottom: '8%', borderRadius: '50%', background: '#1b1d4d', opacity: .18 }} />
        <span style={{ position: 'absolute', inset: 0, visibility: ready ? 'hidden' : 'visible', backgroundImage: `url(${readyAtlas})`, backgroundSize: '800% 100%', backgroundPosition: '0 0', backgroundRepeat: 'no-repeat' }} />
        <span ref={canvasHost} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', visibility: ready ? 'visible' : 'hidden' }} />
        <span ref={anchor} className="pokomoko-hand-anchor" style={{ position: 'absolute', left: '28%', top: '60%', width: 1, height: 1, pointerEvents: 'none' }} />
    </span>;
}
