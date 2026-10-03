import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { finishStudyPath, finishRecoveryStudyPath } from './finishNavigation';
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
        expect(html).toContain('Lv17へ レベルアップ！');
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
    it('offers targeted recovery without an immediate retry or unearned destination', () => {
        const html = renderToStaticMarkup(<FinishChallengeResultView continuation="fresh" result={{ passed: false, subject: 'math', level: 16, correctCount: 19, totalQuestions: 20, recoveryItemIds: ['div_2d1d'] }} onNavigate={() => {}} />);
        expect(html).toContain('できたところを ふやそう');
        expect(html).toContain('ここを れんしゅうする');
        expect(html).not.toContain('もういちど レベルアップに ちょうせん');
        const recovery = new URL(finishRecoveryStudyPath('math', ['div_2d1d', 'div_2d1d', 'div_1d1d']), 'https://example.test');
        expect(recovery.searchParams.get('session')).toBe('review');
        expect(recovery.searchParams.get('focus_ids')).toBe('div_2d1d,div_1d1d');
        expect(recovery.searchParams.get('force_review')).toBe('1');
        expect(recovery.searchParams.get('back_to')).toBe('/learn');
        expect(html).not.toContain('ひらいたよ');
        expect(html).not.toContain('つぎを はじめる');
    });
});
