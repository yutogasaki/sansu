import { ArrowRight, Flower2, House, Trees, Waves } from 'lucide-react';
import { ISLAND_MATURITY_TITLES } from '../../domain/island/growth';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';
import './IslandMilestone.css';

export interface IslandMilestone {
    id: string;
    habitats: IslandHabitatId[];
    expansion?: 'east' | 'west';
}

const icons = { garden: Flower2, waterside: Waves, grove: Trees, village: House };

/** Earned progress may be hidden by a deliberate old appearance or storage.
 * Keep that choice, and describe the earned upgrade without inventing a visible change. */
export function islandMilestoneLines(milestone: IslandMilestone, island: IslandRecord) {
    const lines = milestone.habitats.map(habitat => {
        const items = island.items.filter(item => item.habitatId === habitat);
        const fixedSceneryAppearance = items.find(item => item.appearanceLevel !== undefined)?.appearanceLevel;
        const carriers = items.filter(item => habitat === 'garden' ? item.kind === 'flower' : item.kind === 'fountain' || item.kind === 'swing');
        const hidden = habitat === 'grove' || habitat === 'village'
            ? fixedSceneryAppearance !== undefined && fixedSceneryAppearance < 3
            : !carriers.some(item => item.position && (item.appearanceLevel === undefined || item.appearanceLevel >= 3));
        return hidden ? ({ garden: 'おはなの 新しいすがたが 育ったよ', waterside: 'みずべの 新しいすがたが 育ったよ',
            grove: '木かげの 新しいすがたが 育ったよ', village: 'おうちの 新しいすがたが 育ったよ' })[habitat]
            : ISLAND_MATURITY_TITLES[habitat];
    });
    if (milestone.expansion) lines.push(milestone.expansion === 'east' ? 'ひがしへ はしが つながったよ' : 'にしへ はしが つながったよ');
    return lines;
}

export function IslandMilestoneNotice({ milestone, island }: { milestone: IslandMilestone; island: IslandRecord }) {
    const habitat = milestone.habitats[0] ?? 'grove';
    const subject = milestone.expansion ? milestone.expansion === 'east' ? 'ひがしへ' : 'にしへ'
        : { garden: 'おはなの', waterside: 'みずべの', grove: '木かげの', village: 'おうちの' }[habitat];
    const detail = milestone.expansion ? 'ひろがったよ' : '新しいすがた';
    const description = [...(milestone.expansion ? ['しまが 大きく ひろがったよ'] : []), ...islandMilestoneLines(milestone, island)].join('。');
    return <div className="island-growth-milestone" role="status" aria-atomic="true" aria-label={description}
        data-growth-milestone={milestone.id} data-milestone-presentation="learning-header-v1">
        <strong>{subject}</strong><span>{detail}</span>
    </div>;
}

export function IslandMilestoneReturn({ milestone, island, disabled, onCompare }: {
    milestone: IslandMilestone; island: IslandRecord; disabled: boolean; onCompare: () => void;
}) {
    const Icon = icons[milestone.habitats[0] ?? 'grove'];
    return <button className="island-growth-return" disabled={disabled} onClick={onCompare}>
        <Icon size={26} aria-hidden="true" /><span>
            {milestone.expansion && <strong className="island-growth-upgrade-title">しまが 大きく ひろがったよ</strong>}
            {islandMilestoneLines(milestone, island).map(line => <strong key={line}>{line}</strong>)}
            <small>あのころと みくらべる</small>
        </span><ArrowRight size={19} aria-hidden="true" />
    </button>;
}
