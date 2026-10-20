import type { Like, Trait } from '../../../domain/growingIsland/types';

export interface LifeChoice { id: string; likes: readonly Like[]; fresh: boolean; stroll?: boolean; nearHome?: boolean }
/** Disjoint groups, empty groups renormalized. RNG belongs to presentation only. */
export function chooseLifeTarget<T extends LifeChoice>(choices: readonly T[], likes: readonly Like[], trait: Trait,
    recent: readonly string[], random: () => number = Math.random): T | undefined {
    const alternatives = choices.filter(choice => !recent.includes(choice.id));
    const available = alternatives.length ? alternatives : choices;
    const preferred = (choice: T) => !choice.stroll && (choice.likes.some(like => likes.includes(like))
        || trait === 'hungry' && choice.likes.some(like => like === 'food' || like === 'farm')
        || trait === 'mellow' && choice.likes.includes('quiet') || trait === 'shy' && choice.nearHome
        || trait === 'lively' && choice.likes.includes('play'));
    const groups: T[][] = [[], [], [], []];
    for (const choice of available) groups[preferred(choice) ? 0 : choice.stroll ? 3 : choice.fresh ? 1 : 2].push(choice);
    const weights = [40, 25, 20, 15], total = groups.reduce((sum, group, i) => sum + (group.length ? weights[i] : 0), 0);
    let roll = Math.min(.999999, Math.max(0, random())) * total;
    for (let index = 0; index < groups.length; index++) if (groups[index].length) {
        if (roll < weights[index]) {
            const group = groups[index], scores = group.map(choice => preferred(choice) ? 2 : 1);
            let pick = Math.min(.999999, Math.max(0, random())) * scores.reduce((sum, value) => sum + value, 0);
            for (let i = 0; i < group.length; i++) { pick -= scores[i]; if (pick < 0) return group[i]; }
        }
        roll -= weights[index];
    }
}
