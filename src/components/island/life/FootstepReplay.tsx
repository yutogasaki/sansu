import { useRef, useState } from 'react';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import type { LifeState } from '../../../domain/islandLife/model';
import type { FootstepInput } from './footstepPresentation';
import LifeWorld from './LifeWorld';

export default function FootstepReplay({ state, profileId, prepare, presented }: {
    state: LifeState; profileId: string; prepare: () => Promise<DiscoveryScene | undefined>;
    presented: (event: DiscoveryScene, evidence: PresentationEvidence) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [playback, setPlayback] = useState<{ state: LifeState; input?: FootstepInput }>({ state });
    return <div ref={host} className="life-footstep-replay">
        <LifeWorld state={playback.state} profileId={profileId} footstepInput={playback.input}
            prepareFootstepReplay={prepare} presented={presented} onCell={() => {}} controlsVisible>{null}</LifeWorld>
        <button type="button" onClick={() => {
            if (host.current?.querySelector('[data-footstep-magic],[data-footstep-pending]')) return;
            const retryAt = Number(host.current?.querySelector<HTMLElement>('[data-footstep-retry-at]')?.dataset.footstepRetryAt ?? 0);
            if (performance.now() < retryAt) return;
            const targetId = state.footstepTouch?.targetId; if (!targetId) return;
            setPlayback({ state: { ...state, scenePose: undefined }, input: { profileId, id: crypto.randomUUID(), targetId, source: 'replay' } });
        }}>あるきを もういちど</button>
    </div>;
}
