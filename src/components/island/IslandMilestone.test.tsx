import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { IslandMilestoneNotice, IslandMilestoneReturn, islandMilestoneLines } from './IslandMilestone';

describe('major island change announcements', () => {
    const milestone = { id: 'completed-plan', habitats: ['garden' as const], expansion: 'west' as const };
    it('names both changes once without adding a learning confirmation control', () => {
        const island = createIsland('p', 0);
        const notice = renderToStaticMarkup(<IslandMilestoneNotice milestone={milestone} island={island} />);
        expect(notice).toContain('role="status"');
        expect(notice).toContain('しまが 大きく ひろがったよ');
        expect(notice).toContain('おはなが いっぱいに なった');
        expect(notice).toContain('にしへ はしが つながったよ');
        expect(notice).not.toContain('<button');
    });
    it('does not claim the current picture changed when an older appearance or storage hides the upgrade', () => {
        const island = createIsland('p', 0);
        island.items[0].appearanceLevel = 0;
        expect(islandMilestoneLines(milestone, island)[0]).toBe('おはなの 新しいすがたが 育ったよ');
        delete island.items[0].appearanceLevel;
        delete island.items[0].position;
        island.items.push({ id: 'bench', kind: 'bench', habitatId: 'garden', growthLevel: 3, rotation: 0, position: { x: 0, z: 1 } });
        expect(islandMilestoneLines(milestone, island)[0]).toBe('おはなの 新しいすがたが 育ったよ');
    });
    it('keeps fixed scenery visible when its associated lantern is stored', () => {
        const island = createIsland('p', 0);
        delete island.items[1].position;
        expect(islandMilestoneLines({ id: 'village', habitats: ['village'] }, island)).toEqual(['おうちに テラスが できた']);
    });
    it('keeps a later habitat completion distinct from a new island expansion', () => {
        const notice = renderToStaticMarkup(<IslandMilestoneNotice milestone={{ id: 'grove', habitats: ['grove'] }} island={createIsland('p', 0)} />);
        expect(notice).toContain('大きな 木かげが できた');
        expect(notice).not.toContain('しまが 大きく ひろがったよ');
    });
    it('keeps the return comparison optional and respects an in-flight save', () => {
        const html = renderToStaticMarkup(<IslandMilestoneReturn milestone={milestone} island={createIsland('p', 0)} disabled onCompare={() => undefined} />);
        expect(html).toContain('disabled=""');
        expect(html).toContain('あのころと みくらべる');
    });
});
