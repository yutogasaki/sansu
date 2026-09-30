import { FLOWER_COLORS, recipeFor } from '../../../domain/growingIsland';
import type { GrowingState } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';

/** はなずかん (§5.1): colours grown so far, and a hint for any colour whose parents are known. */
export function FlowerBook({ state, onClose }: { state: GrowingState; onClose: () => void }) {
    const book = new Set(state.flowerBook ?? []);
    return <section className="growing-tray" aria-label="はなずかん">
        <header><strong>はなずかん {book.size}/{FLOWER_COLORS.length}</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <p className="growing-flower-note">ちがう いろの はなを ちかくに おくと、あいだに あたらしい いろが さくかも</p>
        <div className="growing-grid">{FLOWER_COLORS.map(color => {
            const known = book.has(color);
            const hint = recipeFor(color).find(([a, b]) => book.has(a) && book.has(b));
            return <div key={color} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined}>
                <span className={`growing-flower-dot${color === 'wonder' && known ? ' growing-flower-dot--wonder' : ''}`} aria-hidden="true"
                    style={{ background: known ? FLOWER_PAINT[color] : '#e8e2d6' }}>{known ? '' : '?'}</span>
                <strong>{known ? FLOWER_NAME[color] : 'まだ'}</strong>
                {!known && hint && <small>{FLOWER_NAME[hint[0]]}と {FLOWER_NAME[hint[1]]}を ならべてみよう</small>}
            </div>;
        })}</div>
    </section>;
}
