import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../../domain/user/profile';
import { learningProgressView } from '../../domain/learning/progressView';
import { FinishPreparation } from './FinishPreparation';

describe('visible, separate finish admission conditions', () => {
    const profile = () => createInitialProfile('はる', 2, 15, 1, 'math');
    const readiness = { coverageReady: false, fresh: false, recentCount: 8, recentCorrect: 6, coveredCount: 1, requiredCount: 3, missingUnitIds: ['missing'] };
    it('shows answer quantity, independent accuracy and coverage without promising an exact admission date', () => {
        const html = renderToStaticMarkup(<FinishPreparation view={learningProgressView(profile(), 'math', undefined, readiness)} />);
        expect(html).toContain('8 / 20もん');
        expect(html).toContain('6 / 8もん');
        expect(html).toContain('1 / 3しゅるい');
        expect(html).not.toContain('あと12問で');
        const compact = renderToStaticMarkup(<FinishPreparation view={learningProgressView(profile(), 'math', undefined, readiness)} compact />);
        expect(compact).toContain('8 / 20');
        expect(compact).toContain('6 / 8');
        expect(compact).toContain('1 / 3');
        expect(compact).not.toContain('さいきん7日間');
    });
    it('keeps full recent progress separate from insufficient coverage', () => {
        const view = learningProgressView(profile(), 'math', undefined, { ...readiness, recentCount: 20, recentCorrect: 19, fresh: true });
        expect(view.stage).toBe('unlock');
        const html = renderToStaticMarkup(<FinishPreparation view={view} />);
        expect(html).toContain('1 / 3しゅるい');
        expect(html).not.toContain('じゅんびが できたよ');
        expect(html).not.toContain('まず あと0問');
    });
    it('shows preparation even while a parent-disabled destination is paused', () => {
        const p = profile(); p.mathMaxUnlocked = 17;
        p.mathLevels = p.mathLevels!.map(level => level.level === 17 ? { ...level, unlocked: true, enabled: false } : level);
        const view = learningProgressView(p, 'math', undefined, readiness);
        expect(view.stage).toBe('paused');
        expect(renderToStaticMarkup(<FinishPreparation view={view} />)).toContain('8 / 20もん');
    });
});
