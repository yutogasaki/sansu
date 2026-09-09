import { IslandPanelHeading } from './IslandPanelHeading';
import { useState } from 'react';
import { BookOpen, Camera, Flower2, Heart, RotateCcw, Waves } from 'lucide-react';
import { ISLAND_DISCOVERIES, ISLAND_HABITATS, isIslandHabitatUnlocked } from '../../domain/island/growth';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';
import { DEFAULT_ISLAND_COSMETICS, getIslandCosmetics } from '../../domain/island/customization';
import IslandStage from './IslandStage';
import { islandAlbumMemories, islandAlbumMemoryTitle, islandComparisonMemory } from './islandAlbumMemory';
import { getIslandWorkshop, getWorkshopSpecimenName, WORKSHOP_SPECIMEN_IDS, type WorkshopSpecimenId } from '../../domain/island/workshop';
import { SHARED_DISPLAY_IDS } from '../../domain/island/sharedMemories';
import { getIslandExpression } from '../../domain/island/expression';
import { islandAlbumMemoryStyle } from './islandAlbumPresentation';
import './IslandGrowth.css';
import './IslandPanel.css';
import './IslandWorkspacePanels.css';

const comparisonNames: Record<IslandHabitatId | 'all', string> = {
    garden: 'にわ', waterside: 'みずべ', grove: '木かげ', village: 'いえ', all: 'しまぜんぶ',
};

/** Both panes use the production renderer. The old scene receives only its
 * immutable memory, never current progress or editable callbacks. */
export function IslandAlbum({ island, disabled, closeDisabled = disabled, onTry, onPlace, onClose, onPhotos, onWorkshop, onShared, initialComparison = 'garden' }: {
    island: IslandRecord; disabled: boolean; onTry: (itemId: string, discoveryId: string) => void;
    onPlace: (itemId: string) => void; onClose: () => void;
    closeDisabled?: boolean;
    initialComparison?: IslandHabitatId | 'all';
    onPhotos?: () => void;
    onWorkshop?: (id?: WorkshopSpecimenId) => void;
    onShared?: () => void;
}) {
    const [tab, setTab] = useState<'memories' | 'discoveries' | 'workshop'>('memories');
    const [comparison, setComparison] = useState<IslandHabitatId | 'all'>(initialComparison);
    const [memoryId, setMemoryId] = useState(islandComparisonMemory(island.growth?.memories ?? [], initialComparison)?.id);
    const memories = island.growth?.memories ?? [];
    const timeline = islandAlbumMemories(memories, comparison);
    const memory = timeline.find(candidate => candidate.id === memoryId) ?? timeline[0];
    const discoveries = island.growth?.discoveries ?? [];
    const workshop = getIslandWorkshop(island);
    const observationNames = { clean: 'すなが とれた', float: 'みずに ういた', sink: 'しずんだ', transmit: 'ひかりを とおした', opaque: 'かげが できた' };
    const workshopRecords = [
        ...WORKSHOP_SPECIMEN_IDS.flatMap(specimenId => {
            const specimen = workshop.specimens[specimenId], name = getWorkshopSpecimenName(workshop, specimenId);
            return [...specimen.observations.map(entry => ({ ...entry, name, description: observationNames[entry.result], specimenId })),
                ...(specimen.identity ? [{ ...specimen.identity, name, description: 'しょうたいを みつけた', specimenId }] : [])];
        }),
        ...workshop.creations.map(entry => ({ ...entry, name: entry.partId === 'wheel' ? 'みずで まわった' : 'おとが ひびいた', description: 'じぶんで つないだ しくみ', specimenId: undefined })),
    ].sort((a, b) => a.observedAt - b.observedAt || a.order - b.order || a.id.localeCompare(b.id));
    const placeName = comparison === 'all' ? 'しま' : comparisonNames[comparison];
    const compare = (habitat: IslandHabitatId | 'all') => {
        setComparison(habitat);
        setMemoryId(islandComparisonMemory(memories, habitat)?.id);
    };
    return <section className="island-sheet island-panel island-album" aria-label="しまの アルバム"
        data-island-revision={island.revision} data-discovery-count={discoveries.length}>
        <IslandPanelHeading title="しまの アルバム" onExit={onClose} disabled={closeDisabled} exitAriaLabel="アルバムから もどる" />
        <label className="island-album-category"><BookOpen size={20} aria-hidden="true" />
            <select aria-label="アルバムの なかみ" value={tab} onChange={event => setTab(event.target.value as typeof tab)}>
                <option value="memories">そだちの きろく</option>
                <option value="discoveries">みつけた くらし</option>
                {island.completedSets >= 1 && onWorkshop && <option value="workshop">いりえの はっけん</option>}
            </select>
        </label>
        {tab === 'workshop' ? <div className="island-discovery-list">
            {WORKSHOP_SPECIMEN_IDS.map(id => <article className="island-discovery" key={id}><Waves size={24} aria-hidden="true" /><div><h3>{getWorkshopSpecimenName(workshop, id)}</h3>
                <p>{SHARED_DISPLAY_IDS.some(slot => island.sharedMemories?.displays[slot]?.target.targetKey === workshop.specimens[id].id) ? 'しまにも かざっているよ' : 'いりえで みつけた もの'}</p></div>
                <button className="island-secondary" disabled={closeDisabled} onClick={() => onWorkshop?.(id)}>この ものを ためす</button></article>)}
            {workshopRecords.map(entry => <article className="island-discovery" key={entry.id} data-workshop-record-id={entry.id}><BookOpen size={24} aria-hidden="true" />
                <div><h3>{entry.name}</h3><p>{entry.description}</p><small>{new Date(entry.observedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</small></div>
                <button className="island-secondary" disabled={closeDisabled} onClick={() => onWorkshop?.(entry.specimenId)}>{entry.specimenId ? 'もういちど ためす' : 'つくる ばしょへ'}</button></article>)}
        </div> : tab === 'memories' ? memory ? <>
            <div className="island-album-compare" data-comparison-habitat={comparison}>
                <article className="island-album-scene" data-memory-id={memory.id} data-memory-completed-sets={memory.completedSets}>
                    <h3>あのころの {placeName}</h3>
                    <IslandStage key={memory.id} items={memory.items} completedSets={memory.completedSets} pulse={0} learning={false} readOnly
                        {...islandAlbumMemoryStyle(memory)}
                        cosmetics={memory.cosmetics ?? DEFAULT_ISLAND_COSMETICS}
                        growth={{ version: 1, progress: memory.progress, expansionLevel: memory.expansionLevel, focus: memory.focus, memories: [], discoveries: [] }} districtFocus="all" comparisonHabitat={comparison} />
                    <p>{new Date(memory.capturedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}・{islandAlbumMemoryTitle(memories, memory, comparison)}</p>
                </article>
                <article className="island-album-scene" data-memory-current="true"><h3>いまの {placeName}</h3>
                    <IslandStage items={island.items} completedSets={island.completedSets} pulse={0} learning={false} readOnly growth={island.growth} cosmetics={getIslandCosmetics(island)} districtFocus="all" comparisonHabitat={comparison}
                        experience={island.experience} expressionSelection={getIslandExpression(island).selection}
                        shared={{ island, active: false }} />
                    <p>{island.completedSets}回 ひかりを とどけた しま</p>
                </article>
            </div>
            <div className="island-album-selection">
                <label className="island-album-habitats"><span>ばしょ</span>
                    <select aria-label="みくらべる ばしょ" value={comparison} onChange={event => compare(event.target.value as IslandHabitatId | 'all')}>
                        {ISLAND_HABITATS.map(habitat => <option key={habitat.id} value={habitat.id}
                            disabled={!isIslandHabitatUnlocked(island, habitat.id)}>{comparisonNames[habitat.id]}</option>)}
                        <option value="all">{comparisonNames.all}</option>
                    </select>
                </label>
                <label className="island-album-timeline"><span>あのころ</span>
                    <select aria-label="むかしの しまを えらぶ" value={memory.id} onChange={event => setMemoryId(event.target.value)}>
                        {timeline.map(entry => <option key={entry.id} value={entry.id}>{islandAlbumMemoryTitle(memories, entry, comparison)}</option>)}
                    </select>
                </label>
            </div>
        </> : <p className="island-album-empty">しまが 育つと、ここで みくらべられるよ。</p>
            : discoveries.length ? <div className="island-discovery-list">{discoveries.map(discovery => {
                const entry = ISLAND_DISCOVERIES.find(candidate => candidate.id === discovery.id);
                if (!entry) return null;
                const item = island.items.find(candidate => candidate.id === discovery.itemId);
                return <article key={discovery.id} className="island-discovery" data-discovery-id={discovery.id}>
                    <Flower2 size={25} aria-hidden="true" /><div><h3>{entry.name}</h3><p>{entry.description}</p>
                        {!item?.position && <p>しまに おくと、また あそべるよ。</p>}</div>
                    <button className="island-secondary" disabled={disabled || !item} onClick={() => item?.position ? onTry(item.id, discovery.id) : item && onPlace(item.id)}>
                        <RotateCcw size={15} aria-hidden="true" />{item?.position ? 'ためす' : 'おく'}</button>
                </article>;
            })}</div> : <div className="island-album-empty"><Flower2 size={36} /><p>どうぶつたちは なにを しているかな。<br />しまを ながめたり、いっしょに あそんで みよう。</p>
                <button className="island-secondary" disabled={closeDisabled} onClick={onClose}>しまを みる</button></div>}
        {(onPhotos || island.completedSets >= 1 && onShared) && <div className="island-album-related" role="group" aria-label="ほかの おもいで">
            {onPhotos && <button className="island-secondary" disabled={closeDisabled} onClick={onPhotos}><Camera size={18} />しゃしん</button>}
            {island.completedSets >= 1 && onShared && <button className="island-secondary" disabled={closeDisabled} onClick={onShared}><Heart size={18} />かざりと きおく</button>}
        </div>}
    </section>;
}
