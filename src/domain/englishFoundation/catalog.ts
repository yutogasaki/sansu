import type { FoundationForm, FoundationSlot, FoundationTarget, FoundationUnit } from './types';
export const FOUNDATION_CATALOG_VERSION = 'foundation-v1' as const;
export const FOUNDATION_UNITS = [
    { id: 'F01' as const, title: 'A・B・Cに あおう', targets: ['A', 'B', 'C'] as FoundationTarget[] },
    { id: 'F02' as const, title: 'えいごの おとを きこう', targets: ['apple', 'cat', 'dog'] as FoundationTarget[] },
];
export const foundationAudio = (target: FoundationTarget) => `/foundation/v1/audio/${target}.mp3`;
export const foundationPicture = (target: FoundationTarget) => `/foundation/v1/pictures/${target}.svg`;
export function makeFoundationSlots(unit: FoundationUnit, sequence: number): FoundationSlot[] {
    const targets = FOUNDATION_UNITS.find(u => u.id === unit)!.targets;
    return targets.map((_, index) => {
        const target = targets[(index + sequence) % targets.length];
        const form: FoundationForm = unit === 'F02' ? 'word-listening' : index === 0 ? 'shape' : 'letter-name';
        // Position rotates independently from the answer; snapshots persist this exact order.
        const offset = (sequence * 2 + index * 2) % targets.length;
        return { index, target, form, choices: [...targets.slice(offset), ...targets.slice(0, offset)],
            audio: foundationAudio(target), picture: unit === 'F02' ? foundationPicture(target) : undefined,
            support: 'none' };
    });
}
