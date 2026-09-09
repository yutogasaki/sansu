import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Headphones, Square, Volume2 } from 'lucide-react';
import type { ListeningSentence } from '../../domain/english/listening';
import { getSoundPlaybackStatus, subscribeSoundPlayback } from '../../utils/audio';
import { speakEnglish, stopEnglishSpeech } from '../../utils/tts';
import { IslandGlyph } from '../island/IslandGlyph';
import './EnglishListening.css';

export function EnglishListeningEntry({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
    return <button type="button" className="english-listening-entry" disabled={disabled} onClick={onOpen}>
        <Headphones size={17} aria-hidden="true" />ぶんを きく
    </button>;
}

export function EnglishListening({ sentence, easy, onClose }: { sentence: ListeningSentence; easy: boolean; onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const cancel = useRef<() => void>(() => {});
    const [status, setStatus] = useState<'idle' | 'playing' | 'ended' | 'error'>('idle');
    const sound = useSyncExternalStore(subscribeSoundPlayback, getSoundPlaybackStatus, () => 'off' as const);
    const stop = useCallback(() => { cancel.current(); setStatus(current => current === 'idle' ? 'idle' : 'ended'); }, []);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        stopEnglishSpeech();
        dialog.current?.showModal();
        // Native dialog traps focus/inerts siblings. Also stop global answer shortcuts.
        const keys = (event: KeyboardEvent) => {
            event.stopImmediatePropagation();
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        };
        const hide = () => { if (document.hidden) stop(); };
        window.addEventListener('keydown', keys, true);
        document.addEventListener('visibilitychange', hide);
        return () => {
            cancel.current();
            window.removeEventListener('keydown', keys, true);
            document.removeEventListener('visibilitychange', hide);
            previous?.focus();
        };
    }, [onClose, stop]);
    useEffect(() => { if (sound === 'off') stop(); }, [sound, stop]);
    const play = () => {
        if (sound === 'off' || document.hidden) return;
        setStatus('playing');
        cancel.current = speakEnglish(sentence.english, {
            onEnd: () => setStatus('ended'), onError: () => setStatus('error'),
        });
    };
    return <dialog ref={dialog} className="english-listening" aria-label="ぶんを きく" onCancel={event => { event.preventDefault(); onClose(); }} data-listening-sentence={sentence.id}>
        <div className="english-listening-content">
            <p className="english-listening-heading"><Headphones size={18} aria-hidden="true" />えいごの ひとこと</p>
            <div className="english-listening-picture" role="img" aria-label={sentence.sceneLabel}><IslandGlyph symbol={sentence.glyph} decorative /></div>
            <p className="english-listening-english" lang="en">{sentence.english}</p>
            <p className="english-listening-japanese" lang="ja">{easy ? sentence.japanese : sentence.japaneseKanji}</p>
            <p className="english-listening-status" role="status">{sound === 'off' ? 'おとは オフに なっているよ' : status === 'error' ? 'いまは おとが でないよ' : 'きくだけで いいよ'}</p>
            <button type="button" className="english-listening-play" disabled={sound === 'off'} onClick={status === 'playing' ? stop : play}>
                {status === 'playing' ? <Square size={20} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
                {status === 'playing' ? 'とめる' : status === 'idle' ? 'きく' : 'もういちど きく'}
            </button>
            <button type="button" className="english-listening-continue" onClick={onClose}>つづける</button>
        </div>
    </dialog>;
}
