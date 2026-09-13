import { expandedLand, landBounds, landQuote } from '../../../domain/islandLife/landRules';
import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Droplets } from 'lucide-react';
import { type LandSide, type LifeCommand, type LifeState } from '../../../domain/islandLife/model';
import { isHouse, landCells } from '../../../domain/islandLife/space';

/** A top-down map of the actual cell layout; dotted land is an unsaved proposal. */
export default function LifeLand({ state, locked, onAction }: {
    state: LifeState; locked: boolean; onAction: (command: LifeCommand, message: string) => Promise<void>;
}) {
    const [side, setSide] = useState<LandSide>('east');
    const quote = landQuote(state);
    const chosen = quote?.sides.includes(side) ? side : quote?.sides[0];
    const preview = chosen ? expandedLand(state, chosen) : state;
    const cells = landCells(preview), owned = new Set(landCells(state).map(c => `${c.x},${c.z}`));
    const { minX: min, maxX: max, depth } = landBounds(preview);
    const mapWidth = (max - min + 1) * 29 + 40, mapHeight = depth * 27 + 24;
    const missing = (quote?.price ?? 0) - state.drops;
    const directionName = (direction: LandSide) => direction === 'west' ? 'ひだり' : direction === 'east' ? 'みぎ' : 'てまえ';
    return <div className="life-land-preview">
        <div className="life-section-intro"><b>{!quote ? 'ひろがった しま' : quote.sides.length > 1 ? 'どちらを ひろげる？' : 'ここを ひろげよう'}</b><span>うえから みた しま</span></div>
        <svg className="life-land-map" viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="img" aria-label={chosen ? `${directionName(chosen)}の3${chosen === 'south' ? '行' : '列'}を ひろげる よこく。家と いま おいてある もの。` : 'ひろがった しま。家と いま おいてある もの。'}>
            <rect x="0" y="0" width={mapWidth} height={mapHeight} rx="18" className="life-map-sea" />
            {cells.map(c => {
                const added = !owned.has(`${c.x},${c.z}`);
                const x = 20 + (c.x - min) * 29, y = 12 + c.z * 27;
                const placed = state.items.find(item => item.cell?.x === c.x && item.cell.z === c.z);
                return <g key={`${c.x},${c.z}`} data-life-map-cell={`${c.x},${c.z}`} data-proposed={added}>
                    <rect x={x} y={y} width="28" height="26" rx="5" className={added ? 'life-map-proposed' : 'life-map-ground'} />
                    {added && <path d={`M${x + 10} ${y + 13}h8m-4 -4v8`} className="life-map-plus" />}
                    {isHouse(c) && <rect x={x + 5} y={y + 4} width="18" height="18" rx="3" className="life-map-house" />}
                    {c.x === 2 && c.z === 0 && <path d={`M${x + 3} ${y + 10}l11 -8 11 8`} className="life-map-roof" />}
                    {placed && <g transform={`translate(${x + 14} ${y + 13})`} className={`life-map-item life-map-item--${placed.kind}`}>
                        {placed.kind === 'picnic-table' ? <><path d="M-8 -3H8V1H-8ZM-5 1V8M5 1V8M-9 5H9" /></> : placed.kind === 'sapling' ? <><path d="M0 8V-5" /><ellipse cy="-3" rx="7" ry="5" /></> : placed.kind === 'water-bowl' ? <><path d="M-8 0Q-6 9 0 9Q6 9 8 0" /><ellipse rx="8" ry="3" /></> : placed.kind === 'flower' ? <><path d="M0 7V-4M-5 3L0 5 5 1" /><circle cy="-4" r="4" /></> : placed.kind === 'bench' ? <><path d="M-8 -5H8V3H-8ZM-6 3V8M6 3V8" /></> : placed.kind === 'swing' ? <><path d="M-9 8L-5 -8H5L9 8M-4 -6V4H4V-6" /></> : <><path d="M0 8V-3" /><circle cy="-5" r="4" /></>}
                    </g>}
                </g>;
            })}
        </svg>
        {!quote ? <p className="life-map-legend"><Check size={16} />すきな ばしょを つくろう。</p> : <>
            <p className="life-map-legend"><span className="life-map-legend-sample" />てんせんの ところが ふえるよ。</p>
            <div className="life-land-directions" role="group" aria-label="ひろげる むき">
                {(quote.sides).map(direction => <button key={direction} disabled={locked} aria-pressed={chosen === direction} onClick={() => setSide(direction)}>
                    {direction === 'west' ? <ArrowLeft size={18} /> : direction === 'east' ? <ArrowRight size={18} /> : <ArrowDown size={18} />}{directionName(direction)}へ{chosen === direction && <Check size={16} />}
                </button>)}
            </div>
            <button className="life-land-confirm island-primary" disabled={locked || missing > 0} onClick={() => chosen && void onAction({ type: 'expand', side: chosen }, 'しまが ひろがったよ！')}>
                <span>ここを ひろげる</span><span><Droplets size={16} />{missing > 0 ? `あと ${missing}` : quote.price} しずく</span>
            </button>
        </>}
    </div>;
}
