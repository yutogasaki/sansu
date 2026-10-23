import { ENGLISH_WORDS } from '../../domain/english/words';
import { villagerName } from './growing/growingCopy';
import type { IslandStageProps } from './three/types';
import './IslandRoomDecor.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IslandToyIcon } from './IslandToyIcon';
import { ChallengeHomeCard } from '../challenge/ChallengeHomeCard';
import { IslandLearningKeepsakes, type IslandLearningKeepsakesProps } from './IslandLearningKeepsakes';
import { LettersPanel } from './growing/LettersPanel';
import { RoomDecorPanel } from './growing/RoomDecorPanel';
import { islandLetters } from './growing/letters';
import type { useGrowingRoom } from './growing/useGrowingRoom';

interface Props extends Omit<IslandLearningKeepsakesProps, 'challenge' | 'decor' | 'walkingAvailable' | 'roomSurface'> {
    onRoomAction?: IslandStageProps['onHomeAction'];
    profileId: string;
    room: ReturnType<typeof useGrowingRoom>;
    onChallengeResult: () => void;
    onChallengeStart: () => void;
    onDecorSurfaceChange?: (open: boolean) => void;
}

/** House composition; routing and persistence stay with their existing owners. */
export function IslandSessionHouse({ profileId, room, onChallengeResult, onChallengeStart, onRoomAction, onDecorSurfaceChange, ...props }: Props) {
    const [decorOpen, setDecorOpen] = useState(false);
    const decorVisible = decorOpen && props.active !== false && (props.section ?? 'home') === 'home';
    useEffect(() => {
        onDecorSurfaceChange?.(decorVisible);
        return () => onDecorSurfaceChange?.(false);
    }, [decorVisible, onDecorSurfaceChange]);
    const returnFrame = useRef<number | undefined>(undefined);
    useEffect(() => () => cancelAnimationFrame(returnFrame.current ?? 0), [profileId, props.active, props.section]);
    const closeDecor = useCallback(() => {
        setDecorOpen(false);
        const target = document.querySelector<HTMLButtonElement>('.island-page[data-house-layout] [data-house-menu-trigger]');
        cancelAnimationFrame(returnFrame.current ?? 0);
        returnFrame.current = requestAnimationFrame(() => {
            if (target?.isConnected && !target.disabled && target.checkVisibility()) target.focus({ preventScroll: true });
        });
    }, []);
    useEffect(() => {
        if (!decorOpen) return;
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { event.preventDefault(); closeDecor(); } };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [decorOpen, closeDecor]);
    return <IslandLearningKeepsakes {...props} walkingAvailable
        challenge={<ChallengeHomeCard key={profileId} profileId={profileId} disabled={props.disabled}
            onLearn={props.onLearn} onResult={onChallengeResult} onStart={onChallengeStart} />}
        roomSurface={decorVisible ? <RoomDecorPanel room={room.room} words={room.words} mathLevel={room.mathLevel} vocabLevel={room.vocabLevel}
            status={room.status} busy={room.busy} error={room.error} onRetry={room.retry} onClose={closeDecor} onDecorate={command => void room.decorate(command)} /> : undefined}
        decor={choose => <>
            <button className="island-secondary room-decor-open" data-room-entry="decor" onClick={() => choose(() => setDecorOpen(true))}>
                <span className="room-entry-icon" aria-hidden="true"><IslandToyIcon kind="palette" size={32} /></span>
                <strong>もようがえ</strong><small>かべと ラグを かえる</small>
            </button>
            <LettersPanel key={profileId} profileId={profileId} letters={room.island ? islandLetters(room.island) : []} />
        </>}
        roomAccess={choose => <>
            <details className="room-access-list"><summary>へやの ことばと なかま</summary>
                <p>かべの ことばは さわると きけるよ</p>
                <div className="room-access-words">{room.words.filter(word => !room.room.hidden?.includes(word.group)).map(word => {
                    const entry = ENGLISH_WORDS.find(entry => entry.id === word.id);
                    return <button key={word.id} className="island-secondary" onClick={() => choose(() => onRoomAction?.({ type: 'word', word: word.id }), false)}>{entry?.surface ?? word.id}<small>{entry?.japanese}</small></button>;
                })}</div>
                {!room.words.length && <p>ことばが ふえると、かべの もように なるよ</p>}
                {room.guests.map(guest => <button key={guest.id} className="island-secondary" onClick={() => choose(() => onRoomAction?.({ type: 'guest', id: guest.id }), false)}>{villagerName(guest)}に はなしかける</button>)}
            </details>
        </>} />;
}
