import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENGLISH_WORDS } from '../../../domain/english/words';
import { DEFAULT_DECOR, learnedWords, type LearnedWord, type RoomDecor } from '../../../domain/growingIsland/room';
import { commandGrowingIsland, listMoments, observeGrowingIsland, readGrowingIsland } from '../../../domain/growingIsland/repository';
import { RoomSaveSession } from './roomSaveSession';
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
    const [owner, setOwner] = useState('');
    const [reload, setReload] = useState(0);
    const [room, setRoom] = useState<RoomDecor>(DEFAULT_DECOR), [mathLevel, setMathLevel] = useState(0), [vocabLevel, setVocabLevel] = useState(0);
    const [error, setError] = useState<string>(), [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'unknown' | 'error'>('loading');
    const session = useRef<RoomSaveSession | undefined>(undefined), generation = useRef(0);
    const [busy, setBusy] = useState(false);
    const words = useMemo<LearnedWord[]>(() => enabled ? learnedWords(vocab, ENGLISH_WORDS) : [], [enabled, vocab]);
    useEffect(() => {
        if (!enabled) return;
        const epoch = ++generation.current;
        let bitmap: ImageBitmap | undefined;
        setOwner(''); setIsland(undefined); setView(undefined); setStatus('loading'); setError(undefined);
        const current = new RoomSaveSession(profileId, {
            read: () => readGrowingIsland(profileId),
            write: (intent, receiptSinceRevision) => commandGrowingIsland(profileId, intent, Date.now(), undefined, receiptSinceRevision),
        }, snapshot => {
            if (epoch !== generation.current) return;
            setStatus(snapshot.status); setError(snapshot.error); setBusy(snapshot.busy);
            if (snapshot.record) {
                const record = snapshot.record;
                setOwner(profileId); setIsland(record.state); setRoom({ ...DEFAULT_DECOR, ...record.state.room });
                setMathLevel(record.state.mastery?.math ?? 0); setVocabLevel(record.state.mastery?.vocab ?? 0);
            }
        });
        session.current = current;
        const subscription = observeGrowingIsland(profileId).subscribe({
            next: record => { void current.observe(record); },
            error: () => current.failLoading(),
        });
        // A saved picture, never a live view or another owner's previous bitmap.
        void listMoments(profileId).then(async moments => {
            const latest = moments[moments.length - 1];
            if (!latest || typeof createImageBitmap !== 'function') return;
            const image = await createImageBitmap(latest.image);
            if (epoch === generation.current) { bitmap = image; setView(image); } else image.close();
        }).catch(() => undefined);
        return () => { generation.current = epoch + 1; subscription.unsubscribe(); current.dispose(); if (session.current === current) session.current = undefined; bitmap?.close(); };
    }, [profileId, enabled, reload]);
    const decorate = useCallback((command: Extract<Command, { type: 'decorate' }>) => session.current?.decorate(command), []);
    const retry = useCallback(() => { if (session.current) void session.current.retry(); else setReload(value => value + 1); }, []);
    const guests = useMemo(() => owner === profileId && island ? houseGuests(island) : [], [island, owner, profileId]);
    const today = useMemo(() => enabled ? todayLearned(vocab, math) : [], [enabled, vocab, math]);
    const decor = useMemo<IslandRoomDecor | undefined>(() => enabled && owner === profileId ? { ...room, words, guests, view, today } : undefined, [enabled, owner, profileId, room, words, guests, view, today]);
    return { decor, room: owner === profileId ? room : DEFAULT_DECOR, words, mathLevel: owner === profileId ? mathLevel : 0, vocabLevel: owner === profileId ? vocabLevel : 0, decorate, retry, busy: owner === profileId && busy, status: owner === profileId ? status : 'loading', error, island: owner === profileId ? island : undefined, guests };
}

export function readWordAloud(id: string) {
    const word = ENGLISH_WORDS.find(w => w.id === id);
    const surface = word?.surface ?? id.replace(/_lv\d+$/, '');
    return { ...word, surface, stop: speakEnglish(surface) };
}

