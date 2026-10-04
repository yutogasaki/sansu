import { expect, it } from 'vitest';
import { AdaptiveIslandQuality } from './adaptiveIslandQuality';
function run(q: AdaptiveIslandQuality, start: number, count: number, gap = 16) {
    for (let i = 0; i < count; i++) q.sample(start + i * gap, true);
    return start + count * gap;
}
it('opens at the proven floor, then earns every step with sustained frames', () => {
    const q = new AdaptiveIslandQuality(2);
    expect(q.ratio).toBe(.65);
    let now = run(q, 0, 180); expect(q.ratio).toBe(.65);
    now = run(q, now, 20); expect(q.ratio).toBe(.8);
    now = run(q, now, 200); expect(q.ratio).toBe(1);
    now = run(q, now, 200); expect(q.ratio).toBe(1.25);
    run(q, now, 500); expect(q.ratio).toBe(1.25);
});
it('allows a stable 30fps device and caps at device density', () => {
    const q = new AdaptiveIslandQuality(1);
    run(q, 0, 400, 33.3); expect(q.ratio).toBe(1);
});
it('does not treat a single slow frame as persistent overload', () => {
    const q = new AdaptiveIslandQuality(1.25);
    let now = run(q, 0, 200);
    q.sample(now + 80, true); now = run(q, now + 96, 200);
    expect(q.ratio).toBe(1);
    run(q, now, 200); expect(q.ratio).toBe(1.25);
});
it('steps back after sustained overload and never repeatedly promotes into it', () => {
    const q = new AdaptiveIslandQuality(1.25);
    let now = run(q, 0, 400); expect(q.ratio).toBe(1);
    while (q.ratio === 1) { q.sample(now, true); now += 60; }
    expect(q.ratio).toBe(.8);
    run(q, now, 1000); expect(q.ratio).toBe(.8);
});
it('waits while startup is slow, then reevaluates after it warms up', () => {
    const q = new AdaptiveIslandQuality(1.25);
    const now = run(q, 0, 100, 60); expect(q.ratio).toBe(.65);
    run(q, now, 1000); expect(q.ratio).toBe(1.25);
});
it.each(['hidden', 'suspended', 'resized'] as const)('requires fresh stability after %s', reason => {
    const q = new AdaptiveIslandQuality(1.25);
    run(q, 0, 180);
    if (reason === 'hidden') q.sample(3000, false);
    if (reason === 'resized') q.reset();
    const now = run(q, 6000, 100); expect(q.ratio).toBe(.65);
    run(q, now, 100); expect(q.ratio).toBe(.8);
});
it('bounds automatic context recovery by lowering its ceiling on every failure', () => {
    const q = new AdaptiveIslandQuality(1.25);
    expect(q.fallbackCeiling()).toBeUndefined();
    run(q, 0, 600); expect(q.fallbackCeiling()).toBe(1);
    const retry = new AdaptiveIslandQuality(q.fallbackCeiling()!);
    run(retry, 0, 800); expect(retry.ratio).toBe(1); expect(retry.fallbackCeiling()).toBe(.8);
    const last = new AdaptiveIslandQuality(.65);
    run(last, 0, 800); expect(last.ratio).toBe(.65); expect(last.fallbackCeiling()).toBeUndefined();
});

it('responds to very slow visible frames instead of treating every one as suspension', () => {
    const q = new AdaptiveIslandQuality(1.25);
    const now = run(q, 0, 400);
    run(q, now, 22, 500); expect(q.ratio).toBe(.8);
});
it('uses the safe floor for invalid density limits', () => {
    const q = new AdaptiveIslandQuality(Number.NaN);
    run(q, 0, 600); expect(q.ratio).toBe(.65);
});
