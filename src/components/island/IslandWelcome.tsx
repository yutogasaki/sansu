import { ArrowRight } from 'lucide-react';
import { createIsland } from '../../domain/island/catalog';
import { ISLAND_DELIVERY_ID, ISLAND_VISUAL_CANDIDATE } from '../../domain/island/feature';
import IslandStage from './IslandStage';
import './Island.css';

const preview = createIsland('welcome-preview', 0);
export default function IslandWelcome({ onStart }: { onStart: () => void }) {
    return <main className="island-page island-welcome" data-mode="welcome" data-onboarding-world="island" data-visual-candidate-id={ISLAND_VISUAL_CANDIDATE} data-delivery-id={ISLAND_DELIVERY_ID} data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__}>
        <header><p className="island-eyebrow">まなぶたび、くらしが ふえる。</p><h1>ふしぎな しま</h1></header>
        <IslandStage items={preview.items} completedSets={0} pulse={0} learning={false} />
        <div className="island-home-controls"><p className="island-welcome-copy">ひとつ とくと、ひかりが とどく。<br />きみの しまに、なにを おこう？</p>
            <button className="island-primary island-start" onClick={onStart}>はじめる<ArrowRight size={20} /></button>
            <p className="island-note">さいしょは おうちのひとと じゅんびしよう</p></div>
    </main>;
}
