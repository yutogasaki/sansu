import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials } from './primitives';
import { chooseSharedActivity } from './sharedActivities';
import { SharedActivityController } from './sharedActivityController';
import type { SharedActivityHands } from './sharedActivityController';
import { SharedActivityVisuals } from './sharedActivityVisuals';
import type { IslandStageItem } from './types';

const PAIRS = [
    { kind: 'flower', source: 'flower', seat: 'bench' },
    { kind: 'star', source: 'lantern', seat: 'mushroom' },
    { kind: 'bubble', source: 'fountain', seat: 'swing' },
] as const;
const BOUNDARIES = ['gather→carry', 'carry→share', 'share→enjoy', 'enjoy→settled'];
// At a 1 ms sample a .01 world-unit displacement already permits 10 units/s,
// well above the ordinary walking/arm speed. Phase changes are not teleports.
const MAX_ONE_MS_DISPLACEMENT = .01;
const HANDS = (['left', 'right'] as const).flatMap(carrier => (['left', 'right'] as const)
    .map(receiver => ({ carrier, receiver }) satisfies SharedActivityHands));
const CASES = PAIRS.flatMap(pair => HANDS.map(hands => ({ ...pair, hands, label: `${hands.carrier}/${hands.receiver}` })));

describe('shared props remain attached while the real resident poses change phase', () => {
    it.each(CASES)('$kind $label keeps actual holding paws and the prop continuous across every handoff boundary', pair => {
        const materials = new IslandMaterials(), visuals = new SharedActivityVisuals(materials);
        const residents = [
            new IslandResident('otter', materials, [-2.5, 0, 1.4], () => {}),
            new IslandResident('rabbit', materials, [2.7, 0, .3], () => {}),
            new IslandResident('fox', materials, [6.4, 0, .9], () => {}),
        ];
        const items: IslandStageItem[] = [
            { id: 'source', kind: pair.source, position: { x: 1.5, z: 1.8 }, rotation: 0 },
            { id: 'seat', kind: pair.seat, position: { x: -.5, z: .7 }, rotation: Math.atan2(2, 1.1) },
        ];
        const plan = chooseSharedActivity(items, residents.map(resident => ({ position: resident.group.position,
            visible: true, itemId: resident.itemId })), 6, 'source')!;
        expect(plan).toBeDefined();
        const controller = new SharedActivityController(residents, visuals, () => {});
        const seen: string[] = [];
        let previous: { phase: string; carrier: THREE.Vector3; receiver: THREE.Vector3; prop: THREE.Vector3 } | undefined;
        let settled = false;
        try {
            expect(controller.start(plan, 0, false, items, 6, pair.hands)).toBe(true);
            // Match runtime ordering: ordinary grounded pose, shared pose, then
            // physical hand/mesh positions. Start/reduced/cancel are not sampled.
            for (let now = 0; now <= 20000; now++) {
                for (const resident of residents) resident.update(now);
                controller.update(now, false);
                const snapshot = controller.snapshot()!;
                const current = {
                    phase: snapshot.phase,
                    carrier: residents[plan.carrier].handAnchor(new THREE.Vector3(), pair.hands.carrier),
                    receiver: residents[plan.receiver].handAnchor(new THREE.Vector3(), pair.hands.receiver),
                    prop: new THREE.Vector3(...snapshot.prop.position),
                };
                if (previous && previous.phase !== current.phase) {
                    const boundary = `${previous.phase}→${current.phase}`;
                    if (BOUNDARIES.includes(boundary)) {
                        seen.push(boundary);
                        for (const target of ['carrier', 'receiver', 'prop'] as const) {
                            const displacement = current[target].distanceTo(previous[target]);
                            expect.soft(displacement, `${pair.kind} ${boundary} ${target} jumps ${displacement.toFixed(6)} units in 1 ms`)
                                .toBeLessThan(MAX_ONE_MS_DISPLACEMENT);
                        }
                    }
                }
                previous = current;
                if (current.phase === 'settled') { settled = true; break; }
            }
            expect(settled).toBe(true);
            expect(seen).toEqual(BOUNDARIES);
        } finally {
            controller.cancel(20000);
            visuals.dispose();
            for (const resident of residents) {
                resident.group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
            }
            materials.dispose();
        }
    });
});
