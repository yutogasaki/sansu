import { useState } from 'react';
import type { LifeState } from '../../../domain/islandLife/model';
import { activityLabel, activityPhase, residentFavoriteLabel, residentReaction } from '../../../domain/islandLife/activity';
import { sampleLifeRoaming } from './roamingPresentation';
import LifeResidentPortrait from './LifeResidentPortrait';

const names = { pokomoko: 'ぽこもこ', rabbit: 'うさぎ', otter: 'カワウソ' };
export default function LifeResidentsSummary({ state, now }: { state: LifeState; now: number }) {
    const [selected, setSelected] = useState<keyof typeof names>('pokomoko');
    const residents = sampleLifeRoaming(state, now).residents;
    const resident = residents.find(r => r.id === selected) ?? residents[0];
    const activity = residentReaction(state, resident, now)?.label ?? activityLabel(state, resident, now);
    return <div className="life-resident-view">
        <div className="life-resident-choices" role="group" aria-label="ようすを みる なかま">
            {residents.map(r => <button key={r.id} type="button" aria-pressed={r.id === resident.id} aria-controls="life-resident-story"
                data-life-resident={r.id} data-life-target={state.items.find(i => i.id === r.visit?.itemId)?.kind ?? 'home'}
                data-life-activity={activityPhase(state, r, now)} data-life-favorite={residentFavoriteLabel(r)} onClick={() => setSelected(r.id)}>
                <LifeResidentPortrait resident={r.id} style={state.heroStyle} /><span>{names[r.id]}</span>
            </button>)}
        </div>
        <div id="life-resident-story" className="life-resident-story" aria-label={`${names[resident.id]}の ようす`}>
            <p>{activity}</p><small>すきなもの：{residentFavoriteLabel(resident)}</small>
        </div>
    </div>;
}
