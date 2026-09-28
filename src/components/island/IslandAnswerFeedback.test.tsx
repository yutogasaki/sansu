import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IslandAnswerFeedback } from './IslandAnswerFeedback';
import type { PokomokoBurst } from './usePokomokoFeedback';
const party = { version: 1 as const, streak: 5, light: 20, rideRemaining: 3 };
const burst: PokomokoBurst = { id: 'saved-5', kind: 'ride', variant: 2, startedAt: 0, light: 1, riding: true };
describe('earned celebrations settle back to the question', () => {
    it('announces ordinary correct answers without reviving the combo counters', () => {
        const html = renderToStaticMarkup(<IslandAnswerFeedback party={party} burst={{ ...burst, kind: 'answer' }} feedback={{ id: burst.id, kind: 'correct', text: 'せいかい' }} />);
        expect(html).toContain('class="pokomoko-answer-receipt" role="status"');
        expect(html).not.toContain('class="pokomoko-combo-number"');
    });
    it('does not replay a saved combo or decorative counters on resume', () => {
        const html = renderToStaticMarkup(<IslandAnswerFeedback party={party} level={3} />);
        for (const name of ['pokomoko-combo-number', 'pokomoko-charge', 'pokomoko-ride-lights', 'pokomoko-stage-flags', 'pokomoko-stage-stars']) expect(html).not.toContain(`class="${name}"`);
        expect(html).toContain('data-streak="5"');
        expect(html).toContain('スタンプ 2こ');
    });
    it('shows the earned peak, then removes its headline without changing ownership', () => {
        expect(renderToStaticMarkup(<IslandAnswerFeedback party={party} burst={burst} />)).toContain('class="pokomoko-combo-number"');
        expect(renderToStaticMarkup(<IslandAnswerFeedback party={party} />)).not.toContain('class="pokomoko-combo-number"');
    });
    it('keeps retry and support feedback readable despite an earned ride', () => {
        for (const kind of ['retry', 'step', 'supported'] as const) {
            const html = renderToStaticMarkup(<IslandAnswerFeedback party={party} feedback={{ id: kind, kind, text: 'このだんを みよう' }} />);
            expect(html).toContain('このだんを みよう');
            expect(html).not.toContain('class="pokomoko-combo-number"');
        }
    });
    it('prioritizes the input handoff over the previous celebration', () => {
        const html = renderToStaticMarkup(<IslandAnswerFeedback party={party} burst={burst} inputCue={{ id: 1, digit: '2', startedAt: 0, fromX: 0, fromY: 0, x: 0, y: 0, destinationX: 0, destinationY: 0 }} />);
        expect(html).toContain('これだ！');
        expect(html).not.toContain('class="pokomoko-combo-number"');
    });
});
