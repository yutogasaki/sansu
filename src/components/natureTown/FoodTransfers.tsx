import { useId, type CSSProperties } from 'react';
import type { DomainEvent } from '../../domain/natureTown/types';
export function FoodTransfers({ events, size, maxY, width }: { events: DomainEvent[]; size: number; maxY: number; width: number }) {
    const arrow = useId();
    return <svg className="town-food-transfers" width={width} height={maxY * size} aria-hidden="true">
        <defs><marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#314e42"/></marker></defs>
        {events.filter(e => e.type === 'FoodTransferred' && e.transfer).map(e => {
            const t = e.transfer!, x1 = (t.from[0] + .5) * size, y1 = (maxY - t.from[1] - .5) * size;
            const x2 = (t.to[0] + .5) * size, y2 = (maxY - t.to[1] - .5) * size;
            return <g key={e.id} data-transfer-id={e.id} data-from={t.fromId} data-to={t.toId} data-quantity={e.quantity}>
                <path d={`M${x1},${y1} L${x2},${y2}`} stroke="#fff9df" strokeWidth="7"/>
                <path d={`M${x1},${y1} L${x2},${y2}`} stroke="#314e42" strokeWidth="2" strokeDasharray="3 3" markerEnd={`url(#${arrow})`}/>
                <g className="town-transfer-fruit" style={{ '--from-x': `${x1}px`, '--from-y': `${y1}px`, '--to-x': `${(x1+x2)/2}px`, '--to-y': `${(y1+y2)/2}px` } as CSSProperties}>
                    <circle r="9" fill="#fff9df" stroke="#314e42"/>
                    <path d="M-5,-1 C-7,-7 0,-7 0,-4 C2,-8 8,-5 5,1 C2,6 -3,5 -5,-1" fill="#d77b40"/>
                    <path d="M0,-5 Q0,-10 5,-9" stroke="#477554" fill="none" strokeWidth="2"/>
                    <text x="9" y="4" fontSize="11" fontWeight="700" fill="#243747" stroke="#fff9df" strokeWidth="3" paintOrder="stroke">{e.quantity}</text>
                </g>
            </g>;
        })}
    </svg>;
}
