import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Volume2 } from 'lucide-react';
import type { Problem } from '../../domain/types';
import { getEnglishExampleSentence } from '../../domain/english/examples';
import { getSoundPlaybackStatus, subscribeSoundPlayback } from '../../utils/audio';
import { speakEnglish } from '../../utils/tts';
import { cn } from '../../utils/cn';
import './EnglishExampleSentence.css';

type ExampleProblem = Pick<Problem, 'subject' | 'categoryId'>;

export function EnglishExampleSentence({ problem, className }: { problem: ExampleProblem; className?: string }) {
    const sentence = problem.subject === 'vocab' ? getEnglishExampleSentence(problem.categoryId) : undefined;
    const sound = useSyncExternalStore(subscribeSoundPlayback, getSoundPlaybackStatus, () => 'off' as const);
    const cancelSpeech = useRef<() => void>(() => {});

    useEffect(() => () => cancelSpeech.current(), [sentence]);
    useEffect(() => {
        if (sound === 'off') cancelSpeech.current();
    }, [sound]);

    if (!sentence) return null;

    return <div className={cn('english-example-sentence-row', className)}>
        <p className="english-example-sentence" data-english-example-sentence={sentence} lang="en">
            {sentence}
        </p>
        <button
            type="button"
            className="english-example-play"
            disabled={sound === 'off'}
            aria-label="ぶんを きく"
            title="英文を読み上げ"
            onClick={event => {
                event.stopPropagation();
                if (sound === 'off' || document.hidden) return;
                cancelSpeech.current = speakEnglish(sentence);
            }}
        >
            <Volume2 size={17} aria-hidden="true" />
            ぶんを きく
        </button>
    </div>;
}
