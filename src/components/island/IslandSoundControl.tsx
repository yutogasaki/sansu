import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { enableSoundFromGesture, getSoundPlaybackStatus, setSoundEnabled, subscribeSoundPlayback } from '../../utils/audio';
import './IslandSoundControl.css';

export function IslandSoundControl({ enabled, disabled, onChange }: {
    enabled: boolean;
    disabled: boolean;
    onChange: (enabled: boolean) => Promise<boolean>;
}) {
    const playback = useSyncExternalStore(subscribeSoundPlayback, getSoundPlaybackStatus, () => 'off');
    const [working, setWorking] = useState(false);
    const [message, setMessage] = useState('');
    const locked = useRef(false);
    const intent = useRef<boolean | undefined>(undefined);
    const mounted = useRef(false);
    const latestEnabled = useRef(enabled);
    latestEnabled.current = enabled;
    const cue = useRef<ReturnType<typeof enableSoundFromGesture> | undefined>(undefined);
    useEffect(() => {
        mounted.current = true;
        const hide = () => { if (document.hidden) cue.current?.cancel(); };
        document.addEventListener('visibilitychange', hide);
        return () => {
            mounted.current = false;
            cue.current?.cancel();
            document.removeEventListener('visibilitychange', hide);
        };
    }, []);
    const ready = enabled && playback === 'ready';
    const visibleMessage = ready && message === 'もういちど おしてね' ? '' : message;
    const toggle = async () => {
        if (locked.current || disabled) return;
        locked.current = true;
        setWorking(true); setMessage('');
        // Howler may auto-resume between pointerdown and click. Honor the action
        // the button offered when the gesture began, even if readiness changed.
        const next = intent.current ?? !ready;
        intent.current = undefined;
        cue.current?.cancel();
        // Begin audio while the click is active; saving may outlive user activation.
        cue.current = next ? enableSoundFromGesture() : undefined;
        if (!next) setSoundEnabled(false);
        try {
            if (next !== enabled && !await onChange(next)) throw new Error('Sound setting was not saved');
            if (next && cue.current) {
                const playing = await cue.current.result;
                if (mounted.current && !document.hidden && !playing) setMessage('もういちど おしてね');
            }
        } catch {
            cue.current?.cancel();
            if (mounted.current) {
                setSoundEnabled(latestEnabled.current);
                setMessage('せっていを のこせなかったよ。もういちど おしてね');
            }
        } finally {
            locked.current = false;
            if (mounted.current) setWorking(false);
        }
    };
    return <div className="island-sound-control">
        <button type="button" className="island-sound-button" disabled={disabled || working}
            aria-label={ready ? 'おとを けす' : 'おとを だす'}
            data-sound-state={!enabled ? 'off' : playback}
            onPointerDown={() => { intent.current = !ready; }} onPointerCancel={() => { intent.current = undefined; }}
            onKeyDown={event => { if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) intent.current = !ready; }}
            onBlur={() => { intent.current = undefined; }} onClick={() => void toggle()}>
            {ready ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
            <span>{ready ? 'おと オン' : 'おとを だす'}</span>
        </button>
        {visibleMessage && <span className="island-sound-message" role="status">{visibleMessage}</span>}
    </div>;
}
