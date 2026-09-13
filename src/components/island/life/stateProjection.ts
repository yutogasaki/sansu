import type { LifeState } from '../../../domain/islandLife/model';
import { advanceLifeState } from '../../../domain/islandLife/simulation';
import { sampleLifeRoaming } from './roamingPresentation';

/** Project formal visits between persistence refreshes. Recompute paths only at
 * an actual visit/reward boundary, never once per animation frame. */
export function makeLifeStateProjection(source: LifeState) {
    let base = structuredClone(source), boundary = source.now;
    return (now: number): LifeState => {
        if (source.scenePose === 'captured-v1') return source;
        if (!source.tourVersion) return sampleLifeRoaming(source, now);
        if (now < base.now) { base = structuredClone(source); boundary = source.now; }
        if (now >= boundary) {
            // A fresh identity also invalidates the legacy roaming presentation
            // cache when a real visit has completed or its reservation changed.
            base = structuredClone(base); advanceLifeState(base, Math.max(base.now, now));
            boundary = Math.min(...base.residents.flatMap(r => r.visit ? [r.visit.end, ...(r.playTour ? [base.now + r.playTour.remainingMs] : [])] : []));
        }
        const touring = base.residents.some(r => r.playTour);
        const visible = touring ? base : sampleLifeRoaming(base, now);
        return { ...visible, now, items: source.items, residents: visible.residents.map(r => r.playTour && r.visit
            ? { ...r, playTour: { ...r.playTour, remainingMs: r.playTour.remainingMs - (now - base.now) } } : r) };
    };
}
