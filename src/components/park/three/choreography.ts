import { simulateCourse, type PlayBeat } from '../../../domain/park/simulation';
import type { PartKind } from '../../../domain/park/types';

// Three.js coordinates: +X travel, +Y up, +Z toward the viewer. Foot plane Y=0.
// Independent of the legacy Blender projection and its Z-up sprite pivots.
export const TOY = { spacing: 1.75, height: 1.296, start: -1.35, finish: 4.72,
    slideEntry: -.55, slideExit: .72, slideTop: .88, slideBottom: .07,
    trampoline: .23, compression: .105, gateTop: 1.69, jump: 2.18,
    bubbleRadius: .73, bubbleCenter: .65 } as const;
export type Point = { x: number; y: number; z: number };
export type PoseName = 'stand' | 'walk' | 'climb' | 'sit' | 'crouch' | 'push' | 'soar' | 'land' | 'recover' | 'wave';
export const clamp = (t: number) => Math.min(1, Math.max(0, t));
export const smooth = (t: number) => { const p = clamp(t); return p * p * (3 - 2 * p); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (a: Point, b: Point, t: number): Point => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });
export const slotX = (i: number) => i < 0 ? TOY.start : i >= 3 ? TOY.finish : i * TOY.spacing;
export const slideHeight = (t: number) => mix(TOY.slideTop, TOY.slideBottom, smooth(t));

export function contact(layout: readonly (PartKind | null)[], i: number, exit = false): Point {
    const kind = layout[i], x = slotX(i);
    if (kind === 'slide') return { x: x + (exit ? TOY.slideExit : TOY.slideEntry), y: exit ? TOY.slideBottom : TOY.slideTop, z: 0 };
    if (kind === 'bubble') return { x: x + (exit ? .34 : -.34), y: 0, z: 0 };
    return { x, y: kind === 'trampoline' ? TOY.trampoline : 0, z: 0 };
}

export function threeBeatDuration(beat: PlayBeat) {
    switch (beat.action) {
        case 'walk': return beat.fast ? 760 : 1200;
        case 'slide': return 1450;
        case 'jump': return 2100;
        case 'hop': return 1450;
        case 'bubble': return 1050;
        case 'finish': return beat.from === beat.to ? 700 : 1150;
        default: return 850;
    }
}

export interface ToyFrame {
    point: Point;
    pose: PoseName;
    poseAmount: number;
    phase: number;
    bubble: boolean;
    pop: number;
    compression: number;
    contactSlot: number;
}

/** Absolute-time sampling: no physics, rewards, event callbacks, or frame counters. */
export function sampleToy(layout: readonly (PartKind | null)[], beat: PlayBeat | undefined, progress: number): ToyFrame {
    const t = clamp(progress);
    const from = beat ? contact(layout, beat.from, true) : contact(layout, -1);
    const to = beat ? contact(layout, beat.to) : from;
    const frame: ToyFrame = { point: from, pose: 'stand', poseAmount: 0, phase: t, bubble: Boolean(beat?.bubble), pop: 0, compression: 0, contactSlot: -1 };
    if (!beat) return frame;
    if (beat.action === 'walk' || beat.action === 'finish') {
        frame.point = between(from, to, smooth(t));
        frame.pose = t < 1 ? 'walk' : beat.action === 'finish' ? 'wave' : 'stand';
        frame.poseAmount = Math.sin(Math.PI * t) ** .3;
        if (layout[beat.to] === 'slide') {
            // Walk to the first step, then actually climb the entrance, then sit.
            const foot = { x: to.x - .3, y: 0, z: 0 };
            if (t < .35) frame.point = between(from, foot, smooth(t / .35));
            else if (t < .86) {
                const u = (t - .35) / .51;
                frame.point = between(foot, to, u);
                frame.pose = 'climb'; frame.phase = u;
            } else {
                frame.point = to; frame.pose = 'sit'; frame.poseAmount = smooth((t - .86) / .14);
            }
        }
        if (beat.action === 'finish' && beat.from === beat.to) { frame.pose = 'wave'; frame.poseAmount = Math.sin(Math.PI * t); }
    } else if (beat.action === 'slide') {
        const u = smooth(t / .82), start = contact(layout, beat.to), end = contact(layout, beat.to, true);
        frame.point = { x: mix(start.x, end.x, u), y: slideHeight(u), z: 0 };
        frame.pose = 'sit'; frame.poseAmount = 1 - smooth((t - .82) / .18);
    } else if (beat.action === 'bubble') {
        frame.point = between(to, contact(layout, beat.to, true), smooth(t));
        frame.pose = t < 1 ? 'walk' : 'stand'; frame.poseAmount = Math.sin(Math.PI * t) ** .3;
        const beats = simulateCourse(layout);
        const index = beats.findIndex(b => b.action === beat.action && b.from === beat.from && b.to === beat.to);
        const previous = beats[index - 1];
        frame.bubble = t >= .52 || Boolean(previous?.bubble && !previous.popped);
    } else if (beat.action === 'jump' || beat.action === 'hop') {
        const takeoff = contact(layout, beat.from);
        const landing = beat.action === 'hop' ? takeoff : to;
        const flight = clamp((t - .23) / .53);
        frame.point = between(takeoff, landing, flight);
        frame.point.y += 4 * (beat.action === 'jump' ? TOY.jump : .43) * flight * (1 - flight);
        if (t < .16) {
            frame.pose = 'crouch'; frame.poseAmount = smooth(t / .16);
            frame.compression = TOY.compression * frame.poseAmount; frame.contactSlot = beat.from;
        } else if (t < .23) {
            frame.pose = 'push'; frame.poseAmount = 1 - smooth((t - .16) / .07);
            frame.compression = TOY.compression * frame.poseAmount; frame.contactSlot = beat.from;
        } else if (t < .76) { frame.pose = 'soar'; frame.poseAmount = Math.sin(Math.PI * flight); }
        else if (t < .85) {
            frame.pose = 'land'; frame.poseAmount = Math.sin(Math.PI / 2 * (t - .76) / .09);
            if (layout[beat.to] === 'trampoline') { frame.contactSlot = beat.to; frame.compression = TOY.compression * frame.poseAmount; }
        } else {
            frame.pose = 'recover'; frame.poseAmount = 1 - smooth((t - .85) / .15);
            if (layout[beat.to] === 'trampoline') { frame.contactSlot = beat.to; frame.compression = TOY.compression * frame.poseAmount; }
        }
        frame.point.y -= frame.compression;
        if (t >= .76 && beat.popped) { frame.bubble = false; frame.pop = clamp((t - .76) / .24); }
        if (layout[beat.to] === 'slide' && t >= .85) { frame.pose = 'sit'; frame.poseAmount = smooth((t - .85) / .15); }
    }
    return frame;
}
