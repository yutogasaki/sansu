import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { finishStudyPath } from './finishNavigation';
import { FinishChallengeEntry, FinishChallengeResultView } from './FinishChallenge';

describe('finish challenge meaning and payoff', () => {
    it('explains the next destination and independent clear condition before starting', () => {
        const html = renderToStaticMarkup(<FinishChallengeEntry subject="math" level={16} nextLevel={17} onStart={() => {}} />);
        expect(html).toContain('わりざん');
        expect(html).toContain('あまりのある わりざん');
        expect(html).toContain('ひとりで ぜんもんできたら クリア');
        expect(finishStudyPath('math')).toContain('session=finish-test');
        expect(finishStudyPath('vocab')).toContain('focus_subject=vocab');
    });
    it('shows saved progression separately from the answer count', () => {
        const html = renderToStaticMarkup(<FinishChallengeResultView continuation="fresh" result={{ passed: true, subject: 'math', level: 16, newLevel: 17, correctCount: 20, totalQuestions: 20 }} onNavigate={() => {}} />);
        expect(html).toContain('data-finish-state="cleared"');
        expect(html).toContain('ひらいたよ');
        expect(html).toContain('つぎを はじめる');
        expect(html).toContain('あまりのある わりざん');
    });
    it.each(['pending', 'checking', 'unknown'] as const)('keeps the next action honest when continuation is %s', continuation => {
        const html = renderToStaticMarkup(<FinishChallengeResultView continuation={continuation} result={{ passed: true, subject: 'math', level: 16, newLevel: 17, correctCount: 20, totalQuestions: 20 }} onNavigate={() => {}} />);
        expect(html).toContain('つづけて まなぶ');
        expect(html).not.toContain('つぎを はじめる');
        if (continuation === 'pending') expect(html).toContain('あたらしい はんいは つぎの くぎりから。');
        expect(html).toContain('あまりのある わりざん');
    });
    it('offers practice and voluntary retry without claiming a new destination on low result', () => {
        const html = renderToStaticMarkup(<FinishChallengeResultView continuation="fresh" result={{ passed: false, subject: 'math', level: 16, correctCount: 19, totalQuestions: 20 }} onNavigate={() => {}} />);
        expect(html).toContain('できたところを ふやそう');
        expect(html).toContain('れんしゅうする');
        expect(html).toContain('もういちど しあげに ちょうせん');
        expect(html).not.toContain('ひらいたよ');
        expect(html).not.toContain('つぎを はじめる');
    });
});
