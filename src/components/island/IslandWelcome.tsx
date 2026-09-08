import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { createIsland } from '../../domain/island/catalog';
import { ISLAND_DELIVERY_ID, ISLAND_VISUAL_CANDIDATE } from '../../domain/island/feature';
import IslandStage from './IslandStage';
import { ItemPicture } from './IslandItems';
import './Island.css';
import './IslandOnboarding.css';

const preview = createIsland('welcome-preview', 0);
export const ISLAND_ONBOARDING_CANDIDATE = 'island-touch-first-v1';
export default function IslandWelcome({ onStart, actionLabel = 'まなぶ' }: { onStart: () => void; actionLabel?: string }) {
    const [playRequest, setPlayRequest] = useState<{ id: string; itemId: string }>();
    const [message, setMessage] = useState('');
    const play = (itemId: string) => {
        if (!preview.items.some(item => item.id === itemId)) return;
        setMessage(''); setPlayRequest({ id: crypto.randomUUID(), itemId });
    };
    return <main className="island-page island-welcome" data-mode="welcome" data-onboarding-world="island" data-onboarding-candidate={ISLAND_ONBOARDING_CANDIDATE} data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE} data-delivery-id={ISLAND_DELIVERY_ID} data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__}>
        <header><h1 className="pokomoko-wordmark"><span>ぽこもこ</span><small>と不思議な島</small></h1></header>
        <IslandStage items={preview.items} growth={preview.growth} completedSets={0} pulse={0} learning={false} playRequest={playRequest}
            onItemSelect={play} onPlayResult={result => {
                if (result.requestId === playRequest?.id && result.status !== 'playing') setMessage('いまは うまく あそべないよ');
            }} />
        <div className="island-home-controls">
            <div className="island-welcome-play" aria-label="しまに さわってみよう">
                <button type="button" className="island-secondary" onClick={() => play('starter-flower')}><ItemPicture kind="flower" />おはな</button>
                <button type="button" className="island-secondary" onClick={() => play('starter-lantern')}><ItemPicture kind="lantern" />あかり</button>
            </div>
            {message && <p className="island-note" role="status">{message}</p>}
            <button type="button" className="island-primary island-start" onClick={onStart}>{actionLabel}<ArrowRight size={20} /></button>
        </div>
    </main>;
}
