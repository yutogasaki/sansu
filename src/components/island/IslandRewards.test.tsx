import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { IslandRewards } from './IslandItems';

describe('gift screen without pending gifts', () => {
    it('keeps an exit and learning action without offering nonexistent choices', () => {
        const onChoose = vi.fn();
        const html = renderToStaticMarkup(<IslandRewards island={createIsland('child', 1)} intro disabled={false}
            onChoose={onChoose} onContinue={vi.fn()} onClose={vi.fn()} />);
        expect(html).toContain('いまは うけとる おくりものは ないよ');
        expect(html).toContain('おくりものを とじる'); expect(html).toContain('まなぶ');
        expect(html).not.toContain('どれを むかえる'); expect(html).not.toContain('はじめての おくりもの');
        expect(html).not.toContain('island-reward-choices'); expect(html).not.toContain('あとで えらんでも');
        expect(onChoose).not.toHaveBeenCalled();
    });
    it('still renders only the genuine pending choices', () => {
        const island = createIsland('child', 1);
        island.pendingRewards = [{ id: 'gift', planId: 'old-plan', earnedAt: 1, choices: ['flower', 'lantern', 'bench'] }];
        const html = renderToStaticMarkup(<IslandRewards island={island} disabled={false}
            onChoose={vi.fn()} onContinue={vi.fn()} onClose={vi.fn()} />);
        expect(html).toContain('island-reward-choices'); expect(html).toContain('あとで えらんでも');
        expect(html).not.toContain('うけとる おくりものは ないよ');
    });
});
