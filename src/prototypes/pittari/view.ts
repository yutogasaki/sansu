import type { Columns } from './engine';
export const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

export function renderBoard(columns: Columns, onPick: (column: number) => void, locked: boolean, selected: number | null) {
    const board = element('board');
    board.replaceChildren();
    board.style.setProperty('--columns', String(columns.length));
    columns.forEach((column, c) => {
        const track = document.createElement('div');
        track.className = 'column';
        column.forEach((value, row) => {
            const tile = document.createElement(row === 0 ? 'button' : 'div');
            tile.className = `tile ${row === 0 ? 'touchable' : 'upcoming'}`;
            tile.style.bottom = `calc(${row} * (var(--tile-height) + var(--tile-gap)))`;
            tile.dataset.column = String(c);
            tile.dataset.row = String(row);
            tile.setAttribute('aria-label', `${c + 1}れつめ ${row === 0 ? 'した' : `うえ${row}`} ${value}`);
            if (tile instanceof HTMLButtonElement) {
                tile.disabled = locked;
                tile.setAttribute('aria-pressed', String(selected === c));
                tile.addEventListener('click', () => onPick(c));
            }
            const number = document.createElement('span');
            number.className = 'number'; number.textContent = String(value);
            const dots = document.createElement('span');
            dots.className = 'dots'; dots.setAttribute('aria-hidden', 'true');
            for (let n = 0; n < value; n++) dots.append(document.createElement('i'));
            tile.append(number, dots); track.append(tile);
        });
        board.append(track);
    });
}

export function animateMerge(pair: number) {
    for (const tile of document.querySelectorAll<HTMLElement>('.tile[data-row="0"]')) {
        const column = Number(tile.dataset.column);
        if (column === pair || column === pair + 1) {
            tile.classList.add('merging');
            if (!reduced()) tile.animate([
                { transform: 'translateX(0) scale(1)', opacity: 1 },
                { transform: `translateX(${column === pair ? '25%' : '-25%'}) scale(.85)`, opacity: 1, offset: .6 },
                { transform: `translateX(${column === pair ? '45%' : '-45%'}) scale(.5)`, opacity: 0 },
            ], { duration: 360, fill: 'forwards', easing: 'ease-in' });
        }
    }
}
export function animateFall(pair: number) {
    if (reduced()) return;
    for (const tile of document.querySelectorAll<HTMLElement>('.tile')) {
        const column = Number(tile.dataset.column);
        if (column === pair || column === pair + 1) tile.animate([
            { transform: 'translateY(calc(-1 * (var(--tile-height) + var(--tile-gap))))' },
            { transform: 'translateY(0)' },
        ], { duration: 300, easing: 'cubic-bezier(.4,0,.7,1)' });
    }
}
