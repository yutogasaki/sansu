import type { PlayBeat } from '../../domain/park/simulation';
import type { PartKind } from '../../domain/park/types';

// Unit geometry shared with art/park. Camera angles and pivots come from Blender.
export const PARK_GEOMETRY = { spacing: 1.5, actorHeight: 1, bubbleRadius: .6, bubbleCenter: .54,
    gateHeight: 1.435, jumpHeight: 3.2, ppu: 120, yaw: 25, elevation: 15 } as const;
export type DollPose = 'stand' | 'walk-a' | 'walk-b' | 'sit' | 'soar' | 'crouch' | 'land' | 'wave';
export type Point3 = { x: number; y: number; z: number };
const radians = (angle: number) => angle * Math.PI / 180;
const yaw = radians(PARK_GEOMETRY.yaw), elevation = radians(PARK_GEOMETRY.elevation);
export function project({ x, y, z }: Point3) {
    return { x: (x * Math.cos(yaw) + y * Math.sin(yaw)) * PARK_GEOMETRY.ppu,
        y: (x * Math.sin(yaw) * Math.sin(elevation) - y * Math.cos(yaw) * Math.sin(elevation) - z * Math.cos(elevation)) * PARK_GEOMETRY.ppu };
}
export const depth = ({ x, y, z }: Point3) => x * Math.sin(yaw) * Math.cos(elevation) - y * Math.cos(yaw) * Math.cos(elevation) + z * Math.sin(elevation);
export const slotX = (index: number, length: number) => index < 0 ? -1 : index >= length ? (length - 1) * 1.5 + 1.25 : index * 1.5;
const clamp = (p: number) => Math.max(0, Math.min(1, p));
const smooth = (p: number) => p * p * (3 - 2 * p);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function contact(index: number, layout: readonly (PartKind | null)[], exit: boolean): Point3 {
    const x = slotX(index, layout.length), kind = layout[index];
    if (kind === 'slide') return { x: x + (exit ? .64 : -.48), y: 0, z: exit ? .1 : .685 };
    if (kind === 'bubble' || kind === 'paint') return { x: x + (exit ? .31 : -.31), y: 0, z: 0 };
    return { x, y: 0, z: kind === 'trampoline' ? .17 : kind === 'mat' ? .2 : 0 };
}

/** Rendering is a pure sample of a deterministic beat, never a source of game events. */
export function sampleParkBeat(layout: readonly (PartKind | null)[], beat: PlayBeat | undefined, progress: number) {
    const t = clamp(progress);
    const start = beat ? contact(beat.from, layout, true) : contact(-1, layout, false);
    const end = beat ? contact(beat.to, layout, false) : start;
    let point = { ...start }, pose: DollPose = 'stand';
    if (beat?.action === 'walk' || beat?.action === 'finish') {
        // A skipped landing is already at the next part's entrance; finish at the edge is stationary.
        point = { x: mix(start.x, end.x, smooth(t)), y: 0, z: mix(start.z, end.z, smooth(t)) };
        pose = t === 1 ? (layout[beat.to] === 'slide' ? 'sit' : beat.action === 'finish' ? 'wave' : 'stand') : Math.floor(t * 6) % 2 ? 'walk-a' : 'walk-b';
    } else if (beat?.action === 'slide') {
        const s = contact(beat.to, layout, false), e = contact(beat.to, layout, true);
        const x = mix(s.x, e.x, smooth(t));
        const u = clamp((x - beat.to * 1.5 + .48) / 1.08);
        const surface = .1 + .63 * (1 - smooth(u));
        point = { x, y: 0, z: surface - .045 * (1 - smooth(clamp((t - .9) / .1))) };
        pose = t < .9 ? 'sit' : 'stand';
    } else if (beat?.action === 'jump' || beat?.action === 'hop') {
        const takeoff = contact(beat.from, layout, false);
        const landing = beat.action === 'hop' ? takeoff : end;
        const flight = clamp((t - .12) / .73);
        const h = beat.action === 'jump' ? PARK_GEOMETRY.jumpHeight : .55;
        point = { x: mix(takeoff.x, landing.x, flight), y: 0,
            z: mix(takeoff.z, landing.z, flight) + 4 * h * flight * (1 - flight) };
        pose = t < .12 ? 'crouch' : t < .85 ? 'soar' : t < 1 ? 'land' : layout[beat.to] === 'slide' ? 'sit' : 'stand';
    } else if (beat?.action === 'bubble' || beat?.action === 'paint') {
        const s = contact(beat.to, layout, false), e = contact(beat.to, layout, true);
        point = { x: mix(s.x, e.x, smooth(t)), y: 0, z: 0 };
        pose = t < 1 ? 'walk-a' : 'stand';
    } else if (beat) { point = end; pose = beat.action === 'bell' && t > .35 ? 'wave' : 'stand'; }
    const landed = Boolean(beat?.popped && t >= .85);
    return { point, pose, bubble: Boolean(beat?.bubble && !landed && (beat.action !== 'bubble' || t >= .55)), popped: landed,
        pink: Boolean(beat?.pink && (beat.action !== 'paint' || t >= .55)), bubblePink: Boolean(beat?.bubblePink), progress: t };
}
