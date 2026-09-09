import { IslandPanelHeading } from './IslandPanelHeading';
import { useState } from 'react';
import { Bird, Bug, Check, Flower2, House, Lightbulb, Search, Trees, Waves } from 'lucide-react';
import { ISLAND_DISCOVERIES, ISLAND_HABITATS } from '../../domain/island/growth';
import type { IslandHabitatId, IslandRecord } from '../../domain/island/types';
import { firstIslandDiscovery, islandDiscoveryGuide } from './islandDiscoveryHints';
import './IslandDiscoveryGuide.css';

function DiscoveryPicture({ id }: { id: string }) {
    const Icon = id === 'leaf-bird' ? Bird : id.includes('butterfly') || id === 'pond-firefly' ? Bug
        : id.includes('lantern') ? Lightbulb : id === 'shade-rest' ? Trees : id === 'home-visit' || id === 'terrace-time' ? House
            : id.includes('water') || id === 'leaf-boat' || id === 'petal-ripple' ? Waves : Flower2;
    return <Icon aria-hidden="true" />;
}

export function IslandDiscoveryGuide({ island, disabled, closeDisabled = disabled, initialHabitat = 'garden', initialDiscoveryId, onTry, onPlace, onGrow, onClose }: {
    island: IslandRecord; disabled: boolean; closeDisabled?: boolean; initialHabitat?: IslandHabitatId; initialDiscoveryId?: string;
    onTry: (itemId: string, discoveryId: string) => void; onPlace: (itemId: string, discoveryId: string) => void;
    onGrow: (habitatId: IslandHabitatId) => void; onClose: () => void;
}) {
    const [habitat, setHabitat] = useState(initialHabitat);
    const [selectedId, setSelectedId] = useState(initialDiscoveryId ?? firstIslandDiscovery(island, initialHabitat));
    const [hintId, setHintId] = useState<string>();
    const selected = islandDiscoveryGuide(island, selectedId ?? '');
    const entries = ISLAND_DISCOVERIES.filter(entry => entry.habitatId === habitat);
    return <section className="island-sheet island-field-guide" aria-label="しまの みつけもの">
        <IslandPanelHeading title="みつける" description="さわって、ためして、みつけよう" onExit={onClose} disabled={closeDisabled} exitAriaLabel="みつけものから もどる" />
        <div className="island-guide-tabs" role="group" aria-label="みつける ばしょ">{ISLAND_HABITATS.map(place => <button key={place.id} aria-pressed={habitat === place.id}
            onClick={() => { setHabitat(place.id); setSelectedId(firstIslandDiscovery(island, place.id)); setHintId(undefined); }}>{place.name}</button>)}</div>
        {selected && <article className="island-guide-feature" data-guide-id={selected.entry.id} data-guide-status={selected.status} data-observed={Boolean(selected.seen)}>
            <div className="island-guide-picture" data-mystery={!selected.seen}><DiscoveryPicture id={selected.entry.id} /></div>
            <div className="island-guide-story"><p className="island-eyebrow">{selected.seen ? 'みつけた！' : 'どんなことが おきるかな'}</p>
                <h3>{selected.seen ? selected.entry.name : selected.hint.question}</h3>
                {selected.seen && <p>{selected.entry.description}</p>}
                {selected.status === 'grow' ? <p>{selected.unlocked ? 'この ばしょが 育つと、ためせるよ。' : 'しまが ひろがると、この ばしょを 育てられるよ。'}</p>
                    : selected.status === 'place' ? <p>しまに おくと、ためせるよ。</p>
                        : selected.status === 'arrange' ? <p>{selected.hint.setting}</p>
                            : selected.status === 'visit' ? <p>ときどき やってくるよ。また ながめてみよう。</p> : null}
            </div>
            <div className="island-guide-actions">
                <button className="island-text-button" aria-expanded={hintId === selected.entry.id} onClick={() => setHintId(hintId === selected.entry.id ? undefined : selected.entry.id)}>てがかり</button>
                {selected.status === 'grow' ? <button className="island-primary" disabled={disabled} onClick={() => onGrow(selected.habitatId)}>{selected.unlocked ? '育つ すがたを みる' : '育てる ばしょを みる'}</button>
                    : selected.status === 'visit' ? <button className="island-secondary" disabled={disabled} onClick={onClose}>しまを ながめる</button>
                        : <button className="island-primary" disabled={disabled || !selected.item} onClick={() => {
                            if (!selected.item) return;
                            if (selected.status === 'place' || selected.status === 'arrange') onPlace(selected.item.id, selected.entry.id);
                            else onTry(selected.item.id, selected.entry.id);
                        }}>{selected.status === 'place' ? 'しまに おく' : selected.status === 'arrange' ? 'おきかたを ためす' : selected.seen ? 'もういちど ためす' : 'みにいく'}</button>}
            </div>
            {hintId === selected.entry.id && <p className="island-guide-hint" role="status">{selected.hint.hint}</p>}
        </article>}
        <div className="island-guide-index" role="group" aria-label="みつけものを えらぶ">{entries.map(entry => {
            const seen = island.growth?.discoveries.some(discovery => discovery.id === entry.id);
            return <button key={entry.id} data-discovery-id={entry.id} aria-pressed={entry.id === selectedId} onClick={() => { setSelectedId(entry.id); setHintId(undefined); }}>
                <DiscoveryPicture id={entry.id} /><span>{seen ? entry.name : 'まだ みていない くらし'}</span>{seen ? <Check size={15} aria-label="みつけた" /> : <Search size={15} aria-label="これから みつける" />}
            </button>;
        })}</div>
    </section>;
}
