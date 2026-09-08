import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { ISLAND_STARS_PER_SET } from '../../domain/island/customization';
import './IslandStarReceipt.css';

export function IslandStarReceipt({ receiptId }: { receiptId: string }) {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timeout = window.setTimeout(() => setVisible(false), 1400);
        return () => window.clearTimeout(timeout);
    }, []);
    if (!visible) return null;
    return <span className="island-star-receipt" role="status" aria-label={`ほしが ${ISLAND_STARS_PER_SET}こ たまったよ`}
        data-star-receipt={receiptId}><Star size={18} aria-hidden="true" />+{ISLAND_STARS_PER_SET}</span>;
}
