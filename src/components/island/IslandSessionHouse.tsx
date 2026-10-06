import { ChallengeHomeCard } from '../challenge/ChallengeHomeCard';
import { IslandLearningKeepsakes, type IslandLearningKeepsakesProps } from './IslandLearningKeepsakes';
import { LettersPanel } from './growing/LettersPanel';
import { RoomDecorPanel } from './growing/RoomDecorPanel';
import { islandLetters } from './growing/letters';
import type { useGrowingRoom } from './growing/useGrowingRoom';

interface Props extends Omit<IslandLearningKeepsakesProps, 'challenge' | 'decor' | 'walkingAvailable'> {
    profileId: string;
    room: ReturnType<typeof useGrowingRoom>;
    onChallengeResult: () => void;
    onChallengeStart: () => void;
}

/** House composition; routing and persistence stay with their existing owners. */
export function IslandSessionHouse({ profileId, room, onChallengeResult, onChallengeStart, ...props }: Props) {
    return <IslandLearningKeepsakes {...props} walkingAvailable
        challenge={<ChallengeHomeCard key={profileId} profileId={profileId} disabled={props.disabled}
            onLearn={props.onLearn} onResult={onChallengeResult} onStart={onChallengeStart} />}
        decor={<>
            <LettersPanel profileId={profileId} letters={room.island ? islandLetters(room.island) : []} />
            <RoomDecorPanel room={room.room} words={room.words} mathLevel={room.mathLevel} vocabLevel={room.vocabLevel}
                error={room.error} onDecorate={command => void room.decorate(command)} />
        </>} />;
}
