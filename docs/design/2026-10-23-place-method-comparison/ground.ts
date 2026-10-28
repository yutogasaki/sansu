import { buildTrialGround } from '../2026-10-22-place-strategy-trial/ground';
import type { SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { terrainMethod } from './section-profile';
import { candidateId } from './candidate';

export function buildComparisonGround(layout: SceneLayout, state: GrowingState) {
    const ground = buildTrialGround(layout, state);
    const mode = terrainMethod();
    ground.root.userData.methodComparison = { mode, revision: layout.world.revision };
    queueMicrotask(() => {
        const host = document.querySelector<HTMLElement>('[data-growing-world]');
        if (host) host.dataset.methodCandidate = candidateId(mode);
    });
    return ground;
}
