import { describe, expect, it } from 'vitest';
import { simulateCourse } from '../../domain/park/simulation';
import { PARK_GEOMETRY, project, sampleParkBeat, slotX } from './sceneGeometry';
import type { PartKind } from '../../domain/park/types';
import manifest from './artManifest.json';

describe('Blender course geometry', () => {
    it('uses the exported camera projection and scale', () => {
        expect(manifest.ppu).toBe(PARK_GEOMETRY.ppu);
        expect(manifest.camera.yaw).toBe(PARK_GEOMETRY.yaw);
        expect(manifest.camera.elevation).toBe(PARK_GEOMETRY.elevation);
        // A diagonal orthographic camera changes both screen coordinates per slot.
        expect(project({ x: 1.5, y: 0, z: 0 }).y).toBeGreaterThan(0);
        expect(project({ x: 0, y: 0, z: 1 }).y).toBeCloseTo(-115.9111, 3);
    });

    it('clears a skipped gate over the entire actor/bubble overlap, including the short final jump', () => {
        for (const layout of [
            ['slide', 'trampoline', 'bubble'],
            ['slide', 'bubble', 'trampoline', 'bubble'],
            ['slide', 'bubble', 'trampoline', 'bubble', null],
        ] as (PartKind | null)[][]) {
            const beat = simulateCourse(layout).find(b => b.action === 'jump')!;
            const gateX = beat.skipped! * 1.5;
            let samples = 0;
            for (let i = 0; i <= 1000; i++) {
                const state = sampleParkBeat(layout, beat, i / 1000);
                // A conservative horizontal envelope includes the turned hoop and full orb.
                const radius = beat.bubble ? .6 : .31;
                if (Math.abs(state.point.x - gateX) < radius + .23) {
                    const bottom = state.point.z + (beat.bubble ? -.06 : 0);
                    expect(bottom, `${layout.join(',')} at ${i}: ${bottom}`).toBeGreaterThan(PARK_GEOMETRY.gateHeight + .1);
                    samples++;
                }
            }
            expect(samples).toBeGreaterThan(100);
        }
    });

    it('keeps landing feet inside the plinth at every course length', () => {
        for (let length = 3; length <= 6; length++) {
            const layout = Array<PartKind | null>(length).fill(null);
            layout[length - 2] = 'slide'; layout[length - 1] = 'trampoline';
            const beat = simulateCourse(layout).find(b => b.action === 'jump')!;
            const landed = sampleParkBeat(layout, beat, 1);
            expect(landed.point.x).toBe(slotX(length, length));
            expect(landed.point.x + .2).toBeLessThan((length - 1) * 1.5 + 1.55);
            expect(landed.point.z).toBe(0);
        }
    });

    it('attaches on the ground and pops at landing even when intermediate frames are omitted', () => {
        const layout: PartKind[] = ['slide', 'bubble', 'trampoline'];
        const beats = simulateCourse(layout);
        const attach = beats.find(b => b.action === 'bubble')!, jump = beats.find(b => b.action === 'jump')!;
        expect(sampleParkBeat(layout, attach, .3).bubble).toBe(false);
        expect(sampleParkBeat(layout, attach, .6).bubble).toBe(true);
        expect(sampleParkBeat(layout, jump, .5).bubble).toBe(true);
        expect(sampleParkBeat(layout, jump, .84).popped).toBe(false);
        expect(sampleParkBeat(layout, jump, .85).popped).toBe(true);
        expect(sampleParkBeat(layout, jump, 10).bubble).toBe(false);
        expect(sampleParkBeat(layout, jump, 10).popped).toBe(true);
    });

    it('lands continuously before activating the destination part', () => {
        for (const kind of ['slide', 'bubble', 'paint', 'trampoline', 'mat', 'bell'] as PartKind[]) {
            const layout: PartKind[] = ['slide', 'trampoline', 'mat', kind];
            const beats = simulateCourse(layout), i = beats.findIndex(b => b.action === 'jump');
            const landed = sampleParkBeat(layout, beats[i], 1);
            const next = sampleParkBeat(layout, beats[i + 1], 0);
            expect(next.point.x).toBeCloseTo(landed.point.x, 10);
            expect(next.point.y).toBeCloseTo(landed.point.y, 10);
            expect(next.point.z).toBeCloseTo(landed.point.z, 10);
        }
    });
});
