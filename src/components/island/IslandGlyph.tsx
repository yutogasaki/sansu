import type { ReactNode } from 'react';
import { ISLAND_GLYPH_LABELS } from './islandGlyphs';

const ink = '#354739';
const leaf = '#579265';
const red = '#e6574b';
const gold = '#f0bb4f';
const blue = '#4296ce';
const cream = '#fff4d8';

function Face({ y = 34 }: { y?: number }) {
    return <g fill={ink}><circle cx="24" cy={y} r="2.2" /><circle cx="40" cy={y} r="2.2" /><path d={`M29 ${y + 7}q3 3 6 0`} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" /></g>;
}

function Animal({ kind }: { kind: 'dog' | 'cat' | 'rabbit' | 'bear' | 'panda' | 'fox' }) {
    const colors = { dog: '#d4a66d', cat: '#e9b25f', rabbit: '#f6efdb', bear: '#a8794f', panda: '#f6efdb', fox: '#dc843f' };
    const body = colors[kind];
    return <>
        {kind === 'rabbit' ? <><ellipse cx="22" cy="17" rx="7" ry="15" fill={body} /><ellipse cx="42" cy="17" rx="7" ry="15" fill={body} /><path d="M22 9v13M42 9v13" stroke="#e9b4a6" strokeWidth="5" strokeLinecap="round" /></>
            : kind === 'cat' || kind === 'fox' ? <path d="M10 29 10 7 27 20 38 20 54 7 54 30" fill={body} />
                : <><ellipse cx="13" cy={kind === 'dog' ? 30 : 19} rx={kind === 'dog' ? 9 : 10} ry={kind === 'dog' ? 17 : 10} fill={kind === 'panda' ? ink : '#986b47'} /><ellipse cx="51" cy={kind === 'dog' ? 30 : 19} rx={kind === 'dog' ? 9 : 10} ry={kind === 'dog' ? 17 : 10} fill={kind === 'panda' ? ink : '#986b47'} /></>}
        <ellipse cx="32" cy="37" rx="23" ry="22" fill={body} />
        {kind === 'fox' && <path d="M10 35 31 43 54 35Q50 59 32 59 14 59 10 35" fill={cream} />}
        {kind === 'panda' && <g fill={ink}><ellipse cx="22" cy="33" rx="8" ry="9" transform="rotate(25 22 33)" /><ellipse cx="42" cy="33" rx="8" ry="9" transform="rotate(-25 42 33)" /></g>}
        {kind === 'dog' || kind === 'bear' ? <ellipse cx="32" cy="44" rx="11" ry="9" fill="#ebcf9e" /> : null}
        {kind === 'panda' ? <><circle cx="23" cy="33" r="2" fill="white" /><circle cx="41" cy="33" r="2" fill="white" /></> : <Face />}
        <path d="m28 41 4 4 4-4Z" fill={ink} />
        {kind === 'cat' && <path d="M9 39 21 42M8 46 21 45M43 42 55 39M43 45 56 46" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />}
    </>;
}

function artwork(symbol: string): ReactNode {
    const circles: Record<string, string> = { '●': ink, '🔴': '#e44343', '🔵': '#268bda', '🟡': '#f4ce39', '🟢': '#36a960', '🟠': '#ef9134' };
    const squares: Record<string, string> = { '🟥': '#e44343', '🟦': '#268bda', '🟨': '#f4ce39', '🟩': '#36a960', '🟧': '#ef9134', '🟪': '#9455b8', '⬜': '#ffffff' };
    if (circles[symbol]) return <circle data-glyph-shape="circle" cx="32" cy="32" r="23" fill={circles[symbol]} />;
    if (squares[symbol]) return <rect data-glyph-shape="square" x="9" y="9" width="46" height="46" fill={squares[symbol]} stroke={symbol === '⬜' ? '#a1aaa0' : undefined} strokeWidth="2" />;
    if (symbol === '🔺') return <path data-glyph-shape="triangle" d="M32 7 59 56H5Z" fill="#e44343" />;
    switch (symbol) {
        case '🍌': return <><path d="M13 8Q12 39 54 45C36 68 2 44 7 17Z" fill="#edc952" /><path d="M13 8Q23 38 55 40l-1 5Q12 39 13 8" fill="#ffe28b" /><path d="m9 7 4 1-1 8-5-1M51 41l8-1-2 7-4-1" fill="#877040" /></>;
        case '🍇': return <><path d="M32 18 37 5" stroke="#8d6b44" strokeWidth="4" strokeLinecap="round" /><path d="M35 12Q43 1 56 12 45 21 35 12" fill={leaf} /><g fill="#9571ad">{[[22,22],[42,22],[14,34],[32,35],[50,34],[23,47],[42,47],[32,57]].map(([x,y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="8" />)}</g><g fill="#bb9ecb"><circle cx="19" cy="19" r="2.5" /><circle cx="29" cy="32" r="2.5" /><circle cx="20" cy="44" r="2.5" /></g></>;
        case '🌻': return <><g fill={gold}>{[0,45,90,135,180,225,270,315].map(angle => <ellipse key={angle} cx="32" cy="15" rx="7" ry="13" transform={`rotate(${angle} 32 32)`} />)}</g><circle cx="32" cy="32" r="15" fill="#8d6944" /><circle cx="28" cy="28" r="2" fill="#b08e5d" /><circle cx="37" cy="29" r="2" fill="#b08e5d" /><circle cx="32" cy="37" r="2" fill="#b08e5d" /></>;
        case '🌙': return <path d="M40 4C2 4-2 55 35 60 48 60 58 51 61 40 29 51 19 22 40 4" fill={gold} />;
        case '🍎': return <><path d="M32 18Q16 9 9 25C1 48 22 62 32 55 43 62 63 47 55 25Q48 10 32 18" fill={red} /><path d="M33 18 35 7" stroke="#7e6240" strokeWidth="4" strokeLinecap="round" /><path d="M36 13Q42 2 53 8 49 19 36 13" fill={leaf} /><path d="M16 26q-4 6-2 12" fill="none" stroke="#ffa88b" strokeWidth="4" strokeLinecap="round" /></>;
        case '🍊': return <><circle cx="32" cy="36" r="24" fill="#f3a33e" /><path d="M32 14 34 8" stroke="#7e6240" strokeWidth="3" /><path d="M34 12Q42 1 53 10 46 20 34 12" fill={leaf} /><path d="M14 31q1-7 7-9" fill="none" stroke="#ffcd74" strokeWidth="4" strokeLinecap="round" /></>;
        case '🍓': return <><path d="M10 21Q32 10 54 21C61 34 41 58 32 61 23 58 3 34 10 21" fill={red} /><path d="m32 7 5 9 15-4-7 12 9 2-16 4-6-9-9 8-13-4 11-5-7-9 14 5Z" fill={leaf} /><g fill="#ffe0a2">{[[20,33],[32,35],[45,33],[25,44],[38,44],[32,53]].map(([x,y]) => <ellipse key={`${x}:${y}`} cx={x} cy={y} rx="1.5" ry="2" />)}</g></>;
        case '🍐': return <><path d="M23 18Q32 8 40 18C41 27 54 34 54 44 54 64 9 64 9 44 9 34 22 27 23 18" fill="#c4cd63" /><path d="M32 16 36 6" stroke="#7e6240" strokeWidth="4" strokeLinecap="round" /><path d="M36 12Q42 4 51 12 44 18 36 12" fill={leaf} /><path d="M18 39q-4 8 2 12" stroke="#e9e69a" strokeWidth="4" strokeLinecap="round" fill="none" /></>;
        case '🫐': return <><g fill="#4a76b5"><circle cx="23" cy="27" r="16" /><circle cx="43" cy="35" r="17" /><circle cx="23" cy="46" r="14" /></g><g fill="#304d87"><path d="m23 18 3 5 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" /><path d="m43 29 2 4 5 1-4 3 1 4-4-2-4 2 1-4-4-3 5-1Z" /></g><path d="M25 13Q34 2 46 8 37 18 25 13" fill={leaf} /></>;
        case '🌸': return <><g fill="#ec94a2">{[0,72,144,216,288].map(angle => <ellipse key={angle} cx="32" cy="18" rx="11" ry="15" transform={`rotate(${angle} 32 32)`} />)}</g><circle cx="32" cy="32" r="9" fill={gold} /></>;
        case '⭐': return <path d="m32 5 8 17 19 3-14 13 4 20-17-9-17 9 4-20L5 25l19-3Z" fill={gold} />;
        case '🐟': return <><path d="m44 30 16-15v34L44 38" fill="#3282b5" /><ellipse cx="28" cy="33" rx="24" ry="17" fill={blue} /><path d="m24 18 13-9 4 15M25 47l11 9 4-12" fill="#3282b5" /><path d="M28 27 36 34 28 40" fill="#86c4db" /><circle cx="15" cy="30" r="3" fill={ink} /></>;
        case '🥕': return <><path d="M17 24Q30 13 43 27L16 60Z" fill="#e9963c" /><path d="m31 20-5-14m8 13 4-15m-2 18L51 8" stroke={leaf} strokeWidth="6" strokeLinecap="round" /><path d="m23 34 6 3m-9 8 5 2" stroke="#b8712f" strokeWidth="2" /></>;
        case '🍯': return <><path d="M14 20H50L53 53Q32 64 11 53Z" fill="#c88438" /><rect x="13" y="14" width="38" height="11" rx="4" fill={gold} /><path d="M17 24H48v12q-5 7-8-2-4 11-8 0-5 9-8-1-7 3-7-9" fill={gold} /><ellipse cx="32" cy="46" rx="12" ry="9" fill={cream} /></>;
        case '🐶': return <Animal kind="dog" />;
        case '🐱': return <Animal kind="cat" />;
        case '🐰': return <Animal kind="rabbit" />;
        case '🐻': return <Animal kind="bear" />;
        case '🐼': return <Animal kind="panda" />;
        case '🦊': return <Animal kind="fox" />;
        case '🙂': return <><circle cx="32" cy="32" r="26" fill="#efd094" /><Face y={27} /></>;
        case '🐦': return <><path d="M13 47 5 31l19 5" fill="#397b94" /><ellipse cx="31" cy="37" rx="22" ry="18" fill="#6eacba" /><circle cx="42" cy="22" r="15" fill="#6eacba" /><path d="m54 20 9 6-10 4" fill={gold} /><path d="M20 31q4 23 21 10" fill="#c3d9c0" /><circle cx="46" cy="19" r="2.5" fill={ink} /><path d="M28 52v8m9-8v8" stroke="#8b7550" strokeWidth="3" /></>;
        case '🪱': return <><path d="M10 46C15 25 23 52 31 31s16 8 20-12" fill="none" stroke="#d89783" strokeWidth="12" strokeLinecap="round" /><circle cx="53" cy="16" r="8" fill="#d89783" /><circle cx="55" cy="13" r="1.7" fill={ink} /></>;
        case '🦒': return <><path d="M21 60V29L18 15Q34 6 49 17l-3 15-13 1 5 27" fill="#dfb860" /><path d="M23 12 21 5m16 6 1-7" stroke="#987448" strokeWidth="4" strokeLinecap="round" /><path d="m20 25 8 4-3 8-5-2m9 11 6-3 1 8-6 3" fill="#a77e45" /><ellipse cx="45" cy="25" rx="10" ry="8" fill="#efd197" /><circle cx="37" cy="18" r="2" fill={ink} /></>;
        case '🧸': return <><g fill="#ae8152"><ellipse cx="32" cy="46" rx="18" ry="16" /><circle cx="12" cy="42" r="9" /><circle cx="52" cy="42" r="9" /><circle cx="18" cy="56" r="8" /><circle cx="46" cy="56" r="8" /><circle cx="17" cy="13" r="8" /><circle cx="47" cy="13" r="8" /><circle cx="32" cy="23" r="19" /></g><ellipse cx="32" cy="30" rx="9" ry="7" fill="#e4c497" /><Face y={22} /><path d="m25 40 7 3 7-3v9l-7-3-7 3Z" fill={red} /></>;
        case '🌲': return <><path d="M28 41h8v21h-8" fill="#8d6b44" /><path d="M32 3 15 25h9L9 43h12L6 54h52L43 43h12L40 25h9Z" fill="#5c986a" /></>;
        case '🌳': return <><path d="M28 34h8v28h-8" fill="#8d6b44" /><path d="m32 46-9-10m9 5 10-11" stroke="#8d6b44" strokeWidth="5" /><path d="M15 40C-2 33 7 15 19 16 18-1 47-1 46 16 63 14 69 38 50 41Z" fill="#69a478" /></>;
        case '🏠': return <><path d="M12 29h40v31H12" fill="#f0dcb0" /><path d="m4 31 28-26 28 26Z" fill="#d47359" /><rect x="26" y="41" width="13" height="19" rx="3" fill="#9b8054" /><rect x="16" y="36" width="9" height="10" rx="2" fill="#88b7bb" /></>;
        case '🗼': return <><path d="M30 3h4l5 28 16 29H42l-6-17h-8l-6 17H9l16-29Z" fill="#ca7155" /><path d="M23 25h18M20 35h24M16 51h32" stroke={cream} strokeWidth="3" /><path d="M32 11v37" stroke="#9b5747" strokeWidth="2" /></>;
        case '🎈': return <><path d="M32 43q-9 8-2 13l-3 7" stroke="#948567" strokeWidth="2" fill="none" /><ellipse cx="32" cy="24" rx="20" ry="23" fill={red} /><path d="m32 45-4 7h8Z" fill={red} /><path d="M18 20q0-7 6-9" stroke="#ffb99a" strokeWidth="4" strokeLinecap="round" fill="none" /></>;
        case '🧺': return <><path d="M17 29C17 0 47 0 47 29" stroke="#9f7946" strokeWidth="5" fill="none" /><path d="M6 26h52l-6 34H12Z" fill="#c39d62" /><path d="m16 28 3 29m13-29v29m16-29-3 29M10 37h44M12 47h40" stroke="#ead1a0" strokeWidth="3" /><path d="M7 26h50" stroke="#9f7946" strokeWidth="6" strokeLinecap="round" /></>;
        case '📦': return <><path d="m5 20 26-13 28 13v32L33 63 5 50Z" fill="#cea777" /><path d="m5 20 28 11 26-11M33 31v32M20 13l27 13" stroke="#9f805c" strokeWidth="3" /><path d="m28 17 8-4 12 6-8 5v14l-7 3V28Z" fill="#e9cc95" /></>;
        case '🎁': return <><rect x="10" y="25" width="44" height="35" rx="3" fill="#e5b968" /><rect x="6" y="20" width="52" height="12" rx="3" fill="#f0cc80" /><path d="M27 20h10v40H27" fill={red} /><path d="M31 20C8 23 10 0 23 6l9 13C53-7 65 23 33 20" fill="none" stroke={red} strokeWidth="6" strokeLinejoin="round" /></>;
        case '📚': return <><path d="m6 42 40-7 12 8-40 8Z" fill="#749a7d" /><path d="M18 51v8l40-8v-8" fill="#e8e1bf" /><path d="M6 42v8l12 9v-8" fill="#52795e" /><path d="m9 24 41-5 7 8-41 6Z" fill="#d47a5b" /><path d="M16 33v9l41-6v-9" fill={cream} /><path d="m8 10 35-6 9 9-35 7Z" fill="#709eae" /><path d="M17 20v8l35-6v-9" fill={cream} /></>;
        case '🪨': return <><path d="m7 46 6-25L34 9l21 13 5 28-19 11-25-4Z" fill="#a1aaa0" /><path d="m13 21 20 7 1-19m-1 19 22-6-12 22-10-16-17 29" fill="#c4c8b8" /><path d="m43 44 17 6-19 11" fill="#7e8d83" /></>;
        case '⚽': return <><circle cx="32" cy="32" r="27" fill="#fffdf1" stroke="#aab3a4" strokeWidth="2" /><path d="m32 18 13 9-5 15H24l-5-15ZM9 21l7-12 9-3-2 10ZM48 10l9 12-7 3-5-8ZM48 43l9-1-9 13-9 3 1-9ZM9 41l7 2 8 8 1 8-14-9Z" fill={ink} /></>;
        default: return null;
    }
}

export function IslandGlyph({ symbol, label, decorative = false }: { symbol: string; label?: string; decorative?: boolean }) {
    const art = artwork(symbol.replace(/\uFE0F/g, ''));
    if (!art) return <span className="island-glyph-literal" data-island-glyph={symbol} data-glyph-renderer="literal" aria-hidden={decorative || undefined}>{symbol}</span>;
    return <svg className="island-glyph" data-island-glyph={symbol} data-glyph-renderer="vector" viewBox="0 0 64 64"
        role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label ?? ISLAND_GLYPH_LABELS[symbol]} aria-hidden={decorative || undefined} focusable="false">
        {art}
    </svg>;
}
