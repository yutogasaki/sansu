import type { ResidentSpecies } from './residentRig';

export type ResidentInterestItem = 'flower' | 'lantern' | 'fountain';
export interface ResidentInterestSample {
    headPitch: number;
    headRoll: number;
    look: number;
    lowPaw: number;
    life: number;
}

const rest: ResidentInterestSample = { headPitch: 0, headRoll: 0, look: 0, lowPaw: 0, life: 0 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const pulse = (phase: number, start: number, peak: number, end: number) => phase < peak
    ? smooth((phase - start) / (peak - start)) : 1 - smooth((phase - peak) / (end - peak));

/** The same short interest fits the existing reply and visit clocks. Geometry,
 * routes and actor selection are not part of this sample. Normal endpoints are
 * exact rest; reduced motion is one smaller static pose, independent of time. */
export function sampleResidentInterest(species: ResidentSpecies, phase: number, reduced: boolean): ResidentInterestSample {
    if (reduced) return {
        headPitch: species === 'otter' ? .055 : species === 'fox' ? -.025 : 0,
        headRoll: species === 'rabbit' ? .105 : 0,
        look: .34, lowPaw: species === 'fox' ? .28 : 0, life: .22,
    };
    if (!Number.isFinite(phase) || phase <= 0 || phase >= 1) return { ...rest };
    const attention = pulse(phase, 0, .3, 1);
    // The object answers once, after attention begins. The otter's two nods do
    // not make a flower or a fountain bounce twice like a rubber toy.
    const life = pulse(phase, .16, .6, 1) * .5;
    if (species === 'otter') return {
        headPitch: (pulse(phase, .08, .25, .46) + pulse(phase, .49, .68, .92)) * .145,
        headRoll: 0, look: attention * .72, lowPaw: 0, life,
    };
    if (species === 'rabbit') return {
        headPitch: -.025 * attention, headRoll: .21 * pulse(phase, .08, .44, 1),
        look: attention * .7, lowPaw: 0, life,
    };
    return {
        headPitch: -.04 * attention, headRoll: 0, look: pulse(phase, .04, .52, 1) * .9,
        lowPaw: pulse(phase, .24, .66, 1), life,
    };
}

export function isResidentInterestItem(kind: string): kind is ResidentInterestItem {
    return kind === 'flower' || kind === 'lantern' || kind === 'fountain';
}

/** Explicit runtime context: a source visit made by the shared controller must
 * never become a second arm or material animation through IslandResident.update. */
export function canShowOrdinaryInterest(context: {
    kind: string; action: string; visible: boolean; learning: boolean; editing: boolean; shared: boolean; clearing: boolean;
}) {
    if (!context.visible || context.learning || context.editing || context.shared || context.clearing) return false;
    return (context.kind === 'flower' && context.action === 'sniff')
        || (context.kind === 'lantern' && context.action === 'admire')
        || (context.kind === 'fountain' && context.action === 'watch');
}

export function residentInterestVerb(species: ResidentSpecies, reduced: boolean) {
    if (reduced) return 'そっと みている';
    return species === 'otter' ? 'こくん、こくん' : species === 'rabbit' ? 'くびを かしげた' : 'そっと てを ひらいた';
}
