import { DISCOVERIES, type DiscoveryGroup } from '../../../domain/growingIsland/discoveries';
import { SPECIES, type SpeciesId } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';

const SECTIONS: { name: string; groups: DiscoveryGroup[]; mark: string }[] = [
    { name: 'しまづくり', groups: ['build'], mark: '#e0a25a' },
    { name: 'くらし', groups: ['life'], mark: '#f19a9a' },
    { name: 'ふしぎ', groups: ['ground', 'luck', 'sky'], mark: '#7cc49a' },
    { name: 'まなび', groups: ['learn'], mark: '#95c6e8' },
    { name: 'こうかい', groups: ['voyage'], mark: '#b8a3dc' },
];

/**
 * しまの きろく (island-journey.md §5; spec 52 §1.4): what really happened on the child's
 * islands, in five kinds. Found ones say what happened; the rest show a hint. A species found
 * on a special island can be brought here, once per island.
 */
export function WonderBook({ state, onClose, onAdopt, busy }: { state: GrowingState; onClose: () => void; onAdopt?: (species: SpeciesId) => void; busy?: boolean }) {
    const found = new Set(state.discoveries ?? []), here = new Set(state.keepsakes.map(k => k.unitId));
    return <section className="growing-tray growing-wonder-book" aria-label="しまの きろく">
        <header><strong>しまの きろく {DISCOVERIES.filter(d => found.has(d.id)).length}/{DISCOVERIES.length}</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <p className="growing-flower-note">しまで ほんとうに あったことが のるよ。まだの ところは ヒントを みてね</p>
        {SECTIONS.map(section => {
            const entries = DISCOVERIES.filter(d => section.groups.includes(d.group));
            return <div key={section.name} className="growing-wonder-group">
                <h3>{section.name} <small>{entries.filter(d => found.has(d.id)).length}/{entries.length}</small></h3>
                <div className="growing-grid">{entries.map(d => {
                    const known = found.has(d.id), species = d.id.startsWith('species:') ? d.id.slice(8) as SpeciesId : undefined;
                    const bring = known && species && (SPECIES as readonly string[]).includes(species) && !here.has(d.id) && onAdopt;
                    return <div key={d.id} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined} data-discovery={d.id}>
                        <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: known ? section.mark : '#e8e2d6' }}>{known ? '★' : '?'}</span>
                        <strong>{known ? d.name : 'まだ'}</strong>
                        <small>{known ? d.line : d.hint}</small>
                        {bring && <button type="button" className="growing-action" disabled={busy} onClick={() => onAdopt(species!)}>この しまにも つれてくる</button>}
                    </div>;
                })}</div>
            </div>;
        })}
    </section>;
}
