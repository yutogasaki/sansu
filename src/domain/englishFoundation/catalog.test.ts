import { describe, expect, it } from 'vitest';
import { makeFoundationSlots } from './catalog';
describe('foundation curriculum variety', () => {
    it('covers every target and varies correct positions across reservations', () => {
        for (const unit of ['F01', 'F02'] as const) {
            const positions = [0, 1, 2].map(sequence => makeFoundationSlots(unit, sequence).map(slot => slot.choices.indexOf(slot.target)));
            for (let index = 0; index < 3; index++) expect(new Set(positions.map(plan => plan[index])).size).toBe(3);
            for (let sequence = 0; sequence < 3; sequence++) {
                const slots = makeFoundationSlots(unit, sequence);
                expect(new Set(slots.map(slot => slot.target)).size).toBe(3);
                expect(slots.every(slot => new Set(slot.choices).size === 3)).toBe(true);
            }
        }
    });
});
