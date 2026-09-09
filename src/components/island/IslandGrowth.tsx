import { IslandPanelHeading } from './IslandPanelHeading';
import { Check, Eye, Flower2, House, Map as MapIcon, Sprout, Trees, Waves } from 'lucide-react';
import { getIslandGrowthTarget, getIslandHabitatLevel, isIslandHabitatUnlocked, ISLAND_HABITATS } from '../../domain/island/growth';
import { getIslandExpansionLevel } from '../../domain/island/expansion';
import { islandGrowthStep } from '../../domain/island/pacing';
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
        <div><p>{complete ? 'みんなの いばしょが 育ったよ' : `いま 育てる ばしょ：${habitat.name}`}</p>
            {!complete && <GrowthSteps island={island} habitat={target} />}
            {expansion ? <small className="island-growth-preview" data-island-expansion-preview={expansion}>もうすぐ {expansion === 'east' ? 'ひがし' : 'にし'}へ しまが ひろがるよ</small>
                : !complete && next !== target && <small>つぎは {nextName}</small>}</div>
        {!complete && <button className="island-text-button" disabled={disabled} onClick={onChoose} aria-label="育てる ばしょを えらぶ">かえる</button>}
    </div>;
}

function GrowthSteps({ island, habitat }: { island: IslandRecord; habitat: IslandHabitatId }) {
    const { progress, value, remaining } = islandGrowthStep(island, habitat);
    return <span className="island-growth-steps" role="img" aria-label={`そだち ${progress} / 6${remaining ? `、つぎの めもりまで ${remaining}もん` : ''}`}>
        {Array.from({ length: 6 }, (_, index) => <i key={index} data-grown={index < progress} data-milestone={[0, 2, 5].includes(index)}>
            <b style={{ width: `${Math.max(0, Math.min(1, value - index)) * 100}%` }} /></i>)}
    </span>;
}

export function IslandGrowthChoices({ island, plan, disabled, onSelect, onClose, previewHabitat, onPreview }: {
    island: IslandRecord; plan?: IslandPlan; disabled: boolean; onSelect: (id: IslandHabitatId) => void; onClose: () => void;
    previewHabitat?: IslandHabitatId; onPreview?: (id: IslandHabitatId | undefined) => void;
}) {
    const next = getIslandGrowthTarget(island);
    const frozen = plan?.status === 'active' ? plan.growthTarget : undefined;
    const current = ISLAND_HABITATS.find(place => place.id === frozen);
    return <section className="island-sheet island-growth-choices" aria-label="育てる ばしょを えらぶ">
        <IslandPanelHeading title="育てる ばしょ" description="どこを 育てよう？" onExit={onClose} disabled={disabled} exitAriaLabel="ばしょえらびから もどる" />
        {current && <p className="island-note">いまの もんだいは {current.name}へ。えらぶと、つぎから 育つよ。</p>}
        <div className="island-growth-place-list">{ISLAND_HABITATS.map(habitat => {
            const unlocked = Boolean(island.growth) && isIslandHabitatUnlocked(island, habitat.id);
            const level = getIslandHabitatLevel(island, habitat.id);
            // A different place starts after the reserved place finishes. Its
            // final growth may already have opened this land, so do not promise it twice.
            const finishingAnother = frozen && frozen !== habitat.id && Boolean(islandExpansionPreview(island, plan));
            const expansion = (plan && !plan.growthTarget) || finishingAnother ? undefined : islandCompletionExpansion(island, habitat.id);
            const Icon = habitatIcons[habitat.id];
            return <div key={habitat.id} className="island-growth-preview-row"><button className="island-growth-place" disabled={disabled || !unlocked || level === 3}
                aria-pressed={next === habitat.id} onClick={() => onSelect(habitat.id)}>
                <Icon size={28} aria-hidden="true" /><span><strong>{habitat.name}</strong>
                    <small>{!unlocked ? 'しまが ひろがると 育てられるよ' : level === 3 ? '大きく 育ったよ' : habitat.description}</small>
                    {expansion && <small className="island-growth-preview">育てきると、{expansion === 'east' ? 'ひがし' : 'にし'}へ しまが ひろがるよ</small>}
                    {unlocked && <GrowthSteps island={island} habitat={habitat.id} />}</span>
                {next === habitat.id ? <Check size={20} aria-label="つぎに 育つ ばしょ" /> : level < 3 && unlocked ? <Sprout size={19} aria-hidden="true" /> : null}
            </button>{onPreview && unlocked && level < 3 && <button className="island-text-button island-growth-look" disabled={disabled}
                aria-pressed={previewHabitat === habitat.id} onClick={() => onPreview(previewHabitat === habitat.id ? undefined : habitat.id)}>
                <Eye size={17} />{previewHabitat === habitat.id ? 'いまの すがたへ' : 'つぎの すがたを みる'}</button>}</div>;
        })}</div>
    </section>;
}

export function IslandDistricts({ island, value, disabled, onChange }: {
    island: Pick<IslandRecord, 'completedSets' | 'growth'>; value: IslandDistrict; disabled: boolean; onChange: (value: IslandDistrict) => void;
}) {
    const level = getIslandExpansionLevel(island);
    const places = [
        { id: 'all' as const, label: 'しまぜんぶ', level: 0, Icon: MapIcon },
        { id: 'west' as const, label: 'にし', level: 2, Icon: Trees },
        { id: 'home' as const, label: 'にわ', level: 0, Icon: House },
        { id: 'east' as const, label: 'ひがし', level: 1, Icon: Waves },
    ];
    return <div className="island-districts" data-expanded={level > 0} role="group" aria-label="ながめる ばしょ">{places.filter(place => place.level <= level).map(({ id, label, Icon }) =>
        <button key={id} disabled={disabled} aria-pressed={id === value} onClick={() => onChange(id)}>
            {level > 0 && <Icon size={20} aria-hidden="true" />}<span>{label}</span>
        </button>)}</div>;
}
