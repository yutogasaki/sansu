import { useEffect, useRef, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../../domain/types';
import { getAllProfiles, setActiveProfileId } from '../../domain/user/repository';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProfileChoices } from '../ProfileChoices';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import './IslandProfileSwitcher.css';

export function IslandProfileSwitcher({ activeId, disabled }: { activeId: string; disabled: boolean }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [profiles, setProfiles] = useState<UserProfile[]>();
    const [loadError, setLoadError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [switchError, setSwitchError] = useState(false);
    const switching = useRef(false);
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setProfiles(undefined); setLoadError(false); setSwitchError(false);
        void getAllProfiles().then(list => { if (!cancelled) setProfiles(list); })
            .catch(() => { if (!cancelled) setLoadError(true); });
        return () => { cancelled = true; };
    }, [open, attempt]);
    const close = () => {
        if (switching.current) return;
        setOpen(false);
        requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    };
    const select = async (id: string) => {
        if (disabled || switching.current || id === activeId) return;
        switching.current = true; setSwitchingId(id); setSwitchError(false);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            await setActiveProfileId(id);
            navigate('/', { replace: true });
        } catch {
            setSwitchError(true);
        } finally {
            switching.current = false; setSwitchingId(null); release();
        }
    };
    return <>
        {/* Opening names is read-only; background saves must not swallow this tap. */}
        <button ref={trigger} type="button" className="island-profile-switch" aria-label="あそぶ人を きりかえる" aria-haspopup="dialog"
            onClick={() => setOpen(true)}><UsersRound size={18} aria-hidden="true" /><span>きりかえ</span></button>
        <Modal isOpen={open} onClose={close} title="だれが あそぶ？" initialFocus="dialog"
            footer={<Button variant="secondary" className="w-full" disabled={Boolean(switchingId)} onClick={close}>とじる</Button>}>
            <p className="mb-4 text-sm text-pokomoko-muted">なまえを おすと、その人の しまへ。</p>
            {profiles && <ProfileChoices profiles={profiles} activeId={activeId} switchingId={switchingId}
                disabled={disabled || Boolean(switchingId)} onSelect={id => { void select(id); }} />}
            {!profiles && !loadError && <p role="status">なまえを よみこみ中…</p>}
            {loadError && <div role="alert"><p>なまえを よみこめなかったよ。</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>もういちど</Button></div>}
            <p role="status" className="mt-3 text-sm text-pokomoko-muted">{switchError ? 'きりかえが できなかったよ。もういちど なまえを おしてね。' : switchingId ? 'しまを ひらいているよ…' : disabled ? 'いまの そうさが おわるまで まってね。' : ''}</p>
        </Modal>
    </>;
}
