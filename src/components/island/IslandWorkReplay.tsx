import { IslandPanelHeading } from './IslandPanelHeading';
import { useState } from 'react';
import { ArrowRight, Camera, Play } from 'lucide-react';
import type { SharedTarget } from '../../domain/island/sharedMemories';
import type { WorkshopSceneCommand } from './three/workshopScene';

/** Replaying a captured work never borrows the editable draft as its source. */
export function IslandWorkReplay({ target, disabled, showingDraft, onShowDraft, onCommand, onStartFrom, onClose, onPhoto, onLearn, error, onRetry }: {
    target: Extract<SharedTarget, { kind: 'work' }>;
    disabled: boolean;
    showingDraft: boolean;
    onShowDraft: (value: boolean) => void;
    onCommand: (command: WorkshopSceneCommand) => void;
    onStartFrom: () => Promise<boolean>;
    onClose: () => void;
    onPhoto: () => void;
    onLearn: () => void;
    error?: string;
    onRetry?: () => void;
}) {
    const [confirm, setConfirm] = useState(false);
    return <section className="island-sheet island-shared" aria-label="のこした さくひんを ためす">
        <IslandPanelHeading title={target.name} kind="close" onExit={onClose} disabled={disabled} exitAriaLabel="さいせいを とじる" />
        <p>{showingDraft ? 'いまの つくりかけを みているよ。' : 'かざった ときの さくひんだよ。'}みるだけで つくりかけは かわらないよ。</p>
        {error && <div className="island-error" role="alert"><p>{error}</p>{onRetry && <button className="island-secondary" disabled={disabled} onClick={onRetry}>もういちど のこす</button>}</div>}
        <div className="island-shared-row"><button className="island-primary" disabled={disabled} onClick={() => onCommand({ type: 'run' })}><Play size={18} />みずを ながす</button>
            <button className="island-secondary" onClick={() => onCommand({ type: 'stop' })}>とめる</button>
            <button className="island-secondary" disabled={disabled} onClick={onPhoto}><Camera size={18} />しゃしんを とる</button></div>
        {!confirm ? <button className="island-secondary" disabled={disabled} onClick={() => setConfirm(true)}>この あんから つくる</button>
            : <div className="island-shared-preview"><p>いまの つくりかけを「{target.name}」に かえる？ かえるまえに、どちらも みられるよ。</p>
                <div className="island-shared-row"><button className="island-secondary" aria-pressed={!showingDraft} onClick={() => { onCommand({ type: 'stop' }); onShowDraft(false); }}>かざった さくひん</button>
                    <button className="island-secondary" aria-pressed={showingDraft} onClick={() => { onCommand({ type: 'stop' }); onShowDraft(true); }}>いまの つくりかけ</button></div>
                <div className="island-shared-row"><button className="island-primary" disabled={disabled} onClick={() => { void onStartFrom(); }}>この あんに かえる</button>
                    <button className="island-secondary" onClick={() => { setConfirm(false); onShowDraft(false); onCommand({ type: 'stop' }); }}>やめる</button></div></div>}
        <button className="island-primary" disabled={disabled} onClick={onLearn}>まなぶ<ArrowRight size={18} /></button>
    </section>;
}
