import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandExperience } from '../../domain/island/experience';
import { getIslandExpression } from '../../domain/island/expression';
import { captureIslandSceneStyle } from '../../domain/island/sceneStyle';
import type { IslandStageProps } from './three/types';
import { islandAlbumMemoryStyle } from './islandAlbumPresentation';

const stages = vi.hoisted(() => [] as IslandStageProps[]);
// Boundary observation only: the production Album chooses the actual Stage
// inputs. This does not claim that a mocked Stage proves rendered appearance.
vi.mock('./IslandStage', () => ({ default: (props: IslandStageProps) => { stages.push(props); return <figure />; } }));
import { IslandAlbum } from './IslandAlbum';

function currentIsland() {
    const island = createIsland('album-expression', 1);
    island.experience = getIslandExperience(island); island.experience.islandName = 'いまの しま';
    island.experience.residents.otter = { name: 'いまの よびな', look: 'cap' }; island.experience.emblem = 'wave'; island.experience.ambience = 'brook';
    island.expression = getIslandExpression(island); island.expression.ownedItemIds = ['star-beret', 'river-check'];
    island.expression.selection.residents.otter.outfit = 'star-beret'; island.expression.selection.residents.otter.pattern = 'river-check';
    island.expression.selection.environment = { period: 'day', season: 'summer' };
    return island;
}
const noop = () => undefined;
function render(island: ReturnType<typeof currentIsland>) {
    stages.length = 0;
    return renderToStaticMarkup(<IslandAlbum island={island} disabled={false} onTry={noop} onPlace={noop} onClose={noop} />);
}

describe('captured expression in the growth album', () => {
    beforeEach(() => { stages.length = 0; });

    it('keeps old history free of current names, clothes and environment while the current pane uses current settings', () => {
        const island = currentIsland(), memory = island.growth!.memories[0]; delete memory.sceneStyle;
        island.completedSets = 18; island.growth!.progress = { garden: 6, waterside: 6, grove: 6, village: 0 };
        const before = structuredClone(island);
        render(island);
        expect(stages).toHaveLength(2);
        expect(stages[0].experience).toBeUndefined(); expect(stages[0].expressionSelection).toBeUndefined();
        expect(stages[0].completedSets).toBe(memory.completedSets); expect(stages[0].growth!.progress).toEqual(memory.progress);
        expect(stages[1].experience).toBe(island.experience); expect(stages[1].expressionSelection).toEqual(island.expression!.selection);
        expect(stages[1].completedSets).toBe(18); expect(stages[1].growth!.progress).toEqual(island.growth!.progress);
        expect(island).toEqual(before);
    });

    it('passes saved v2 free looks, collected clothes, flag and season to the past Stage without borrowing current names', () => {
        const past = currentIsland();
        past.experience!.residents.otter.look = 'scarf'; past.experience!.residents.rabbit.look = 'cap'; past.experience!.emblem = 'star';
        past.expression!.ownedItemIds = ['raincoat', 'butterfly-stitch', 'leaf-trail', 'shell-three-notes', 'leaf-bird-flag-trim'];
        past.expression!.selection.residents.otter = { outfit: 'raincoat', pattern: 'butterfly-stitch', trail: 'leaf-trail' };
        past.expression!.selection.environment = { period: 'evening', season: 'winter' };
        past.expression!.selection.flagTrim = 'leaf-bird-flag-trim'; past.expression!.selection.soundscape = 'shell-three-notes';
        const captured = captureIslandSceneStyle(past), island = currentIsland(), memory = island.growth!.memories[0];
        memory.sceneStyle = captured;
        const before = structuredClone(island); render(island);
        expect(stages[0].expressionSelection).toEqual(captured.expression); expect(stages[0].expressionSelection).not.toBe(captured.expression);
        expect(stages[0].experience).toMatchObject({ islandName: 'わたしの しま', emblem: 'star', ambience: 'off',
            residents: { otter: { name: 'カワウソ', look: 'scarf' }, rabbit: { look: 'cap' }, fox: { look: 'original' } } });
        expect(stages[0].expressionSelection!.residents.otter.outfit).toBe('raincoat');
        expect(stages[1].expressionSelection!.residents.otter.outfit).toBe('star-beret');
        for (const stage of stages) {
            expect(stage.readOnly).toBe(true); expect(stage.learning).toBe(false);
            expect(stage.onDiscovery).toBeUndefined(); expect(stage.onWorkshopAction).toBeUndefined(); expect(stage.onSharedAction).toBeUndefined();
        }
        expect(island).toEqual(before);
    });

    it('keeps captured selection detached during presentation and later current-island edits', () => {
        const island = currentIsland(), memory = island.growth!.memories[0]; memory.sceneStyle = captureIslandSceneStyle(island);
        const saved = structuredClone(memory), presentation = islandAlbumMemoryStyle(memory);
        presentation.expressionSelection!.environment.season = 'autumn'; presentation.experience!.residents.otter.look = 'original';
        expect(memory).toEqual(saved);
        island.expression!.selection.environment = { period: 'morning', season: 'spring' }; island.experience!.emblem = 'flower';
        render(island);
        expect(stages[0].expressionSelection!.environment).toEqual({ period: 'day', season: 'summer' });
        expect(stages[0].experience!.emblem).toBe('wave');
        expect(stages[1].expressionSelection!.environment).toEqual({ period: 'morning', season: 'spring' });
        expect(memory).toEqual(saved);
    });

    it('reads an island without expression extensions without adding saved defaults', () => {
        const island = createIsland('old-album', 1); delete island.growth!.memories[0].sceneStyle;
        const before = structuredClone(island); render(island);
        expect(stages[0].experience).toBeUndefined(); expect(stages[0].expressionSelection).toBeUndefined();
        expect(stages[1].experience).toBeUndefined();
        expect(stages[1].expressionSelection!.environment).toEqual({ period: null, season: null });
        expect(island).toEqual(before); expect(island.expression).toBeUndefined(); expect(island.experience).toBeUndefined();
    });
});
