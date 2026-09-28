import { useMemo } from 'react';
import type { LifeRecord } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { lifeDiscoveryPresentation } from '../../../domain/islandLife/capabilities';
import { FANTASY_CANDIDATE, readGardenTime } from './fantasy/presentation';
import LifeWorld from './LifeWorld';
import './life-resources.css';
import './fantasy/fantasy.css';

/** The house overview shows the very same cottage, neighbors and owned garden.
 * It is a view only: no second owner, placement or discovery journal. */
export default function LifeHouseExterior({ record }: { record: LifeRecord }) {
    const state = useMemo(() => {
        const current = replayLife(record);
        return { ...current, ...lifeDiscoveryPresentation(current.items), worldStyle: 'fantasy-garden-v1' as const,
            gardenTime: readGardenTime(record.profileId) };
    }, [record]);
    return <section className="life-house-exterior" aria-label="庭とつながる おうち" data-life-candidate={FANTASY_CANDIDATE} data-garden-time={state.gardenTime}>
        <LifeWorld focus="house" state={state} changeKey={`${record.profileId}:${record.revision}`} onCell={() => {}} controlsVisible={false}>{null}</LifeWorld>
    </section>;
}
