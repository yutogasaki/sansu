import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENGLISH_WORDS } from '../../../domain/english/words';
import { DEFAULT_DECOR, learnedWords, type LearnedWord, type RoomDecor } from '../../../domain/growingIsland/room';
import { commandGrowingIsland, listMoments, readGrowingIsland } from '../../../domain/growingIsland/repository';
import { houseGuests } from './houseGuests';
import type { Command, GrowingState } from '../../../domain/growingIsland';
import { speakEnglish } from '../../../utils/tts';
import { MATH_SKILL_LABELS } from '../../../domain/math/labels';
import type { IslandRoomDecor } from '../three/learningKeepsakeScenery';

/** The learned words, the saved room choices and a way to change them (spec 52 §13.1). */
type Memory = { strength: number; independentCorrectAnswers?: number; lastIndependentCorrectAt?: string };

/** Words and math skills answered on the child's own today, for Pokomoko's desk (§13.5). */
export function todayLearned(vocab: Record<string, Memory>, math: Record<string, Memory> = {}, now = new Date()) {
    const today = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); };
    const words = Object.entries(vocab).filter(([, m]) => today(m.lastIndependentCorrectAt)).map(([id]) => ENGLISH_WORDS.find(w => w.id === id)?.surface ?? id.replace(/_lv\d+$/, ''));
    const skills = Object.entries(math).filter(([, m]) => today(m.lastIndependentCorrectAt)).map(([id]) => MATH_SKILL_LABELS[id] ?? '');
    return [...skills.filter(Boolean), ...words];
}

export function useGrowingRoom(profileId: string, vocab: Record<string, Memory>, enabled: boolean, math: Record<string, Memory> = {}) {
    const [island, setIsland] = useState<GrowingState>(), [view, setView] = useState<ImageBitmap>();
    const [room, setRoom] = useState<RoomDecor>(DEFAULT_DECOR), [mathLevel, setMathLevel] = useState(0), [vocabLevel, setVocabLevel] = useState(0), [error, setError] = useState<string>();
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
            setIsland(record.state); setRoom({ ...DEFAULT_DECOR, ...record.state.room }); setMathLevel(record.state.mastery?.math ?? 0); setVocabLevel(record.state.mastery?.vocab ?? 0);
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
    const today = useMemo(() => enabled ? todayLearned(vocab, math) : [], [enabled, vocab, math]);
    const decor = useMemo<IslandRoomDecor | undefined>(() => enabled ? { ...room, words, guests, view, today } : undefined, [enabled, room, words, guests, view, today]);
    return { decor, room, words, mathLevel, vocabLevel, decorate, error, island, guests };
}

export function readWordAloud(id: string) {
    const word = ENGLISH_WORDS.find(w => w.id === id);
    speakEnglish(word?.surface ?? id.replace(/_lv\d+$/, ''));
    return word;
}

