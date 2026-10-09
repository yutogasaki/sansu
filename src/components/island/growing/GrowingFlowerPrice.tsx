import { LANDMARK_PRICE } from '../../../domain/growingIsland/rules';

/** A real, current price preview; it never promises when the flower will be affordable. */
export function GrowingFlowerPrice({ drops }: { drops: number }) {
    return <div className="growing-guide-flower-price">
        <span className="growing-guide-flower-symbol" aria-hidden="true">🌱</span>
        <span>はなの なえ</span>
        <strong>いま 💧{drops} ／ なえ 💧{LANDMARK_PRICE.flower}</strong>
    </div>;
}
