import { describe, expect, it } from 'vitest';
import { chooseLifeTarget, type LifeChoice } from './lifeChoices';
import { SharedPlayOverlap } from './sharedPlay';

const choices: LifeChoice[] = [
    { id: 'trees', likes: ['tree'], fresh: true }, { id: 'flowers', likes: ['flower'], fresh: true },
    { id: 'known-water', likes: ['water'], fresh: false }, { id: 'walk', likes: [], fresh: false, stroll: true },
];
describe('resident destination decisions', () => {
    it('keeps home fallback out of preferred activity so a mellow resident can visit a new shared garden', () => {
        expect(chooseLifeTarget([{ id: 'home', likes: ['quiet'], fresh: false, stroll: true },
            { id: 'garden', likes: ['play'], fresh: true }], [], 'mellow', [], () => 0)?.id).toBe('garden');
    });
    it('uses disjoint 40/25/20/15 groups, likes and recent-three fallback', () => {
        expect(chooseLifeTarget(choices, ['tree'], 'mellow', [], () => 0)?.id).toBe('trees');
        expect(chooseLifeTarget(choices, ['tree'], 'mellow', [], () => .41)?.id).toBe('flowers');
        expect(chooseLifeTarget(choices, ['tree'], 'mellow', [], () => .66)?.id).toBe('known-water');
        expect(chooseLifeTarget(choices, ['tree'], 'mellow', [], () => .90)?.id).toBe('walk');
        expect(chooseLifeTarget(choices, ['tree'], 'mellow', ['trees', 'flowers', 'known-water'], () => 0)?.id).toBe('walk');
        expect(chooseLifeTarget([choices[0]], ['tree'], 'mellow', ['trees'], () => 0)?.id).toBe('trees');
        expect(chooseLifeTarget([], [], 'mellow', [], () => 0)).toBeUndefined();
    });
    it('lets personality prefer actual food/quiet/play or a nearby home', () => {
        const sites: LifeChoice[] = [{ id: 'meal', likes: ['food'], fresh: false }, { id: 'rest', likes: ['quiet'], fresh: false },
            { id: 'swing', likes: ['play'], fresh: false }, { id: 'near', likes: [], fresh: false, nearHome: true }];
        for (const [trait, expected] of [['hungry', 'meal'], ['mellow', 'rest'], ['lively', 'swing'], ['shy', 'near']] as const)
            expect(chooseLifeTarget(sites, [], trait, [], () => 0)?.id).toBe(expected);
    });
});
describe('shared explicit play visibility clock', () => {
    it('requires three seconds of overlapping foreground frames and never adds hidden elapsed time', () => {
        const overlap = new SharedPlayOverlap();
        for (let now = 0; now < 3000; now += 100) expect(overlap.observe(now, ['friend'])).toEqual([]);
        expect(overlap.observe(3000, ['friend'])).toEqual([{ actorId: 'friend', overlapMs: 3000 }]);
        overlap.observe(3100, []);
        expect(overlap.observe(100000, ['friend'])).toEqual([]);
        expect(overlap.observe(200000, ['friend'])).toEqual([]);
        overlap.clear(); expect(overlap.observe(200100, ['friend'])).toEqual([]);
    });
});
