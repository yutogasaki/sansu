import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import './IslandStarReceipt.css';

export function IslandStarReceipt({ receiptId, stars }: { receiptId: string; stars: number }) {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timeout = window.setTimeout(() => setVisible(false), 1400);
        return () => window.clearTimeout(timeout);
    }, []);
    if (!visible) return null;
    return <span className="island-star-receipt" role="status" aria-label={`ほしが ${stars}こ たまったよ`}
        data-star-receipt={receiptId}><Star size={18} aria-hidden="true" />+{stars}</span>;
}
