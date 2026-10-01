import { islandLevel, keepsakeKind } from '../../../domain/growingIsland';
import type { GrowingState } from '../../../domain/growingIsland';
import { CHARACTER_NAME, villagerName } from './growingCopy';

export const CARD_WIDTH = 1080, CARD_HEIGHT = 1350;
const KEEPSAKE_ICON = { blocks: '🧱', balance: '⚖️', fountain: '⛲', clock: '🕰️', windmill: '🌬️', star: '⭐', flowerbed: '🌷', tower: '🗼', book: '📘', globe: '🌐', abc: '🔤', balloon: '🎈', telescope: '🔭' } as const;

/**
 * しまカード (§13): the whole island, its name and character, up to twelve faces, how many
 * live there and the keepsakes. Drawn on this device only; the child decides to save it.
 */
/** Card frames the child can choose; the gold frame of island level 10 stays on top of any. */
export const CARD_FRAMES = [
    { id: 'dots', name: 'みずたま' }, { id: 'blocks', name: 'いろの ブロック' }, { id: 'stars', name: 'ほし' }, { id: 'plain', name: 'シンプル' },
] as const;
export type CardFrame = (typeof CARD_FRAMES)[number]['id'];

export async function drawIslandCard(state: GrowingState, island: HTMLCanvasElement, faces: Record<string, string>, owner: string, frame: CardFrame = 'dots') {
    const canvas = document.createElement('canvas'); canvas.width = CARD_WIDTH; canvas.height = CARD_HEIGHT;
    const g = canvas.getContext('2d'); if (!g) throw new Error('card unavailable');
    const special = islandLevel(state) >= 10;
    g.fillStyle = special ? '#fbe9b8' : '#fff8ec'; g.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    g.strokeStyle = special ? '#d9a93a' : '#e3d6bf'; g.lineWidth = special ? 28 : 14;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, CARD_WIDTH - g.lineWidth, CARD_HEIGHT - g.lineWidth);
    // A ring of wonder dots around the frame (Pokomoko's polka-dot lineage).
    const dots = ['#e23b3b', '#ffd23f', '#3fb8e8', '#6ccf6b', '#f25c8a', '#9b6ae0'];
    if (frame === 'blocks') {
        // Bold outlined colour blocks along the edge (Britto).
        const size = 54;
        for (let x = 0; x < CARD_WIDTH; x += size) for (const y of [0, CARD_HEIGHT - size]) { g.fillStyle = dots[(x / size + y) % dots.length]; g.fillRect(x, y, size, size); }
        for (let y = size; y < CARD_HEIGHT - size; y += size) for (const x of [0, CARD_WIDTH - size]) { g.fillStyle = dots[(y / size + x) % dots.length]; g.fillRect(x, y, size, size); }
        g.strokeStyle = '#1f1a24'; g.lineWidth = 4; g.strokeRect(size, size, CARD_WIDTH - size * 2, CARD_HEIGHT - size * 2);
    }
    for (let i = 0; frame !== 'plain' && frame !== 'blocks' && i < 44; i++) {
        const t = i / 44, side = Math.floor(t * 4), u = (t * 4) % 1, inset = special ? 44 : 32;
        const x = side === 0 ? inset + u * (CARD_WIDTH - 2 * inset) : side === 1 ? CARD_WIDTH - inset : side === 2 ? CARD_WIDTH - inset - u * (CARD_WIDTH - 2 * inset) : inset;
        const y = side === 0 ? inset : side === 1 ? inset + u * (CARD_HEIGHT - 2 * inset) : side === 2 ? CARD_HEIGHT - inset : CARD_HEIGHT - inset - u * (CARD_HEIGHT - 2 * inset);
        g.fillStyle = dots[i % dots.length];
        if (frame === 'stars') { g.font = `${special ? 34 : 26}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', x, y); }
        else { g.beginPath(); g.arc(x, y, special ? 12 : 8, 0, Math.PI * 2); g.fill(); }
    }
    const font = (size: number, weight = 800) => `${weight} ${size}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`;
    g.fillStyle = '#3a3346'; g.textAlign = 'center';
    g.font = font(64); g.fillText(state.islandName ?? `${owner}の しま`, CARD_WIDTH / 2, 130);
    g.font = font(36, 700); g.fillStyle = '#7a6f88'; g.fillText(CHARACTER_NAME[state.character], CARD_WIDTH / 2, 185);
    const top = 220, h = 600, w = 960;
    g.save(); roundRect(g, 60, top, w, h, 40); g.clip();
    const scale = Math.max(w / island.width, h / island.height);
    g.drawImage(island, 60 + (w - island.width * scale) / 2, top + (h - island.height * scale) / 2, island.width * scale, island.height * scale);
    g.restore();
    const people = [...state.villagers].sort((a, b) => a.arrivedAt - b.arrivedAt).slice(0, 12);
    const images = await Promise.all(people.map(v => faces[v.id] ? load(faces[v.id]) : Promise.resolve(undefined)));
    people.forEach((v, i) => {
        const col = i % 6, row = Math.floor(i / 6), x = 110 + col * 172, y = 850 + row * 165;
        g.save(); g.beginPath(); g.arc(x + 60, y + 60, 60, 0, Math.PI * 2); g.fillStyle = '#fff1d6'; g.fill(); g.clip();
        const image = images[i]; if (image) g.drawImage(image, x, y, 120, 120);
        g.restore();
        g.fillStyle = '#3a3346'; g.font = font(24, 700); g.fillText(villagerName(v).slice(0, 6), x + 60, y + 150);
    });
    g.font = font(38); g.fillStyle = '#3a3346';
    g.fillText(`なかま ${state.villagers.length}にん ・ げんき Lv${islandLevel(state)}`, CARD_WIDTH / 2, 1240);
    const keep = state.keepsakes.filter(k => k.cell).map(k => KEEPSAKE_ICON[keepsakeKind(k.unitId)]).slice(0, 10).join(' ');
    if (keep) { g.font = font(34, 700); g.fillText(`まなびの きねんひん ${keep}`, CARD_WIDTH / 2, 1295); }
    return canvas;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function load(src: string) {
    return new Promise<HTMLImageElement | undefined>(resolve => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(undefined); image.src = src; });
}

export const canvasBlob = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
    new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('image unavailable')), type, quality));

/** Saves to this device through the browser's own download. Nothing is sent anywhere. */
export function saveImage(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
