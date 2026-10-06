import { lazy, type Dispatch, type SetStateAction } from 'react';
import type { IslandRecord } from '../../domain/island/types';
import { getIslandExperience, ISLAND_RESIDENT_IDS } from '../../domain/island/experience';
import { isIslandHabitatUnlocked } from '../../domain/island/growth';
import { getIslandWorkshop } from '../../domain/island/workshop';
import { sharedWorkCaptureKey, type SharedDisplayId, type SharedTarget, type SharedTargetRef } from '../../domain/island/sharedMemories';
import type { IslandWorkshopView } from './IslandWorkshop';
import type { WorkshopSceneRequest } from './three/workshopScene';
import type { useIslandWorkshop } from './useIslandWorkshop';
import type { useIslandWorkshopAudio } from './useIslandWorkshopAudio';
import type { useIslandSharedMemories } from './useIslandSharedMemories';

const IslandWorkReplay = lazy(() => import('./IslandWorkReplay').then(module => ({ default: module.IslandWorkReplay })));
const IslandWorkshop = lazy(() => import('./IslandWorkshop').then(module => ({ default: module.IslandWorkshop })));
type WorkReplay = { ref: SharedTargetRef; target: Extract<SharedTarget, { kind: 'work' }> };
type Props = {
    island: IslandRecord; profileId: string; busy: boolean;
    workshopView: IslandWorkshopView; setWorkshopView: Dispatch<SetStateAction<IslandWorkshopView>>;
    setWorkshopRequest: Dispatch<SetStateAction<WorkshopSceneRequest | undefined>>;
    workReplay?: WorkReplay; setWorkReplay: Dispatch<SetStateAction<WorkReplay | undefined>>;
    showCurrentDraft: boolean; setShowCurrentDraft: Dispatch<SetStateAction<boolean>>;
    sharedSelection?: SharedDisplayId; sharedActions: ReturnType<typeof useIslandSharedMemories>;
    workshopActions: ReturnType<typeof useIslandWorkshop>; workshopAudio: ReturnType<typeof useIslandWorkshopAudio>;
    openShared: (ref?: SharedTargetRef, selected?: SharedDisplayId) => void;
    onPhoto: () => void; onClose: () => void; onLearn: () => void;
};

/** Draft editing and immutable saved-work replay keep separate actions and error paths. */
export function IslandSessionWorkshop({ island, profileId, busy, workshopView, setWorkshopView, setWorkshopRequest,
    workReplay, setWorkReplay, showCurrentDraft, setShowCurrentDraft, sharedSelection, sharedActions,
    workshopActions, workshopAudio, openShared, onPhoto, onClose, onLearn }: Props) {
    const experienceState = getIslandExperience(island);
    return workReplay ? <IslandWorkReplay target={workReplay.target} disabled={busy} showingDraft={showCurrentDraft}
        onShowDraft={setShowCurrentDraft} onCommand={command => setWorkshopRequest({ id: crypto.randomUUID(), command })}
        error={sharedActions.error} onRetry={sharedActions.retry ? () => { void sharedActions.retry?.(); } : undefined}
        onStartFrom={async () => { const updated = await sharedActions.act({ type: 'start-from-work', target: workReplay.ref });
            if (!updated) return false;
            setWorkReplay(undefined); setShowCurrentDraft(false); setWorkshopRequest(undefined); return true; }}
        onPhoto={onPhoto} onClose={() => openShared(undefined, sharedSelection)} onLearn={onLearn} />
    : <IslandWorkshop workshop={getIslandWorkshop(island)} view={workshopView} disabled={busy}
        onPhoto={onPhoto}
        onDisplay={id => {
            if (id === 'work-1' || id === 'work-2') { const work = getIslandWorkshop(island).works[id];
                if (work) openShared({ kind: 'work', workId: id, targetKey: sharedWorkCaptureKey(profileId, id, work) }); }
            else openShared({ kind: 'specimen', specimenId: id });
        }}
        onGesture={() => { void workshopAudio.unlock(); }}
        residents={ISLAND_RESIDENT_IDS.filter(id => id !== 'fox' || island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside'))
            .map(id => ({ id, name: experienceState.residents[id].name }))}
        onView={view => { setWorkshopView(view); if (view.mode !== workshopView.mode || view.residentId !== workshopView.residentId) setWorkshopRequest({ id: crypto.randomUUID(), command: { type: 'stop' } }); }}
        onCommand={command => setWorkshopRequest({ id: crypto.randomUUID(), command })}
        onAction={workshopActions.act} error={workshopActions.error} onRetry={workshopActions.retry} onClose={onClose} onLearn={onLearn} />;
}
