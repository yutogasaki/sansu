import { ParkStage } from './ParkStage';
import './Park.css';

export function ParkWelcome({ onStart }: { onStart: () => void }) {
    return <main className="park-page park-welcome" data-onboarding-world="park" data-build-revision={__BUILD_REVISION__}>
        <header className="park-welcome-heading">
            <p>つくって、ならべて。</p>
            <h1>ちいさな遊園地</h1>
        </header>
        <ParkStage layout={['slide', 'trampoline', null]} preview />
        <p className="park-welcome-copy">すべって、はねて。<br />つぎは どこに おこう？</p>
        <button className="park-button park-primary" onClick={onStart}>はじめる</button>
        <p className="park-note">さいしょに、なまえを おしえてね</p>
    </main>;
}
