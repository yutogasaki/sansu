import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENGLISH_WORDS } from '../../../domain/english/words';
import { DEFAULT_DECOR, learnedWords, type LearnedWord, type RoomDecor } from '../../../domain/growingIsland/room';
import { commandGrowingIsland, readGrowingIsland } from '../../../domain/growingIsland/repository';
import type { Command, GrowingState } from '../../../domain/growingIsland';
import { speakEnglish } from '../../../utils/tts';
import type { IslandRoomDecor } from '../three/learningKeepsakeScenery';

/** The learned words, the saved room choices and a way to change them (spec 52 §13.1). */
export function useGrowingRoom(profileId: string, vocab: Record<string, { strength: number; independentCorrectAnswers?: number }>, enabled: boolean) {
    const [island, setIsland] = useState<GrowingState>();
    const [room, setRoom] = useState<RoomDecor>(DEFAULT_DECOR), [mathLevel, setMathLevel] = useState(0), [error, setError] = useState<string>();
    const words = useMemo<LearnedWord[]>(() => enabled ? learnedWords(vocab, ENGLISH_WORDS) : [], [enabled, vocab]);
    useEffect(() => {
        if (!enabled) return;
        let live = true;
        void readGrowingIsland(profileId).then(record => {
            if (!live || !record) return;
            setIsland(record.state); setRoom({ ...DEFAULT_DECOR, ...record.state.room }); setMathLevel(record.state.mastery?.math ?? 0);
        }).catch(() => undefined);
        return () => { live = false; };
    }, [profileId, enabled]);
    const decorate = useCallback(async (command: Extract<Command, { type: 'decorate' }>) => {
        try {
            const result = await commandGrowingIsland(profileId, { id: crypto.randomUUID(), command });
            setRoom({ ...DEFAULT_DECOR, ...result.record.state.room }); setError(undefined);
        } catch { setError('もようがえを ほぞん できなかったよ。もういちど ためしてね。'); }
    }, [profileId]);
    const decor = useMemo<IslandRoomDecor | undefined>(() => enabled ? { ...room, words } : undefined, [enabled, room, words]);
    return { decor, room, words, mathLevel, decorate, error, island };
}

export function readWordAloud(id: string) {
    const word = ENGLISH_WORDS.find(w => w.id === id);
    speakEnglish(word?.surface ?? id.replace(/_lv\d+$/, ''));
    return word;
}

