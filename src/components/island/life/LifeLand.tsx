import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Droplets } from 'lucide-react';
import { LIFE_RULES, type LifeCommand, type LifeState } from '../../../domain/islandLife/model';
import { isHouse, landCells } from '../../../domain/islandLife/space';

/** A top-down map of the actual cell layout; dotted land is an unsaved proposal. */
export default function LifeLand({ state, locked, onAction }: {
    state: LifeState; locked: boolean; onAction: (command: LifeCommand, message: string) => Promise<void>;
}) {
    const [side, setSide] = useState<'west' | 'east'>('east');
    const displayed = state.expanded ?? side;
    const cells = landCells({ expanded: displayed });
    const min = displayed === 'west' ? -3 : 0;
    const missing = LIFE_RULES.expansionPrice - state.drops;
    return <div className="life-land-preview">
        <div className="life-section-intro"><b>{state.expanded ? 'ひろがった しま' : 'どちらを ひろげる？'}</b><span>うえから みた しま</span></div>
        <svg className="life-land-map" viewBox="0 0 300 162" role="img" aria-label={`${displayed === 'west' ? 'ひだり' : 'みぎ'}の3列${state.expanded ? 'が ひろがった しま' : 'を ひろげる よこく'}。家と いま おいてある もの。`}>
            <rect x="0" y="0" width="300" height="162" rx="18" className="life-map-sea" />
            {cells.map(c => {
                const added = c.x < 0 || c.x > 5;
                const x = 20 + (c.x - min) * 29, y = 12 + c.z * 27;
                const placed = state.items.find(item => item.cell?.x === c.x && item.cell.z === c.z);
                return <g key={`${c.x},${c.z}`} data-life-map-cell={`${c.x},${c.z}`} data-proposed={added && !state.expanded}>
                    <rect x={x} y={y} width="28" height="26" rx="5" className={added && !state.expanded ? 'life-map-proposed' : 'life-map-ground'} />
                    {added && !state.expanded && <path d={`M${x + 10} ${y + 13}h8m-4 -4v8`} className="life-map-plus" />}
                    {isHouse(c) && <rect x={x + 5} y={y + 4} width="18" height="18" rx="3" className="life-map-house" />}
                    {c.x === 2 && c.z === 0 && <path d={`M${x + 3} ${y + 10}l11 -8 11 8`} className="life-map-roof" />}
                    {placed && <g transform={`translate(${x + 14} ${y + 13})`} className={`life-map-item life-map-item--${placed.kind}`}>
                        {placed.kind === 'flower' ? <><path d="M0 7V-4M-5 3L0 5 5 1" /><circle cy="-4" r="4" /></> : placed.kind === 'bench' ? <><path d="M-8 -5H8V3H-8ZM-6 3V8M6 3V8" /></> : placed.kind === 'swing' ? <><path d="M-9 8L-5 -8H5L9 8M-4 -6V4H4V-6" /></> : <><path d="M0 8V-3" /><circle cy="-5" r="4" /></>}
                    </g>}
                </g>;
            })}
        </svg>
        {state.expanded ? <p className="life-map-legend"><Check size={16} />すきな ばしょを つくろう。</p> : <>
            <p className="life-map-legend"><span className="life-map-legend-sample" />てんせんの ところが ふえるよ。</p>
            <div className="life-land-directions" role="group" aria-label="ひろげる むき">
                {(['west', 'east'] as const).map(direction => <button key={direction} disabled={locked} aria-pressed={side === direction} onClick={() => setSide(direction)}>
                    {direction === 'west' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}{direction === 'west' ? 'ひだり' : 'みぎ'}へ{side === direction && <Check size={16} />}
                </button>)}
            </div>
            <button className="life-land-confirm island-primary" disabled={locked || missing > 0} onClick={() => void onAction({ type: 'expand', side }, 'しまが ひろがったよ！')}>
                <span>ここを ひろげる</span><span><Droplets size={16} />{missing > 0 ? `あと ${missing}` : LIFE_RULES.expansionPrice} しずく</span>
            </button>
        </>}
    </div>;
}
