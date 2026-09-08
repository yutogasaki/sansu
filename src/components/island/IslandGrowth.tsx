import { Check, Flower2, House, Sprout, Trees, Waves, X } from 'lucide-react';
import { getIslandGrowthTarget, getIslandHabitatLevel, isIslandHabitatUnlocked, ISLAND_HABITATS } from '../../domain/island/growth';
import { getIslandExpansionLevel } from '../../domain/island/expansion';
import type { IslandHabitatId, IslandPlan, IslandRecord } from '../../domain/island/types';
import { islandCompletionExpansion, islandExpansionPreview } from './islandExpansionPreview';
import './IslandGrowth.css';

const habitatIcons = { garden: Flower2, waterside: Waves, grove: Trees, village: House };
export type IslandDistrict = 'all' | 'home' | 'east' | 'west';

export function IslandGrowthSummary({ island, plan, disabled, onChoose }: {
    island: IslandRecord; plan?: IslandPlan; disabled: boolean; onChoose: () => void;
}) {
    // A legacy reservation keeps its original gift contract until a new plan
    // initializes growth. Do not offer an operation its record cannot save.
    if (!island.growth) return <div className="island-growth-summary"><Sprout size={21} aria-hidden="true" /><p>みんなが くらす しま</p></div>;
    const target = plan?.status === 'active' && plan.growthTarget ? plan.growthTarget : getIslandGrowthTarget(island);
    const habitat = ISLAND_HABITATS.find(place => place.id === target)!;
    const next = getIslandGrowthTarget(island);
    const nextName = ISLAND_HABITATS.find(place => place.id === next)?.name;
    const complete = ISLAND_HABITATS.every(place => getIslandHabitatLevel(island, place.id) === 3);
    const expansion = islandExpansionPreview(island, plan);
    const Icon = habitatIcons[target];
    return <div className="island-growth-summary" data-growth-target={target}>
        <Icon size={21} aria-hidden="true" />
        <div><p>{complete ? 'みんなの いばしょが 育ったよ' : `${habitat.name}が 育っているよ`}</p>
            {!complete && <GrowthSteps value={island.growth?.progress[target] ?? 0} />}
            {expansion ? <small className="island-growth-preview" data-island-expansion-preview={expansion}>もうすぐ {expansion === 'east' ? 'ひがし' : 'にし'}へ しまが ひろがるよ</small>
                : !complete && next !== target && <small>つぎは {nextName}</small>}</div>
        {!complete && <button className="island-text-button" disabled={disabled} onClick={onChoose} aria-label="育てる ばしょを えらぶ">かえる</button>}
    </div>;
}

function GrowthSteps({ value }: { value: number }) {
    return <span className="island-growth-steps" role="img" aria-label={`そだち ${value} / 6`}>
        {Array.from({ length: 6 }, (_, index) => <i key={index} data-grown={index < value} data-milestone={[0, 2, 5].includes(index)} />)}
    </span>;
}

export function IslandGrowthChoices({ island, plan, disabled, onSelect, onClose }: {
    island: IslandRecord; plan?: IslandPlan; disabled: boolean; onSelect: (id: IslandHabitatId) => void; onClose: () => void;
}) {
    const next = getIslandGrowthTarget(island);
    const frozen = plan?.status === 'active' ? plan.growthTarget : undefined;
    const current = ISLAND_HABITATS.find(place => place.id === frozen);
    return <section className="island-sheet island-growth-choices" aria-label="育てる ばしょを えらぶ">
        <div className="island-sheet-title"><h2>どこを 育てよう？</h2><button className="island-icon-button" disabled={disabled} aria-label="ばしょえらびを とじる" onClick={onClose}><X size={20} /></button></div>
        {current && <p className="island-note">いまの もんだいは {current.name}へ。えらぶと、つぎから 育つよ。</p>}
        <div className="island-growth-place-list">{ISLAND_HABITATS.map(habitat => {
            const unlocked = Boolean(island.growth) && isIslandHabitatUnlocked(island, habitat.id);
            const level = getIslandHabitatLevel(island, habitat.id);
            // A different place starts after the reserved place finishes. Its
            // final growth may already have opened this land, so do not promise it twice.
            const finishingAnother = frozen && frozen !== habitat.id && island.growth?.progress[frozen] === 5;
            const expansion = (plan && !plan.growthTarget) || finishingAnother ? undefined : islandCompletionExpansion(island, habitat.id);
            const Icon = habitatIcons[habitat.id];
            return <button key={habitat.id} className="island-growth-place" disabled={disabled || !unlocked || level === 3}
                aria-pressed={next === habitat.id} onClick={() => onSelect(habitat.id)}>
                <Icon size={28} aria-hidden="true" /><span><strong>{habitat.name}</strong>
                    <small>{!unlocked ? 'しまが ひろがると 育てられるよ' : level === 3 ? '大きく 育ったよ' : habitat.description}</small>
                    {expansion && <small className="island-growth-preview">育てきると、{expansion === 'east' ? 'ひがし' : 'にし'}へ しまが ひろがるよ</small>}
                    {unlocked && <GrowthSteps value={island.growth?.progress[habitat.id] ?? 0} />}</span>
                {next === habitat.id ? <Check size={20} aria-label="つぎに 育つ ばしょ" /> : level < 3 && unlocked ? <Sprout size={19} aria-hidden="true" /> : null}
            </button>;
        })}</div>
    </section>;
}

export function IslandDistricts({ island, value, disabled, onChange }: {
    island: Pick<IslandRecord, 'completedSets' | 'growth'>; value: IslandDistrict; disabled: boolean; onChange: (value: IslandDistrict) => void;
}) {
    const places: { id: IslandDistrict; label: string; level: number }[] = [
        { id: 'all', label: 'しまぜんぶ', level: 0 }, { id: 'home', label: 'にわ', level: 0 },
        { id: 'east', label: 'ひがし', level: 1 }, { id: 'west', label: 'にし', level: 2 },
    ];
    return <div className="island-districts" role="group" aria-label="ながめる ばしょ">{places.filter(place => place.level <= getIslandExpansionLevel(island)).map(place =>
        <button key={place.id} disabled={disabled} aria-pressed={place.id === value} onClick={() => onChange(place.id)}>{place.label}</button>)}</div>;
}
