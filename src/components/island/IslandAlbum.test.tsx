import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandStageProps } from './three/types';

const stages = vi.hoisted(() => [] as IslandStageProps[]);
vi.mock('./IslandStage', () => ({ default: (props: IslandStageProps) => { stages.push(props); return <figure data-read-only={props.readOnly} />; } }));
import { IslandAlbum } from './IslandAlbum';

describe('immutable growth album', () => {
    beforeEach(() => { stages.length = 0; });
    it('renders past item placement and all habitat scenery progress independently from the current island', () => {
        const initialProgress = { garden: 0, waterside: 0, grove: 0, village: 0 };
        const island: IslandRecord = { profileId: 'p', schemaVersion: 1, revision: 5, completedSets: 18, pendingRewards: [], updatedAt: 2,
            items: [{ id: 'flower', kind: 'flower', rotation: 1, position: { x: 3, z: 2 }, habitatId: 'garden', growthLevel: 3 }],
            growth: { version: 1, progress: { garden: 6, waterside: 6, grove: 6, village: 0 }, focus: 'village', discoveries: [],
                memories: [{ id: 'initial', kind: 'initial', capturedAt: 1, completedSets: 0, progress: initialProgress, focus: 'garden',
                    items: [{ id: 'flower', kind: 'flower', rotation: 0, position: { x: 1, z: 1 }, habitatId: 'garden', growthLevel: 0 }] }] } };
        const before = JSON.stringify(island);
        renderToStaticMarkup(<IslandAlbum island={island} disabled={false} onTry={() => undefined} onPlace={() => undefined} onClose={() => undefined} />);
        expect(stages).toHaveLength(2);
        expect(stages[0]).toMatchObject({ completedSets: 0, items: [{ position: { x: 1, z: 1 }, rotation: 0, growthLevel: 0 }], growth: { progress: initialProgress } });
        expect(stages[1]).toMatchObject({ completedSets: 18, items: [{ position: { x: 3, z: 2 }, rotation: 1, growthLevel: 3 }], growth: { progress: island.growth!.progress } });
        for (const stage of stages) {
            expect(stage.readOnly).toBe(true);
            expect(stage.comparisonHabitat).toBe('garden');
            expect(stage.onItemSelect).toBeUndefined();
            expect(stage.onDiscovery).toBeUndefined();
            expect(stage.onGroundPoint).toBeUndefined();
        }
        expect(JSON.stringify(island)).toBe(before);
    });

    it('offers explicit habitat and whole-island comparisons without changing a snapshot', () => {
        const island: IslandRecord = { profileId: 'p', schemaVersion: 1, revision: 1, completedSets: 0, pendingRewards: [], items: [], updatedAt: 1,
            growth: { version: 1, progress: { garden: 0, waterside: 0, grove: 0, village: 0 }, focus: 'garden', discoveries: [],
                memories: [{ id: 'initial', kind: 'initial', capturedAt: 1, completedSets: 0, items: [], focus: 'garden', progress: { garden: 0, waterside: 0, grove: 0, village: 0 } }] } };
        const markup = renderToStaticMarkup(<IslandAlbum island={island} disabled={false} onTry={() => undefined} onPlace={() => undefined} onClose={() => undefined} />);
        expect(markup).toContain('aria-label="みくらべる ばしょ"');
        expect(markup).toContain('data-comparison-habitat="garden"');
        expect(markup).toContain('あのころの にわ'); expect(markup).toContain('いまの にわ');
        expect(markup).toContain('しまぜんぶ');
        expect(markup).toContain('disabled="">みずべ'); expect(markup).toContain('disabled="">木かげ');
        expect(stages.every(stage => stage.comparisonHabitat === 'garden')).toBe(true);
    });
});
