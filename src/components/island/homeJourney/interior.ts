import * as T from 'three';
import { IslandLearningKeepsakeScenery } from '../three/learningKeepsakeScenery';
import { fitIslandHomeInteriorCamera } from '../three/homeInteriorCamera';
import type { IslandLearningKeepsakeId, IslandLearningKeepsakesState } from '../../../domain/island/learningKeepsakes';

export interface HomeJourneyRoomState {
    state?: IslandLearningKeepsakesState;
    completedSets: number;
    selectedId?: IslandLearningKeepsakeId;
}

/** The room stays inside the unchanged basic house at every growth stage. */
export function createHomeJourneyInterior(house: T.Object3D) {
    const room = new IslandLearningKeepsakeScenery();
    room.group.scale.setScalar(.22);
    room.group.position.set(0, .10, -.984);
    house.add(room.group);
    const camera = new T.PerspectiveCamera();
    return {
        room, camera,
        update(value: HomeJourneyRoomState | undefined, aspect: number) {
            room.update(value?.state, value?.completedSets, Boolean(value), value?.selectedId);
            return !value || fitIslandHomeInteriorCamera(camera, room, aspect);
        },
        dispose() { room.dispose(); room.group.removeFromParent(); },
    };
}
