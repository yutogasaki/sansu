import { lazy } from 'react';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { getIslandExperience, ISLAND_RESIDENT_IDS } from '../../domain/island/experience';
import { isIslandHabitatUnlocked } from '../../domain/island/growth';
import { getIslandExpression } from '../../domain/island/expression';
import { SHARED_DISPLAY_IDS, sharedTargetName, type SharedTarget, type SharedTargetRef } from '../../domain/island/sharedMemories';
import { getIslandWorkshop, getWorkshopSpecimenName, workshopSpecimenIdentity } from '../../domain/island/workshop';
import type { IslandWorkshopView } from './IslandWorkshop';
import type { useIslandPhotos } from './useIslandPhotos';

const IslandPhotoCamera = lazy(() => import('./IslandPhotos').then(module => ({ default: module.IslandPhotoCamera })));
const IslandPhotoGallery = lazy(() => import('./IslandPhotos').then(module => ({ default: module.IslandPhotoGallery })));

type Props = {
    screen: 'camera' | 'photos'; island: IslandRecord; profileId: string;
    photos: ReturnType<typeof useIslandPhotos>; photoOrigin: IslandScreen; photoTargetId: string;
    workshopView: IslandWorkshopView;
    workReplay?: { ref: SharedTargetRef; target: Extract<SharedTarget, { kind: 'work' }> };
    showCurrentDraft: boolean; keepsakeRoomActive: boolean; disabled: boolean;
    onTarget: (id: string) => void; onGallery: () => void; onCamera: () => void;
    onCameraClose: () => void; onGalleryClose: () => void; onLearn: () => void;
};

/** Photo labels and capture identities use the same selected scene, including immutable work replays. */
export function IslandSessionPhotos({ screen, island, profileId, photos, photoOrigin, photoTargetId,
    workshopView, workReplay, showCurrentDraft, keepsakeRoomActive, disabled,
    onTarget, onGallery, onCamera, onCameraClose, onGalleryClose, onLearn }: Props) {
    const experienceState = getIslandExperience(island);
    const photoResidents = ISLAND_RESIDENT_IDS.filter(id => id !== 'fox' || island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside'));
    const photoResident = photoResidents.find(id => photoTargetId === `resident-${id}`);
    const cameraInlet = screen === 'camera' && photoTargetId === 'inlet';
    const photoDisplayId = SHARED_DISPLAY_IDS.find(id => photoTargetId === `display-${id}` && island.sharedMemories?.displays[id]);
    const photoDisplay = photoDisplayId ? island.sharedMemories?.displays[photoDisplayId] : undefined;
    const photoTargets = [{ id: 'island', label: 'しまぜんぶ' }, ...photoResidents.map(id => ({ id: `resident-${id}`, label: experienceState.residents[id].name })),
        ...(['play', 'showcase'].includes(photoOrigin) ? [{ id: 'current', label: 'いまの けしき' }] : []),
        ...SHARED_DISPLAY_IDS.flatMap(id => island.sharedMemories?.displays[id] ? [{ id: `display-${id}`, label: sharedTargetName(island, island.sharedMemories.displays[id]!.target) }] : []),
        ...(photoOrigin === 'workshop' ? [{ id: 'inlet', label: workshopView.mode === 'build' ? 'つくった しくみ' : 'みつけた もの' }] : []),
        ...(photoOrigin === 'keepsakes' ? [{ id: 'keepsakes', label: 'いえ' }] : [])];
    return screen === 'camera' ? <IslandPhotoCamera photos={photos} targets={photoTargets} targetId={photoTargetId} disabled={disabled}
        onTarget={onTarget} onCapture={() => photos.capture({ islandName: experienceState.islandName,
            composition: cameraInlet ? workshopView.mode === 'build' ? 'work' : 'specimen' : photoDisplay ? 'display' : photoResident ? 'resident' : 'island',
            targetName: cameraInlet ? workshopView.mode === 'build' ? workReplay && !showCurrentDraft ? workReplay.target.name : 'つくっている しくみ' : getWorkshopSpecimenName(getIslandWorkshop(island), workshopView.selectedSpecimenId)
                : keepsakeRoomActive ? 'いえ' : photoDisplay ? sharedTargetName(island, photoDisplay.target) : photoResident ? experienceState.residents[photoResident].name : undefined,
            targetKey: cameraInlet ? workshopView.mode === 'observe' ? workshopSpecimenIdentity(profileId, workshopView.selectedSpecimenId)
                : workReplay && !showCurrentDraft ? workReplay.target.targetKey : undefined : photoDisplay?.target.targetKey ?? photoResident })}
        onGallery={onGallery} onClose={onCameraClose} onLearn={onLearn} />
        : <IslandPhotoGallery photos={photos} decoration={getIslandExpression(island).selection.album} disabled={disabled}
            onCamera={onCamera} onClose={onGalleryClose} onLearn={onLearn} />;
}
