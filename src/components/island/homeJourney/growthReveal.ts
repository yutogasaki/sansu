import { HOME_JOURNEY_STEPS, type HomeJourneyState } from '../../../domain/island/homeJourney';

const TARGETS = new Map<number, string>([
    [3, 'flower'], [9, 'home-canopy'], [15, 'shop'],
    [21, 'bench'], [33, 'home-terrace'], [45, 'parcel'],
]);

export function crossedHomeJourneyStep(before?: HomeJourneyState, after?: HomeJourneyState) {
    const from = before?.answers ?? 0, to = after?.answers ?? 0;
    return [...HOME_JOURNEY_STEPS].reverse().find(step => step.at > from && step.at <= to);
}

export function homeJourneyGrowthTarget(at?: number) {
    return at === undefined ? undefined : TARGETS.get(at);
}

export function growthRevealScale(seconds: number, reducedMotion = false) {
    if (reducedMotion) return 1;
    const t = Math.max(0, Math.min(1, Number.isFinite(seconds) ? seconds / 1.6 : 0));
    const c1 = 1.35, c3 = c1 + 1;
    return Math.max(.04, 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2);
}

export function growthDeliverySeconds(elapsedMs: number, growthAt?: number) {
    const elapsed = Math.max(0,Number.isFinite(elapsedMs) ? elapsedMs : 0);
    if (growthAt !== 45) return elapsed/1000;
    return elapsed < 2500 ? 10 + Math.min(2,elapsed/800) : elapsed/1000-2.5;
}
