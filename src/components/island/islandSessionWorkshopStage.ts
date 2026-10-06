import type { Dispatch, SetStateAction } from 'react';
import type { IslandStageProps as StageProps } from './three/types';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { getIslandWorkshop } from '../../domain/island/workshop';
import type { IslandWorkshopView } from './IslandWorkshop';
import type { useIslandWorkshop } from './useIslandWorkshop';
import type { useIslandWorkshopAudio } from './useIslandWorkshopAudio';
import type { SharedTarget } from '../../domain/island/sharedMemories';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type WorkshopStageBindings = Pick<StageProps, 'workshop' | 'workshopRequest' | 'onWorkshopAction' | 'onWorkshopGesture' | 'onWorkshopFeedback' | 'onWorkshopSpecimenSelect' | 'onWorkshopPartSelect'>;
type Inputs = { screen: IslandScreen; island: IslandRecord;
    busy: boolean; cameraInlet: boolean; workshopView: IslandWorkshopView; workshopRequest: StageProps['workshopRequest'];
    workReplay?: { target: Extract<SharedTarget, {kind: 'work'}> }; showCurrentDraft: boolean;
    workshopActions: ReturnType<typeof useIslandWorkshop>; workshopAudio: ReturnType<typeof useIslandWorkshopAudio>;
    setWorkshopView: Setter<IslandWorkshopView>;
};

export function islandSessionWorkshopStage({ screen, island, busy, cameraInlet, workshopView, workshopRequest,
    workReplay, showCurrentDraft, workshopActions, workshopAudio, setWorkshopView }: Inputs): WorkshopStageBindings {
    return {
        workshop: screen === 'workshop' || cameraInlet ? { ...workshopView, workshop: getIslandWorkshop(island), active: true, busy,
            replayLayout: workReplay ? showCurrentDraft ? getIslandWorkshop(island).draftCheckpoint.draft.layout : workReplay.target.layout : undefined } : undefined,
        workshopRequest: screen === 'workshop' || cameraInlet ? workshopRequest : undefined,
        onWorkshopAction: workshopActions.capture,
        onWorkshopGesture: () => { void workshopAudio.unlock(); },
        onWorkshopFeedback: workshopAudio.play,
        onWorkshopSpecimenSelect: id => setWorkshopView(view => ({ ...view, selectedSpecimenId: id })),
        onWorkshopPartSelect: id => setWorkshopView(view => ({ ...view, selectedPartId: id })),
    };
}
