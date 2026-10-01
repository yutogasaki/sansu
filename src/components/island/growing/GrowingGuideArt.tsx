import { useId } from 'react';
import type { AchievementId, GuidanceEvidence, Species } from '../../../domain/growingIsland';
import { ROOF_COLORS, STYLE_ROOF } from './plotParts';
import { FLAG_COLORS } from './keepsakeGeometry';

const INK = '#30364f';

/** Paper miniatures explain the game; they never replace its live world or Pokomoko. */
export function GrowingGuideArt({ id, evidence, className = '' }: { id: AchievementId; evidence?: GuidanceEvidence; className?: string }) {
    const uid = useId().replace(/:/g, '');
    const target = evidence?.snapshot.target;
    const plot = target && 'stage' in target ? target : undefined;
    const color = plot?.roof ?? 0;
    const roof = color >= ROOF_COLORS.length ? `url(#${uid}-${color === ROOF_COLORS.length ? 'dots' : 'blocks'})` : color ? ROOF_COLORS[color] : STYLE_ROOF[plot?.style ?? 'flower'];
    const flag = FLAG_COLORS[(evidence?.snapshot.flagColor ?? 4) % FLAG_COLORS.length];
    const species = target && 'species' in target ? target.species : 'rabbit';
    return <svg className={`growing-guide-art ${className}`} viewBox="0 0 220 148" aria-hidden="true" focusable="false">
        <defs>
            <pattern id={`${uid}-dots`} width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#e23b3b" /><circle cx="5" cy="5" r="3" fill="#fff7f0" /></pattern>
            <pattern id={`${uid}-blocks`} width="36" height="36" patternUnits="userSpaceOnUse"><path fill="#f25c8a" d="M0 0h36v36H0z" /><path fill="#ffd23f" d="M0 0h18v18H0z" /><path fill="#3fb8e8" d="M18 18h18v18H18z" /><path fill="#6ccf6b" d="M0 18h18v18H0z" /></pattern>
        </defs>
        <ellipse cx="110" cy="129" rx="87" ry="10" fill="#30364f" opacity=".08" />
        <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
            {id === 'A1' && <><Ground /><House x={35} y={27} roof={roof} /><Friend x={161} y={95} species={species} /><path d="m135 64 4-7m8 18 9-2" fill="none" stroke="#e0b454" strokeWidth="4" /></>}
            {id === 'A2' && <><Ground /><g transform="translate(39 95)"><ellipse cy="13" rx="20" ry="9" fill="#e8c878" /><path d="M0 9V-14" stroke="#78a86a" strokeWidth="4" /><path d="M0-6q-24-20-21-1Q-13 6 0-6m0-2q21-24 21-5Q16-3 0-8" fill="#78a86a" /></g><path d="M76 83q15-15 31-8m-7-9 8 9-10 6" fill="none" stroke="#315fb5" strokeWidth="4" /><Miniature target={target} x={111} y={26} roof={roof} scale={.85} /><path d="m161 21 2-8m11 12 7-5" fill="none" stroke="#e0b454" strokeWidth="4" /></>}
            {id === 'A3' && plot && <><Ground /><Miniature target={target} x={65} y={18} roof={roof} /><circle cx="34" cy="96" r="8" fill="#d77a86" /><circle cx="43" cy="118" r="7" fill="#e0b454" /></>}
            {id === 'A3' && !plot && <><Ground /><path d="M79 125V26" stroke="#9b7250" strokeWidth="7" /><circle cx="79" cy="24" r="5" fill="#e0b454" /><path d="M83 29q34-15 75 2l-10 21 10 22q-40-16-75-2Z" fill={flag} /><circle cx="112" cy="48" r="6" fill="#fffdf9" stroke="none" /><circle cx="137" cy="52" r="6" fill="#fffdf9" stroke="none" /><g transform="rotate(26 160 107)"><path d="M145 98h30v14h-30z" fill="#f0e4c6" /><path d="M143 96h16v18h-16z" fill={flag} /><path d="M175 101h15v8h-15z" fill="#9b7250" /></g><circle cx="39" cy="100" r="8" fill="#d77a86" /><circle cx="49" cy="120" r="7" fill="#e0b454" /></>}
            {id === 'A4' && <><Ground /><g opacity=".3"><Miniature target={target} x={20} y={53} roof={roof} scale={.55} fallback="bench" /></g><path d="M82 77q27-34 51-13m-9-12 10 12-15 3" fill="none" stroke="#315fb5" strokeWidth="4" /><Miniature target={target} x={116} y={50} roof={roof} scale={.7} fallback="bench" /></>}
            {id === 'A5' && <><Ground /><path d="M65 111V54m90 57V54" stroke="#9b7250" strokeWidth="6" /><path d="M55 57 110 18l55 39Z" fill="#9a7cc4" /><path d="M57 57h106v8H57z" fill="#ded1ef" /><path d="M49 121h122v9H49z" fill="#e8c878" /><Friend x={94} y={92} species="rabbit" scale={.66} /><Friend x={129} y={94} species="otter" scale={.66} /><path d="M178 62V40l13-4v20" fill="none" stroke="#315fb5" strokeWidth="4" /><ellipse cx="174" cy="63" rx="5" ry="4" fill="#315fb5" stroke="none" /><ellipse cx="187" cy="57" rx="5" ry="4" fill="#315fb5" stroke="none" /><path d="M36 42V23l10 5" fill="none" stroke="#9a7cc4" strokeWidth="4" /><ellipse cx="32" cy="43" rx="5" ry="4" fill="#9a7cc4" stroke="none" /></>}
            {id === 'A6' && <><path d="M21 99q9-30 68-28 42-8 55 22l-3 26q-47 24-106 2Z" fill="#d8bb83" /><path d="M21 97q10-29 68-27 47-9 55 21-13 28-67 26Q27 113 21 97Z" fill="#78a86a" /><path d="M141 93q29-33 56-5l3 24q-20 28-59 7Z" fill="#d8bb83" /><path d="M142 91q33-29 55-4 8 19-18 24-21 5-37-2Z" fill="#9fc59a" /><House x={46} y={31} roof={roof} scale={.65} /><path d="M127 46h51m-9-10 10 10-10 10" fill="none" stroke="#315fb5" strokeWidth="4" /><path d="m176 75 4-7m9 13 7-2" fill="none" stroke="#e0b454" strokeWidth="4" /></>}
        </g>
        {evidence && <g transform="translate(188 119) rotate(-12)"><circle r="16" fill="#dcece6" stroke="#5c806c" strokeWidth="2" strokeDasharray="3 2" /><path d="m-7 0 5 5 10-11" fill="none" stroke="#426751" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>}
    </svg>;
}

function Miniature({ target, x, y, roof, scale = 1, fallback = 'home' }: { target?: GuidanceEvidence['snapshot']['target']; x: number; y: number; roof: string; scale?: number; fallback?: 'home' | 'bench' }) {
    const kind = target && 'kind' in target ? target.kind : fallback;
    if (kind === 'home' || fallback === 'home' && !target) return <House x={x} y={y} roof={roof} scale={scale} stage={target && 'stage' in target ? target.stage : undefined} />;
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {kind === 'bench' ? <g transform="translate(0 28)"><Bench /></g>
            : kind === 'farm' ? <><path d="M0 81 46 56l46 25-46 28Z" fill="#9b7250" /><path d="m18 84 41-24m-22 37 40-24" stroke="#78a86a" strokeWidth="10" /></>
                : kind === 'play' ? <><path d="M5 99V37h60v62" fill="none" stroke="#9b7250" strokeWidth="8" /><path d="M28 39v37m21-37v37" strokeWidth="3" /><path d="M20 77h36v8H20z" fill="#e0b454" /></>
                    : kind === 'market' || kind === 'festival' ? <><path d="M6 101V56h68v45" fill="#f0e4c6" /><path d="M-3 56 10 27h61l13 29Z" fill={roof} /><path d="M26 28v28m30-28v28" stroke="#fffdf9" strokeWidth="12" /><path d="M13 81h54v19H13z" fill="#9b7250" /></>
                        : kind === 'sapling' || kind === 'flower' || kind === 'planter' ? <><ellipse cx="43" cy="94" rx="31" ry="12" fill="#e8c878" /><path d="M43 89V30" stroke="#78a86a" strokeWidth="7" /><path d="M43 53Q3 22 18 17q27-4 25 36Q59 5 78 28 89 43 43 53Z" fill="#78a86a" /></> : <><ellipse cx="43" cy="96" rx="26" ry="9" fill="#d8bb83" /><path d="m43 29 9 19 21 3-15 15 3 21-18-10-19 10 4-21-16-15 22-3Z" fill="#e0b454" /></>}
    </g>;
}

function Ground() { return <ellipse cx="110" cy="121" rx="80" ry="14" fill="#dcece6" stroke="none" />; }

function House({ x, y, roof, scale = 1, stage }: { x: number; y: number; roof: string; scale?: number; stage?: number }) {
    if (stage === 1) return <g transform={`translate(${x} ${y}) scale(${scale})`}><path d="M0 108 42 28l47 80Z" fill={roof} /><path d="m42 28 9 80H26Z" fill="#f0e4c6" /><path d="m42 67 9 41H34Z" fill="#9b7250" /></g>;
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path d="M10 41 70 36l14 14v52l-14 9-60-8Z" fill="#f0e4c6" />
        <path d="M70 36v75l14-9V50Z" fill="#d8bb83" />
        <path d="M0 44 37 5l44 34-10 13-62-2Z" fill={roof} />
        <path d="m37 5 44 34 14 6-33-35Z" fill={roof} opacity=".8" />
        <path d="M34 102V76q0-18 18-18 12 0 12 18v28" fill="#9b7250" />
        <rect x="17" y="64" width="12" height="16" rx="4" fill="#b9d9ef" /><path d="M23 64v16m-6-8h12" strokeWidth="1.5" />
        <circle cx="56" cy="86" r="2" fill="#e0b454" stroke="none" />
    </g>;
}

function Bench() { return <g><path d="M5 22v30m55-30v30" stroke="#9b7250" strokeWidth="6" /><path d="M0 4h65v16H0z" fill="#e8c878" /><path d="M-3 27h71v9H-3z" fill="#e8c878" /><path d="M7 11h49" stroke="#c6a365" strokeWidth="1.5" /></g>; }

function Friend({ x, y, species, scale = 1 }: { x: number; y: number; species: Species; scale?: number }) {
    const colors: Record<Species, string> = { rabbit: '#f1dfc2', otter: '#7d5236', fox: '#d08b43', duck: '#f2d587', squirrel: '#b17a4e', hedgehog: '#9b7250', bird: '#7ca8bf', girl: '#f4d3ba', boy: '#f4d3ba', penguin: '#2f3a52', owl: '#9b7250', frog: '#78a86a' };
    const fur = colors[species], isChild = species === 'girl' || species === 'boy';
    return <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <ellipse cy="25" rx="21" ry="5" fill={INK} opacity=".1" stroke="none" />
        {species === 'rabbit' ? <><ellipse cx="-10" cy="-38" rx="6" ry="21" fill={fur} transform="rotate(-12 -10 -38)" /><ellipse cx="10" cy="-41" rx="6" ry="22" fill={fur} transform="rotate(8 10 -41)" /><path d="m-10-48 3 20m7-23-2 20" stroke="#d77a86" strokeWidth="3" /></>
            : species === 'fox' || species === 'owl' ? <path d="m-18-17-2-26 19 17 20-17-3 26" fill={fur} />
                : !['duck', 'bird', 'penguin', 'girl', 'boy'].includes(species) && <><circle cx="-16" cy="-21" r="6" fill={fur} /><circle cx="16" cy="-21" r="6" fill={fur} /></>}
        <ellipse cy="9" rx="14" ry="18" fill={isChild ? '#5f9ec4' : fur} />
        <ellipse cy="-14" rx="21" ry="18" fill={fur} />
        {isChild && <path d="M-21-13q-3-29 21-24 25-1 22 24L8-26q-13 14-29 13" fill="#4a3024" />}
        {species === 'otter' || species === 'fox' || species === 'penguin' ? <ellipse cy="-7" rx="13" ry="8" fill="#f1dfc2" stroke="none" /> : null}
        <circle cx="-8" cy="-17" r="2.2" fill={INK} stroke="none" /><circle cx="8" cy="-17" r="2.2" fill={INK} stroke="none" />
        {['duck', 'bird', 'penguin', 'owl'].includes(species) ? <path d="m-5-9 5 7 7-7Z" fill="#e0b454" /> : <path d="m-2-9 2 2 2-2m-2 2v4" fill="none" strokeWidth="1.6" />}
        <path d="m-14 5-8 6m35-6 8-4" stroke={fur} strokeWidth="7" />
        <path d="m-7 25-6 1m20-1 6 1" stroke={fur} strokeWidth="7" />
    </g>;
}
