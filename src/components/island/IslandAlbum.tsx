import { useState } from 'react';
import { BookOpen, Flower2, RotateCcw, X } from 'lucide-react';
import { ISLAND_DISCOVERIES, ISLAND_HABITATS, isIslandHabitatUnlocked } from '../../domain/island/growth';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';
import { DEFAULT_ISLAND_COSMETICS, getIslandCosmetics } from '../../domain/island/customization';
import IslandStage from './IslandStage';
import { islandAlbumMemories, islandAlbumMemoryTitle, islandComparisonMemory } from './islandAlbumMemory';
import './IslandGrowth.css';

const comparisonNames: Record<IslandHabitatId | 'all', string> = {
    garden: 'にわ', waterside: 'みずべ', grove: '木かげ', village: 'いえ', all: 'しまぜんぶ',
};

/** Both panes use the production renderer. The old scene receives only its
 * immutable memory, never current progress or editable callbacks. */
export function IslandAlbum({ island, disabled, closeDisabled = disabled, onTry, onPlace, onClose, initialComparison = 'garden' }: {
    island: IslandRecord; disabled: boolean; onTry: (itemId: string, discoveryId: string) => void;
    onPlace: (itemId: string) => void; onClose: () => void;
    closeDisabled?: boolean;
    initialComparison?: IslandHabitatId | 'all';
}) {
    const [tab, setTab] = useState<'memories' | 'discoveries'>('memories');
    const [comparison, setComparison] = useState<IslandHabitatId | 'all'>(initialComparison);
    const [memoryId, setMemoryId] = useState(islandComparisonMemory(island.growth?.memories ?? [], initialComparison)?.id);
    const memories = island.growth?.memories ?? [];
    const timeline = islandAlbumMemories(memories, comparison);
    const memory = timeline.find(candidate => candidate.id === memoryId) ?? timeline[0];
    const discoveries = island.growth?.discoveries ?? [];
    const placeName = comparison === 'all' ? 'しま' : comparisonNames[comparison];
    const compare = (habitat: IslandHabitatId | 'all') => {
        setComparison(habitat);
        setMemoryId(islandComparisonMemory(memories, habitat)?.id);
    };
    return <section className="island-sheet island-album" aria-label="しまの アルバム"
        data-island-revision={island.revision} data-discovery-count={discoveries.length}>
        <div className="island-sheet-title"><h2>しまの アルバム</h2><button className="island-icon-button" disabled={closeDisabled} aria-label="アルバムを とじる" onClick={onClose}><X size={20} /></button></div>
        <div className="island-album-tabs" role="group" aria-label="アルバムの なかみ">
            <button className="island-secondary" aria-pressed={tab === 'memories'} onClick={() => setTab('memories')}><BookOpen size={18} />そだちの きろく</button>
            <button className="island-secondary" aria-pressed={tab === 'discoveries'} onClick={() => setTab('discoveries')}><Flower2 size={18} />みつけた くらし</button>
        </div>
        {tab === 'memories' ? memory ? <>
            <div className="island-album-habitats" role="group" aria-label="みくらべる ばしょ">
                {ISLAND_HABITATS.map(habitat => <button key={habitat.id} aria-pressed={comparison === habitat.id}
                    disabled={!isIslandHabitatUnlocked(island, habitat.id)} onClick={() => compare(habitat.id)}>{comparisonNames[habitat.id]}</button>)}
                <button aria-pressed={comparison === 'all'} onClick={() => compare('all')}>{comparisonNames.all}</button>
            </div>
            <div className="island-album-timeline" role="group" aria-label="むかしの しまを えらぶ">{timeline.map(entry =>
                <button key={entry.id} aria-pressed={entry.id === memory.id} onClick={() => setMemoryId(entry.id)}>
                    {islandAlbumMemoryTitle(memories, entry, comparison)}
                </button>)}</div>
            <div className="island-album-compare" data-comparison-habitat={comparison}>
                <article className="island-album-scene" data-memory-id={memory.id} data-memory-completed-sets={memory.completedSets}>
                    <h3>あのころの {placeName}</h3>
                    <IslandStage key={memory.id} items={memory.items} completedSets={memory.completedSets} pulse={0} learning={false} readOnly
                        cosmetics={memory.cosmetics ?? DEFAULT_ISLAND_COSMETICS}
                        growth={{ version: 1, progress: memory.progress, expansionLevel: memory.expansionLevel, focus: memory.focus, memories: [], discoveries: [] }} districtFocus="all" comparisonHabitat={comparison} />
                    <p>{new Date(memory.capturedAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}・{islandAlbumMemoryTitle(memories, memory, comparison)}</p>
                </article>
                <article className="island-album-scene" data-memory-current="true"><h3>いまの {placeName}</h3>
                    <IslandStage items={island.items} completedSets={island.completedSets} pulse={0} learning={false} readOnly growth={island.growth} cosmetics={getIslandCosmetics(island)} districtFocus="all" comparisonHabitat={comparison} />
                    <p>{island.completedSets}回 ひかりを とどけた しま</p>
                </article>
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
    </section>;
}
