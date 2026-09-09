import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { IslandPlan, IslandRecord } from '../../domain/island/types';
import { IslandDirectActions } from './IslandDirectActions';
import type { IslandDirectTarget } from './islandDirectTargets';

const island: IslandRecord = { profileId: 'p', schemaVersion: 1, revision: 0, completedSets: 3, items: [], pendingRewards: [], updatedAt: 1,
    growth: { version: 1, progress: { garden: 1, waterside: 0, grove: 0, village: 0 }, focus: 'village', memories: [], discoveries: [] } };
const noop = () => undefined;
const render = (target: IslandDirectTarget, record = island, plan?: IslandPlan, preview = false) => renderToStaticMarkup(<IslandDirectActions target={target} island={record} plan={plan}
    disabled={false} preview={preview} onPreview={noop} onGrow={noop} onPlay={noop} onBrowsePlay={noop} onMove={noop} onInventory={noop} onClose={noop} />);

describe('direct island actions', () => {
    it('distinguishes an immutable reservation from the chosen next place', () => {
        const plan = { status: 'active', growthTarget: 'village' } as IslandPlan;
        expect(render({ kind: 'garden' }, island, plan)).toContain('いまの もんだいは いえの まわりへ。にわは つぎから。');
        expect(render({ kind: 'garden' }, island, plan, true)).toContain('つぎの すがた：');
    });
    it('never offers an unearned next stage for mature or legacy gardens', () => {
        const mature = { ...island, growth: { ...island.growth!, progress: { ...island.growth!.progress, garden: 6 } } };
        expect(render({ kind: 'garden' }, mature)).toContain('大きく 育ったよ');
        expect(render({ kind: 'garden' }, mature)).not.toContain('つぎの すがた');
        expect(render({ kind: 'garden' }, { ...island, growth: undefined })).not.toContain('ここを 育てる</button>');
    });
    it('keeps resident actions bounded instead of duplicating growing inventory', () => {
        const record = { ...island, items: [{ id: 'f', kind: 'flower' as const, rotation: 0, position: { x: 0, z: 1 } }, { id: 'b', kind: 'bench' as const, rotation: 0 }] };
        const html = render({ kind: 'resident', id: 'rabbit' }, record);
        expect(html).toContain('しまの あそび道具を タップしてね');
        expect(html).toContain('えから えらぶ');
        expect(html).not.toContain('おはなで あそぶ');
        expect(html).not.toContain('ベンチで あそぶ');
        const many = { ...record, items: Array.from({ length: 100 }, (_, i) => ({ ...record.items[0], id: `f-${i}` })) };
        expect(render({ kind: 'resident', id: 'rabbit' }, many)).toBe(html);
        expect(render({ kind: 'resident', id: 'rabbit' })).toContain('もちものを おく');
        expect(render({ kind: 'resident', id: 'rabbit' }, { ...record, items: [record.items[1]] })).not.toContain('えから えらぶ');
    });
});
