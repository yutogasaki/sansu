import { Volume2 } from 'lucide-react';
import type { useIslandSpeech } from './useIslandSpeech';

export function IslandSpeechControl({ speech, disabled }: { speech: ReturnType<typeof useIslandSpeech>; disabled: boolean }) {
    const message = speech.status === 'blocked' ? '「きく」を おしてね'
        : speech.status === 'unavailable' ? 'えいごの こえが つかえないよ'
            : speech.status === 'error' ? 'もういちど「きく」を おしてね' : '';
    return <span className="island-speech-control">
        <button type="button" className="island-speech-button" disabled={disabled} onClick={speech.play}
            aria-label="えいごを きく" data-speech-status={speech.status}>
            <Volume2 size={20} aria-hidden="true" /><span>{speech.status === 'speaking' ? 'よんでいるよ' : 'きく'}</span>
        </button>
        <span className="island-speech-message" role="status">{message}</span>
    </span>;
}
