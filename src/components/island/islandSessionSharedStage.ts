import type { Dispatch, SetStateAction } from 'react';
import type { IslandStageProps as StageProps } from './three/types';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { isValidSharedDisplayPlacement, type SharedDisplayId } from '../../domain/island/sharedMemories';
import type { IslandDisplayPreview } from './IslandSharedMemories';
import type { useIslandSharedMemories } from './useIslandSharedMemories';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type SharedStageBindings = Pick<StageProps, 'shared' | 'sharedRequest' | 'onSharedAction' | 'onSharedDisplaySelect' | 'onSharedFeedback' | 'onGroundPoint'>;
type Inputs = { screen: IslandScreen; island: IslandRecord;
    stageIsland: IslandRecord; busy: boolean; learning: boolean; photoOrigin: IslandScreen; photoDisplayId?: SharedDisplayId;
    sharedSelection?: SharedDisplayId; sharedPreview?: IslandDisplayPreview; sharedRequest: StageProps['sharedRequest'];
    sharedActions: ReturnType<typeof useIslandSharedMemories>; sharedCommand: (command: NonNullable<StageProps['sharedRequest']>['command']) => void;
    setSharedPreview: Setter<IslandDisplayPreview | undefined>; setSharedSelection: Setter<SharedDisplayId | undefined>;
    setSharedFeedback: Setter<string | undefined>; openShared: (ref: undefined, id: SharedDisplayId) => void;
};

export function islandSessionSharedStage({ screen, island, stageIsland, busy, learning, photoOrigin,
    photoDisplayId, sharedSelection, sharedPreview, sharedRequest, sharedActions, sharedCommand,
    setSharedPreview, setSharedSelection, setSharedFeedback, openShared }: Inputs): SharedStageBindings {
    return {
        shared: { island: stageIsland, active: screen === 'shared' || screen === 'camera' && photoOrigin === 'shared',
            selectedDisplayId: screen === 'shared' ? sharedSelection : undefined,
            focusDisplayId: screen === 'shared' && !sharedPreview ? sharedSelection : screen === 'camera' ? photoDisplayId : undefined,
            preview: screen === 'shared' ? sharedPreview : undefined },
        sharedRequest: sharedRequest,
        onSharedAction: sharedActions.capture,
        onSharedDisplaySelect: !learning && !busy && ['home', 'play', 'shared', 'showcase'].includes(screen) ? id => {
            if (screen === 'shared') { sharedCommand({ type: 'stop' }); setSharedPreview(undefined); setSharedSelection(id); }
            else openShared(undefined, id);
            } : undefined,
        onSharedFeedback: setSharedFeedback,
        onGroundPoint: screen === 'shared' && sharedPreview && !busy ? point => setSharedPreview(previous => {
            if (!previous) return previous;
            const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
            return { ...previous, position, valid: isValidSharedDisplayPlacement(island, previous.displayId, previous.target, position) };
            }) : undefined,
    };
}
