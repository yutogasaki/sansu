import type { Dispatch, SetStateAction } from 'react';
import type { IslandStageProps as StageProps } from './three/types';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { readWordAloud } from './growing/useGrowingRoom';
import type { useGrowingRoom } from './growing/useGrowingRoom';
import { guestLine } from './growing/houseGuests';
import { noteFor, playNote } from './growing/notes';
import { villagerName } from './growing/growingCopy';
import type { useIslandLearningKeepsakes } from './useIslandLearningKeepsakes';
import type { IslandLearningKeepsakeId } from '../../domain/island/learningKeepsakes';
import type { IslandHabitatId } from '../../domain/island/types';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type HouseStageBindings = Pick<StageProps, 'challengeDisplayed' | 'learningKeepsakes' | 'onHomeEnter' | 'onHomeAction'>;
type Inputs = { screen: IslandScreen; setScreen: (screen: IslandScreen) => void; island: IslandRecord;
    busy: boolean; keepsakeRoomActive: boolean; houseOverview: boolean; challengeSummary?: { displayed: StageProps['challengeDisplayed'] };
    keepsakeFocus?: IslandLearningKeepsakeId; growingRoom: ReturnType<typeof useGrowingRoom>; soundEnabled: boolean;
    keepsakes: ReturnType<typeof useIslandLearningKeepsakes>; enterHouse: () => void; begin: () => Promise<unknown>;
    setReturnToHouse: Setter<boolean>; setAlbumComparison: Setter<IslandHabitatId | 'all'>;
    setKeepsakeFocus: Setter<IslandLearningKeepsakeId | undefined>; setHouseSection: (section: 'home' | 'keepsakes' | 'notices') => void;
    setRoomWord: Setter<{ text: string; japanese?: string; at: number } | undefined>;
};

export function islandSessionHouseStage({ screen, setScreen, island, busy, keepsakeRoomActive, houseOverview,
    challengeSummary, keepsakeFocus, growingRoom, soundEnabled, keepsakes, enterHouse,
    begin, setReturnToHouse, setAlbumComparison, setKeepsakeFocus, setHouseSection, setRoomWord }: Inputs): HouseStageBindings {
    return {
        challengeDisplayed: challengeSummary?.displayed,
        learningKeepsakes: keepsakeRoomActive ? { closeOverview: houseOverview, state: island.learningKeepsakes, selectedId: keepsakeFocus, decor: growingRoom.decor } : undefined,
        onHomeEnter: !busy && ['home', 'play'].includes(screen) ? enterHouse : undefined,
        onHomeAction: !busy && screen === 'keepsakes' ? action => {
            if (action.type === 'album') { setReturnToHouse(true); setAlbumComparison('garden'); setScreen('album'); }
            else if (action.type === 'notices') { setKeepsakeFocus(undefined); setHouseSection('notices'); }
            else if (action.type === 'word') { const word = readWordAloud(action.word); setRoomWord({ text: word?.surface ?? action.word.replace(/_lv\d+$/, ''), japanese: word?.japanese, at: Date.now() }); }
            else if (action.type === 'desk') void begin();
            else if (action.type === 'guest') {
                const guest = growingRoom.guests.find(g => g.id === action.id);
                if (guest) { if (soundEnabled) playNote(noteFor(guest.species)); setRoomWord({ text: villagerName(guest), japanese: guestLine(guest), at: Date.now() }); }
            }
            else if (!keepsakes.pending) { keepsakes.select(action.id); setKeepsakeFocus(action.id); setHouseSection('keepsakes'); }
            } : undefined,
    };
}
