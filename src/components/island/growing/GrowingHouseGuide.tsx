import { useEffect, useRef, useState } from 'react';
import { commandGrowingIsland, observeGrowingIsland, type GrowingRecord } from '../../../domain/growingIsland/repository';
import { starterStep } from '../../../domain/growingIsland/guidance';
import type { AchievementId, Command } from '../../../domain/growingIsland';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { GrowingGuideBook } from './GrowingGuideBook';
import { starterCopy } from './useGrowingGuide';
import type { GrowingGuideAction } from './GrowingGuideEntry';
import './growing.css';

/** Reading the house book does not sync clocks or consume learning completions. */
export default function GrowingHouseGuide({ profileId, onClose, onLearn, onIslandAction }: {
    profileId: string; onClose: () => void; onLearn: () => void; onIslandAction: (action: GrowingGuideAction) => void;
}) {
    const [record, setRecord] = useState<GrowingRecord>(), [error, setError] = useState<string>(), [retry, setRetry] = useState(0);
    const [busy, setBusy] = useState(false), live = useRef(false), saving = useRef(false);
    useEffect(() => {
        live.current = true;
        const subscription = observeGrowingIsland(profileId).subscribe({
            next: value => {
                if (!live.current) return;
                if (value) { setRecord(current => current && current.revision > value.revision ? current : value); setError(undefined); }
                else { setRecord(undefined); setError('ほんを ひらけなかったよ。もういちど ためしてね。'); }
            },
            error: () => { if (live.current) setError('ほんを ひらけなかったよ。もういちど ためしてね。'); },
        });
        return () => { live.current = false; subscription.unsubscribe(); };
    }, [profileId, retry]);
    const act = async (commands: Command[], after?: () => void) => {
        if (saving.current) return;
        saving.current = true; setBusy(true);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            for (const command of commands) {
                if (!live.current) return;
                const result = await commandGrowingIsland(profileId, { id: crypto.randomUUID(), command });
                if (live.current) setRecord(current => current && current.revision > result.record.revision ? current : result.record);
            }
            if (live.current) { setError(undefined); after?.(); }
        } catch { if (live.current) setError('ほんを ほぞん できなかったよ。もういちど ためしてね。'); }
        finally { release(); saving.current = false; if (live.current) setBusy(false); }
    };
    const tryGoal = (id: AchievementId, choose = false, play = true) => {
        const commands: Command[] = choose ? [{ type: 'choose-goal', id }] : [];
        if (record?.state.guidance?.starter.automatic) commands.push({ type: 'starter-guide', automatic: false });
        void act(commands, play ? () => onIslandAction({ kind: 'goal', id }) : undefined);
    };
    if (!record) return <section className="growing-overlay" aria-label="しまの あそびかた"><div className="growing-overlay-body">
        <p role={error ? 'alert' : 'status'}>{error ?? 'ほんを ひらいているよ…'}</p>
        {error && <button onClick={() => setRetry(n => n + 1)}>もういちど</button>}<button onClick={onClose}>とじる</button>
    </div></section>;
    return <>
        {error && <div className="growing-error" role="alert"><p>{error}</p><button onClick={() => setError(undefined)}>とじる</button></div>}
        <GrowingGuideBook state={record.state} busy={busy} onClose={onClose} onChoose={(id, play) => tryGoal(id, true, play)} onTry={id => tryGoal(id)}
            onClear={() => void act([{ type: 'choose-goal' }])}
            onResumeStarter={() => void act([{ type: 'starter-guide', automatic: true }], () => onIslandAction({ kind: 'resume' }))}
            onStarterAction={() => {
                const step = starterStep(record.state);
                if (step === 'S4' && starterCopy(record.state, step).action === 'まなぶ') onLearn();
                else if (step) onIslandAction({ kind: 'starter', step });
            }} onStarterChoose={id => void act([{ type: 'choose-starter-play', id }], () => onIslandAction({ kind: 'goal', id }))}
            onTarget={evidence => onIslandAction({ kind: 'memory', evidence })} />
    </>;
}
