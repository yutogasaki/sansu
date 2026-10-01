import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENGLISH_WORDS } from '../../../domain/english/words';
import { DEFAULT_DECOR, learnedWords, type LearnedWord, type RoomDecor } from '../../../domain/growingIsland/room';
import { commandGrowingIsland, listMoments, readGrowingIsland } from '../../../domain/growingIsland/repository';
import { houseGuests } from './houseGuests';
import type { Command, GrowingState } from '../../../domain/growingIsland';
import { speakEnglish } from '../../../utils/tts';
import type { IslandRoomDecor } from '../three/learningKeepsakeScenery';

/** The learned words, the saved room choices and a way to change them (spec 52 §13.1). */
export function useGrowingRoom(profileId: string, vocab: Record<string, { strength: number; independentCorrectAnswers?: number }>, enabled: boolean) {
    const [island, setIsland] = useState<GrowingState>(), [view, setView] = useState<ImageBitmap>();
    const [room, setRoom] = useState<RoomDecor>(DEFAULT_DECOR), [mathLevel, setMathLevel] = useState(0), [error, setError] = useState<string>();
    const words = useMemo<LearnedWord[]>(() => enabled ? learnedWords(vocab, ENGLISH_WORDS) : [], [enabled, vocab]);
    useEffect(() => {
        if (!enabled) return;
        let live = true;
        // The window shows the latest picture of the island's story.
        void listMoments(profileId).then(async moments => {
            const latest = moments[moments.length - 1];
            if (!latest || typeof createImageBitmap !== 'function') return;
            const bitmap = await createImageBitmap(latest.image);
            if (live) setView(bitmap); else bitmap.close();
        }).catch(() => undefined);
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
    const guests = useMemo(() => island ? houseGuests(island) : [], [island]);
    const decor = useMemo<IslandRoomDecor | undefined>(() => enabled ? { ...room, words, guests, view } : undefined, [enabled, room, words, guests, view]);
    return { decor, room, words, mathLevel, decorate, error, island, guests };
}

export function readWordAloud(id: string) {
    const word = ENGLISH_WORDS.find(w => w.id === id);
    speakEnglish(word?.surface ?? id.replace(/_lv\d+$/, ''));
    return word;
}

