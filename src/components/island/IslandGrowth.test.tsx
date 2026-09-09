import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { IslandPlan, IslandRecord } from '../../domain/island/types';
import { IslandDistricts, IslandGrowthChoices, IslandGrowthSummary } from './IslandGrowth';
import { IslandPlacement } from './IslandItems';

const island: IslandRecord = { profileId: 'p', schemaVersion: 1, revision: 0, completedSets: 3, items: [], pendingRewards: [], updatedAt: 1,
    growth: { version: 1, progress: { garden: 3, waterside: 0, grove: 0, village: 0 }, focus: 'waterside', memories: [], discoveries: [] } };
const plan: IslandPlan = { profileId: 'p', id: 'plan', schemaVersion: 1, plannerVersion: 'island-learning-v1', subject: 'math', status: 'active', revision: 0,
    cursor: 0, slots: [], rewardId: '', rewardChoices: [], startedAt: 1, growthTarget: 'garden' };
const noop = () => undefined;

describe('living island choices', () => {
    it('does not offer a growth write before an old reservation has initialized growth', () => {
        const legacy = { ...island, growth: undefined };
        const summary = renderToStaticMarkup(<IslandGrowthSummary island={legacy} plan={{ ...plan, growthTarget: undefined }} disabled={false} onChoose={noop} />);
        expect(summary).toContain('みんなが くらす しま');
        expect(summary).not.toContain('<button');
        expect(summary).not.toContain('data-growth-target');
        expect(summary).not.toContain('育っているよ');
        const choices = renderToStaticMarkup(<IslandGrowthChoices island={legacy} disabled={false} onSelect={noop} onClose={noop} />);
        expect(choices.match(/class="island-growth-place" disabled=""/g)).toHaveLength(4);
    });
    it('shows the frozen current destination while offering the actual next reservation target', () => {
        const summary = renderToStaticMarkup(<IslandGrowthSummary island={island} plan={plan} disabled={false} onChoose={noop} />);
        expect(summary).toContain('data-growth-target="garden"');
        expect(summary).toContain('いま 育てる ばしょ：にわ');
        const choices = renderToStaticMarkup(<IslandGrowthChoices island={island} plan={plan} disabled={false} onSelect={noop} onClose={noop} />);
        expect(choices).toContain('いまの もんだいは にわへ。');
        expect(choices).toContain('えらぶと、つぎから 育つよ');
        expect(choices).toMatch(/aria-pressed="true"[^]*?<strong>みずべ<\/strong>/);
        expect(choices).toContain('しまが ひろがると 育てられるよ');
    });

    it('only offers earned appearances and keeps play independent from appearance', () => {
        const markup = renderToStaticMarkup(<IslandPlacement item={{ id: 'flower', kind: 'flower', rotation: 0, habitatId: 'garden', growthLevel: 2, appearanceLevel: 0 }}
            valid disabled={false} onPoint={noop} onRotate={noop} onSave={noop} onStore={noop} onCancel={noop} onAppearance={noop} />);
        expect(markup).toContain('はじめの すがた');
        expect(markup).toContain('2ばんめの すがた');
        expect(markup).not.toContain('3ばんめの すがた');
        expect(markup).toContain('すがたを かえても、あそびは そのまま');
    });

    it('preserves old land views and stops promising growth after the chapter', () => {
        const before = renderToStaticMarkup(<IslandDistricts island={{ completedSets: 11 }} value="all" disabled={false} onChange={noop} />);
        const after = renderToStaticMarkup(<IslandDistricts island={{ completedSets: 12 }} value="west" disabled={false} onChange={noop} />);
        expect(before).not.toContain('にし');
        expect(after).toContain('にし');
        const mature = { ...island, growth: { ...island.growth!, progress: { garden: 6, waterside: 6, grove: 6, village: 6 } } };
        const summary = renderToStaticMarkup(<IslandGrowthSummary island={mature} disabled={false} onChoose={noop} />);
        expect(summary).toContain('みんなの いばしょが 育ったよ');
        expect(summary).not.toContain('<button');
    });

    it('does not expose new districts merely because many sections were completed', () => {
        const current: IslandRecord = { ...island, completedSets: 12, growth: { ...island.growth!, expansionLevel: 0 } };
        const before = renderToStaticMarkup(<IslandDistricts island={current} value="all" disabled={false} onChange={noop} />);
        expect(before).not.toContain('ひがし');
        expect(before).not.toContain('にし');
        current.growth!.expansionLevel = 1;
        const expanded = renderToStaticMarkup(<IslandDistricts island={current} value="all" disabled={false} onChange={noop} />);
        expect(expanded).toContain('ひがし');
        expect(expanded).not.toContain('にし');
    });

    it('shows the next island expansion only near the frozen place’s completion', () => {
        const current: IslandRecord = { ...island, completedSets: 7, growth: { ...island.growth!, expansionLevel: 0,
            focus: 'village', progress: { garden: 5, village: 2, waterside: 0, grove: 0 } } };
        const summary = renderToStaticMarkup(<IslandGrowthSummary island={current} plan={plan} disabled={false} onChoose={noop} />);
        expect(summary).toContain('data-island-expansion-preview="east"');
        expect(summary).not.toContain('つぎは');
        const choices = renderToStaticMarkup(<IslandGrowthChoices island={current} plan={plan} disabled={false} onSelect={noop} onClose={noop} />);
        const house = choices.match(/<strong>いえの まわり<\/strong>([\s\S]*?)<\/span>/)?.[1];
        expect(house).toBeDefined();
        expect(house).not.toContain('ひがしへ');
        const legacy = renderToStaticMarkup(<IslandGrowthSummary island={current} plan={{ ...plan, growthTarget: undefined }} disabled={false} onChoose={noop} />);
        expect(legacy).not.toContain('data-island-expansion-preview');
    });
});
