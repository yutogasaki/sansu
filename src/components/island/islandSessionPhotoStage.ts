import type { IslandStageProps as StageProps } from './three/types';
import type { IslandScreen } from '../../domain/island/navigation';
import type { IslandResidentId } from '../../domain/island/experience';
import type { useIslandPhotos } from './useIslandPhotos';

export type PhotoStageBindings = Pick<StageProps, 'photographing' | 'residentPortraitId' | 'photoRequestId' | 'onPhoto'>;
type Inputs = { screen: IslandScreen;
    portraitResident?: IslandResidentId; photoResident?: IslandResidentId; photos: ReturnType<typeof useIslandPhotos>;
};

export function islandSessionPhotoStage({ screen, portraitResident, photoResident, photos }: Inputs): PhotoStageBindings {
    return {
        photographing: screen === 'camera',
        residentPortraitId: screen === 'experience' ? portraitResident : screen === 'camera' ? photoResident : undefined,
        photoRequestId: screen === 'camera' ? photos.requestId : undefined,
        onPhoto: photos.consume,
    };
}
