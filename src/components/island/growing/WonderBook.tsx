import { DISCOVERIES, type DiscoveryGroup } from '../../../domain/growingIsland/discoveries';
import type { GrowingState } from '../../../domain/growingIsland';

const GROUPS: { id: DiscoveryGroup; name: string; mark: string }[] = [
    { id: 'ground', name: 'じめんと みず', mark: '#7cc49a' }, { id: 'luck', name: 'ラッキー', mark: '#ffd23f' }, { id: 'sky', name: 'そらと おきゃく', mark: '#95c6e8' },
];

/**
 * ふしぎずかん (§1.4): what this island has shown so far. Found ones say what happened;
 * the rest show only a hint of the arrangement that might bring them. Nothing expires.
 */
export function WonderBook({ state, onClose }: { state: GrowingState; onClose: () => void }) {
    const found = new Set(state.discoveries ?? []);
    return <section className="growing-tray growing-wonder-book" aria-label="ふしぎずかん">
        <header><strong>ふしぎずかん {DISCOVERIES.filter(d => found.has(d.id)).length}/{DISCOVERIES.length}</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <p className="growing-flower-note">じめん・みず・木・あかりの ならべかたで、しまに ふしぎが おきるよ</p>
        {GROUPS.map(group => <div key={group.id} className="growing-wonder-group">
            <h3>{group.name}</h3>
            <div className="growing-grid">{DISCOVERIES.filter(d => d.group === group.id).map(d => {
                const known = found.has(d.id);
                return <div key={d.id} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined} data-discovery={d.id}>
                    <span className="growing-flower-dot growing-wonder-dot" aria-hidden="true" style={{ background: known ? group.mark : '#e8e2d6' }}>{known ? '★' : '?'}</span>
                    <strong>{known ? d.name : 'まだ'}</strong>
                    <small>{known ? d.line : d.hint}</small>
                </div>;
            })}</div>
        </div>)}
    </section>;
}
