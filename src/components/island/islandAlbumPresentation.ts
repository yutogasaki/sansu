import { getIslandExperience } from '../../domain/island/experience';
import { cloneIslandSceneStyle } from '../../domain/island/sceneStyle';
import type { IslandGrowthMemory } from '../../domain/island/types';
import type { IslandStageProps } from './three/types';

/** Historical presentation has no current-island argument. Only v2 memories
 * captured these choices; an older scene must not inherit today's identity.
 * Names were not captured, so the renderer uses neutral default labels. */
export function islandAlbumMemoryStyle(memory: Pick<IslandGrowthMemory, 'sceneStyle'>): Pick<IslandStageProps, 'experience' | 'expressionSelection'> {
    if (!memory.sceneStyle) return {};
    const style = cloneIslandSceneStyle(memory.sceneStyle);
    if (style.version !== 2) return {};
    const experience = getIslandExperience({});
    experience.emblem = style.emblem;
    experience.residents.otter.look = style.residentLooks.otter;
    experience.residents.rabbit.look = style.residentLooks.rabbit;
    experience.residents.fox.look = style.residentLooks.fox;
    // Album comparison is silent. Selection keeps the captured sound choice as
    // data, while no audio engine or gesture unlock is mounted by this view.
    experience.ambience = 'off';
    return { experience, expressionSelection: style.expression };
}
