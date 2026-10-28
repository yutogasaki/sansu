export type TrialTimingName = 'applyIntent' | 'editableIslandWorld' | 'compileWorldDefinition' | 'GrowingWorld.rebuild' | 'worldScene.layout';
interface Span { id: number; parentId: number | null; name: TrialTimingName; detail: string; startMs: number; endMs: number; inclusiveMs: number; selfMs: number; failed: boolean }
interface Token { id: number; parentId: number | null; name: TrialTimingName; detail: string; start: number; children: number }
interface Aggregate { calls: number; inclusiveMs: number; selfMs: number; maxMs: number; failed: number }
const LIMIT = 400;
const roots = new Set<TrialTimingName>(['applyIntent', 'GrowingWorld.rebuild', 'worldScene.layout']);
let active = false, started = 0, ended = 0, startedEpoch = 0, sequence = 0, dropped = 0, filteredFastTerrainCalls = 0;
let spans: Span[] = [], stack: Token[] = [];
let aggregates = new Map<string, Aggregate>();
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Explicit event-handler control only. No game state or storage access. */
export function startTrialTiming() {
    if (stack.length) return false;
    active = true; started = performance.now(); startedEpoch = performance.timeOrigin + started; ended = 0;
    sequence = 0; dropped = 0; filteredFastTerrainCalls = 0; spans = []; stack = []; aggregates = new Map();
    return true;
}
export function stopTrialTiming() { active = false; ended = performance.now(); }

/** Standalone domain calls (including React render calculations) are excluded.
 * Only a measured event/effect root and its synchronous descendants record. */
export function trialTimingEnter(name: TrialTimingName, detail = ''): Token | undefined {
    try {
        if (!active || (!stack.length && !roots.has(name))) return;
        const token = { id: ++sequence, parentId: stack.at(-1)?.id ?? null, name, detail, start: performance.now(), children: 0 };
        stack.push(token); return token;
    } catch { return; }
}
export function trialTimingDetail(token: Token | undefined, detail: string) { if (token) token.detail = detail; }
export function trialTimingExit(token: Token | undefined, failed = false) {
    if (!token) return;
    try {
        const end = performance.now(), inclusiveMs = end - token.start, selfMs = Math.max(0, inclusiveMs - token.children);
        if (stack.at(-1) !== token) return;
        stack.pop(); const parent = stack.at(-1); if (parent) parent.children += inclusiveMs;
        const key = `${token.name}:${token.detail}`, previous = aggregates.get(key) ?? { calls: 0, inclusiveMs: 0, selfMs: 0, maxMs: 0, failed: 0 };
        previous.calls++; previous.inclusiveMs += inclusiveMs; previous.selfMs += selfMs; previous.maxMs = Math.max(previous.maxMs, inclusiveMs); previous.failed += Number(failed);
        aggregates.set(key, previous);
        // Tiny hot-cache/no-terrain spans retain aggregate counts without flooding JSON.
        if (token.name === 'editableIslandWorld' && token.detail !== 'cold' && inclusiveMs < .1) { filteredFastTerrainCalls++; return; }
        if (spans.length >= LIMIT) { dropped++; return; }
        spans.push({ id: token.id, parentId: token.parentId, name: token.name, detail: token.detail,
            startMs: token.start - started, endMs: end - started, inclusiveMs, selfMs, failed });
    } catch { /* Observation must not replace a game result or exception. */ }
}
export function trialTimingSnapshot() {
    return { status: active ? 'recording' : started ? 'stopped' : 'idle', clock: 'performance.now milliseconds from CPU measurement start',
        startedPerformanceMs: round(started), startedEpochMs: round(startedEpoch), endedPerformanceMs: ended ? round(ended) : null,
        elapsedMs: started ? round((ended || performance.now()) - started) : 0, retainedLimit: LIMIT, dropped, filteredFastTerrainCalls,
        incompleteSpans: stack.length,
        scope: 'applyIntent / GrowingWorld.rebuild / worldScene.layout synchronous roots and their domain descendants; standalone render computations, GPU, async saves, browser layout and paint excluded',
        aggregation: 'inclusive intervals nest: do not add inclusive totals. selfMs subtracts measured direct child intervals; uninstrumented work stays in parent selfMs.',
        aggregates: Object.fromEntries([...aggregates].map(([key, value]) => [key, { ...value,
            inclusiveMs: round(value.inclusiveMs), selfMs: round(value.selfMs), maxMs: round(value.maxMs) }])),
        spans: [...spans].sort((a, b) => a.id - b.id).map(span => ({ ...span, startMs: round(span.startMs), endMs: round(span.endMs), inclusiveMs: round(span.inclusiveMs), selfMs: round(span.selfMs) })),
    };
}
