import type { CatalogPictures } from './catalogPictures';
import { FLOWER_COLORS, recipeFor } from '../../../domain/growingIsland';
import type { GrowingState } from '../../../domain/growingIsland';
import { FLOWER_NAME, FLOWER_PAINT } from './flowerGeometry';

/** はなずかん (§5.1): colours grown so far, and a hint for any colour whose parents are known. */
export function FlowerBook({ state, onClose, pictures = {} }: { pictures?: CatalogPictures; state: GrowingState; onClose: () => void }) {
    const book = new Set(state.flowerBook ?? []);
    const entries = FLOWER_COLORS.map(color => ({ color, known: book.has(color), hint: recipeFor(color).find(([a, b]) => book.has(a) && book.has(b)) }));
    const compact = entries.filter(entry => !entry.known && !entry.hint);
    return <section className="growing-tray" aria-label="はなずかん">
        <header><strong>はなずかん {book.size}/{FLOWER_COLORS.length}</strong><button className="growing-close" onClick={onClose} aria-label="とじる">×</button></header>
        <p className="growing-flower-note">ちがう いろの はなを ちかくに おくと、あいだに あたらしい いろが さくかも</p>
        <div className="growing-grid">{entries.filter(entry => entry.known || entry.hint).sort((a, b) => Number(b.known) - Number(a.known)).map(({ color, known, hint }) => {
            return <div key={color} className="growing-card growing-flower-card" data-known={known ? 'true' : undefined}>
                {known && pictures[`flower:${color}`] ? <img className="growing-flower-picture" src={pictures[`flower:${color}`]} alt="" /> : <span className={`growing-flower-dot${color === 'wonder' && known ? ' growing-flower-dot--wonder' : ''}`} aria-hidden="true"
                    style={{ background: known ? FLOWER_PAINT[color] : '#e8e2d6' }}>{known ? '' : '?'}</span>}
                <strong>{known ? FLOWER_NAME[color] : 'まだ'}</strong>
                {!known && hint && <small>{FLOWER_NAME[hint[0]]}と {FLOWER_NAME[hint[1]]}を ならべてみよう</small>}
            </div>;
        })}</div>
        {compact.length > 0 && <section className="growing-flower-unknown" aria-label="これから みつける はな">
            <p>{entries.some(entry => !entry.known && entry.hint) ? 'ほかにも' : 'まだ みつけていない はな'} {compact.length}しゅるい</p>
            <ul>{compact.map(({ color }) => <li key={color} aria-label="まだ みつけていない はな"><span aria-hidden="true">?</span></li>)}</ul>
        </section>}
    </section>;
}
