import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { deleteProfile, getAllProfiles } from '../../domain/user/repository';
import storage from '../../utils/storage';
import { Button } from '../../components/ui/Button';
import { useIslandNavigation } from '../../components/island/useIslandNavigation';

export function ParentTools() {
    const navigate = useNavigate();
    const navigation = useIslandNavigation();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    async function reset() {
        if (busy || !window.confirm('ほんとうに 全部消しますか？')) return;
        setBusy(true); setError(false);
        try {
            for (const profile of await getAllProfiles()) await deleteProfile(profile.id);
            storage.clearAll(); navigate('/onboarding');
        } catch { setError(true); setBusy(false); }
    }
    return <details className="parent-details parent-tools">
        <summary>データの管理・開発者向け<ChevronDown size={18} aria-hidden="true" /></summary>
        <div>
            <Button variant="secondary" disabled={busy} onClick={() => navigation ? navigation.open('/dev') : navigate('/dev')}>開発者モード</Button>
            <p className="parent-purpose">リセットすると、この端末のすべてのプロフィールと記録が消えます。</p>
            <button className="settings-reset-action" disabled={busy} onClick={() => void reset()}>全データをリセット</button>
            {error && <p role="alert">削除を完了できませんでした。もう一度お試しください。</p>}
        </div>
    </details>;
}
