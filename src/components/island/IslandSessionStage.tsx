import { lazy, Suspense, type ComponentProps } from 'react';
import type { IslandStage as Stage } from './IslandStage';
import type { IslandScreen } from '../../domain/island/navigation';
import { Spinner } from '../ui/Spinner';
import type { HouseStageBindings } from './islandSessionHouseStage';
import type { PlacementStageBindings } from './islandSessionPlacementStage';
import type { SharedStageBindings } from './islandSessionSharedStage';
import type { PhotoStageBindings } from './islandSessionPhotoStage';
import type { WorkshopStageBindings } from './islandSessionWorkshopStage';
import type { PlayStageBindings } from './islandSessionPlayStage';

const IslandStage = lazy(() => import('./IslandStage'));
type Bindings = HouseStageBindings & PlacementStageBindings & SharedStageBindings & PhotoStageBindings & WorkshopStageBindings & PlayStageBindings;
type Props = {
    screen: IslandScreen;
    common: Omit<ComponentProps<typeof Stage>, keyof Bindings>;
    house: HouseStageBindings;
    placement: PlacementStageBindings;
    shared: SharedStageBindings;
    photo: PhotoStageBindings;
    workshop: WorkshopStageBindings;
    play: PlayStageBindings;
};

/** One renderer and Suspense boundary for the live session. Shared editing has ground-input priority. */
export function IslandSessionStage({ screen, common, house, placement, shared, photo, workshop, play }: Props) {
    return <Suspense fallback={<Spinner fullScreen destination={screen === 'keepsakes' ? 'house' : 'island'}
        message={screen === 'keepsakes' ? 'いえを ひらいているよ…' : 'しまを ひらいているよ…'} />}>
        <IslandStage {...common} {...house} {...placement} {...shared} {...photo} {...workshop} {...play}
            onGroundPoint={shared.onGroundPoint ?? placement.onGroundPoint} />
    </Suspense>;
}
