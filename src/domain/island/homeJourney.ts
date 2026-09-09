/** Development-only parallel progression. No retrospective or render-time credit. */
export interface HomeJourneyState { version: 1; answers: number }
export const HOME_JOURNEY_CANDIDATE = 'home-journey-growth-reveal-v6';
export const HOME_JOURNEY_STEPS = [
    { at: 3, title: 'おはなが さいた' }, { at: 9, title: 'おうちに ひさしが できた' },
    { at: 15, title: 'ちいさな やたいが できた' }, { at: 21, title: 'ベンチが ふかふかに なった' },
    { at: 33, title: 'おうちに テラスが できた' }, { at: 45, title: 'おみせから おとどけもの' },
] as const;
export function homeJourneyEnabled() {
    return import.meta.env.DEV && import.meta.env.VITE_HOME_JOURNEY_PREVIEW === 'true';
}
export function validHomeJourney(value: unknown): value is HomeJourneyState | undefined {
    if (value === undefined) return true;
    if (!value || typeof value !== 'object') return false;
    const state = value as HomeJourneyState;
    return state.version === 1 && Number.isSafeInteger(state.answers) && state.answers >= 0 && state.answers <= 45;
}
export function advanceHomeJourney(state: HomeJourneyState | undefined, answers: number): HomeJourneyState {
    if (!validHomeJourney(state) || !Number.isSafeInteger(answers) || answers < 1 || answers > 6) throw new Error('Invalid home journey completion');
    return { version: 1, answers: Math.min(45, (state?.answers ?? 0) + answers) };
}
export function homeJourneyView(state?: HomeJourneyState) {
    const answers = state?.answers ?? 0;
    return { answers, home: answers >= 33 ? 3 : answers >= 9 ? 2 : 1,
        shop: answers >= 45 ? 2 : answers >= 15 ? 1 : 0,
        flower: answers >= 3 ? 2 : 1, bench: answers >= 21 ? 2 : 1,
        next: HOME_JOURNEY_STEPS.find(step => step.at > answers),
        latest: [...HOME_JOURNEY_STEPS].reverse().find(step => step.at <= answers) };
}
