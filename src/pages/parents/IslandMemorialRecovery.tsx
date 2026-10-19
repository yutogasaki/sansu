import { ParentGuard } from '../../components/domain/ParentGuard';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { observeGrowingIsland, restoreGrowingWonder, type GrowingRecord } from '../../domain/growingIsland/repository';
import { upgrade } from '../../domain/growingIsland/syncProjection';
import { islandIdOf } from '../../domain/growingIsland/voyages';
import { WONDER_SLOTS, type WonderSlot } from '../../domain/growingIsland/growth';

/** Recovery itself requires the parent gate, including direct visits to /parents. */
export function IslandMemorialRecovery({ profileId }: { profileId: string }) {
    const [record, setRecord] = useState<GrowingRecord>();
    const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [confirmation, setConfirmation] = useState<{ slot: WonderSlot; islandId: string; revision: number }>();
    useEffect(() => {
        const subscription = observeGrowingIsland(profileId).subscribe({
            next: value => {
                try { setRecord(value ? upgrade(value, Date.now()) : undefined); }
                catch { setMessage('島の記録を確認できませんでした。新しい版で開き直してください。'); }
            }, error: () => setMessage('島の記録を読み込めませんでした。画面を開き直してください。'),
        });
        return () => subscription.unsubscribe();
    }, [profileId]);
    async function restore(target: { slot: WonderSlot; islandId: string; revision: number }) {
        if (!record || saving.current) return;
        saving.current = true; setBusy(true); setMessage('');
        try {
            const saved = await restoreGrowingWonder(profileId, target.islandId, target.slot, target.revision);
            setRecord(saved); setMessage('この島の記念を復元しました。ふしぎのたねから置けます。');
        } catch (error) { setMessage(error instanceof Error ? error.message : '復元できませんでした。もう一度確認してください。'); }
        finally { saving.current = false; setBusy(false); }
    }
    const pending = WONDER_SLOTS.filter(id => record?.state.growth?.slots[id].status === 'pending');
    return <details className="parent-details">
        <summary>島の記念を復元</summary>
        <div>
            <p className="parent-purpose">{record?.state.islandName ?? 'いまの島'}の、古い記録から確認できない記念だけを復元します。学習記録や持ちものは消しません。</p>
            {pending.length > 0 ? <>
                <p className="parent-purpose">すでに受け取った記念と重複する場合があります。復元は各枠1回で、しずくには換えられません。</p>
                {pending.map(slot => <Button key={slot} variant="secondary" disabled={busy} onClick={() => { if (record) setConfirmation({ slot, islandId: islandIdOf(record), revision: record.revision }); }}>記念 {WONDER_SLOTS.indexOf(slot) + 1} を復元</Button>)}
            </> : <p>復元が必要な記念はありません。</p>}
            {message && <p role="status">{message}</p>}
            <ParentGuard isOpen={!!confirmation} onCancel={() => setConfirmation(undefined)} onSuccess={() => { const target = confirmation; setConfirmation(undefined); if (target) void restore(target); }} />
        </div>
    </details>;
}
