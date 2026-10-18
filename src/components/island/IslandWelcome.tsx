import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { islandEnabled, ISLAND_DELIVERY_ID } from '../../domain/island/feature';
const portrait = `${import.meta.env.BASE_URL}icons/icon-512.png`;
import './Island.css';
import './IslandOnboarding.css';

export const ISLAND_ONBOARDING_CANDIDATE = 'island-first-play-v2';
export default function IslandWelcome({ onStart, actionLabel = 'しまへ いく', busy = false, error }: {
    onStart: () => void; actionLabel?: string; busy?: boolean; error?: string;
}) {
    const [greeted, setGreeted] = useState(false);
    return <main className="island-page first-play-welcome" data-mode="welcome" data-onboarding-world="island"
        data-onboarding-candidate={ISLAND_ONBOARDING_CANDIDATE} data-visual-candidate-id={ISLAND_ONBOARDING_CANDIDATE}
        data-delivery-id={ISLAND_DELIVERY_ID} data-island-feature-enabled={String(islandEnabled())}
        data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__}>
        <header className="first-play-title"><h1><span>ぽこもこ</span><small>と不思議な島</small></h1></header>
        <div className="first-play-meeting">
            <button className="first-play-portrait" type="button" aria-label="ぽこもこに あいさつ" aria-pressed={greeted}
                onClick={() => setGreeted(value => !value)}>
                <img src={portrait} alt="クリームと青の顔、水玉の丸い耳のパッチワークのくま、ぽこもこ" fetchPriority="high" />
            </button>
            <p className="first-play-hello" role="status">{greeted ? <>きみに あえて<br />うれしいな！</> : <>こんにちは！<br />ぽこもこだよ</>}</p>
        </div>
        <footer className="first-play-entry">
            <button className="island-primary" type="button" disabled={busy} onClick={onStart}>{busy ? 'しまを ひらいているよ…' : actionLabel}<ArrowRight size={22} aria-hidden="true" /></button>
            {error && <p className="first-play-entry-error" role="alert">{error}</p>}
        </footer>
    </main>;
}
