import * as THREE from 'three';
import { WORD_GROUPS, type LearnedWord, type WallPatternId, type WordGroupId } from '../../../domain/growingIsland/room';

/** One learned word on a wall: where its dot is, so a tap can read the word aloud. */
export interface WallSpot { u: number; v: number; r: number; word: string }
export interface WallPaint { texture: THREE.CanvasTexture; spots: WallSpot[] }

const COLOR = Object.fromEntries(WORD_GROUPS.map(g => [g.id, g.color])) as Record<WordGroupId, string>;
const BLOCKS = ['#fbd3df', '#fff0b8', '#cfe9f7', '#d6efcf', '#e6dcf5', '#ffe0c7'];

/** A stable number from a word id: each word keeps its own place on the wall. */
function hash(text: string, salt: number) {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

function shape(g: CanvasRenderingContext2D, pattern: WallPatternId, x: number, y: number, r: number, color: string, word = '') {
    g.fillStyle = color; g.strokeStyle = color;
    if (pattern === 'letters') {
        // Each word stands on the wall as its own first letter.
        g.font = `900 ${Math.round(r * 2.4)}px "Zen Maru Gothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((word.replace(/_lv\d+$/, '')[0] ?? '?').toUpperCase(), x, y);
    } else if (pattern === 'hearts') {
        g.beginPath(); g.moveTo(x, y + r * .9);
        g.bezierCurveTo(x - r * 1.4, y - r * .1, x - r * .7, y - r * 1.2, x, y - r * .45);
        g.bezierCurveTo(x + r * .7, y - r * 1.2, x + r * 1.4, y - r * .1, x, y + r * .9); g.fill();
    } else if (pattern === 'blocks') {
        g.fillRect(x - r, y - r, r * 2, r * 2); g.lineWidth = Math.max(1.5, r * .22); g.strokeStyle = '#1f1a24'; g.strokeRect(x - r, y - r, r * 2, r * 2);
    } else if (pattern === 'rings') {
        g.lineWidth = Math.max(1.5, r * .3);
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(x, y, r * .35, 0, Math.PI * 2); g.fill();
    } else if (pattern === 'stars') {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * .45 : r;
            if (i) g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); else g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
        }
        g.closePath(); g.fill();
    } else if (pattern === 'pie') {
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff8ec'; g.lineWidth = Math.max(1, r * .16);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
    } else { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
}

/**
 * Draws one wall. The more words a child has learned, the denser and more colourful it gets:
 * a few dots at first, a Kusama-like field after a year. Dot size shrinks gently with count.
 */
export function paintWall(words: readonly LearnedWord[], pattern: WallPatternId, aspect: number, salt: number): WallPaint {
    const width = 512, height = Math.round(width / aspect);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, width, height);
    if (pattern === 'blocks') {
        const size = 64;
        for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) { g.fillStyle = BLOCKS[(x / size + y / size * 2) % BLOCKS.length]; g.fillRect(x, y, size, size); }
        g.strokeStyle = 'rgba(31,26,36,.25)'; g.lineWidth = 2;
        for (let x = 0; x <= width; x += size) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.stroke(); }
        for (let y = 0; y <= height; y += size) { g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke(); }
    }
    const r = Math.max(4, Math.min(16, 16 / Math.sqrt(Math.max(1, words.length / 40))));
    const spots: WallSpot[] = [];
    for (const word of words) {
        const u = .04 + hash(word.id, salt) * .92, v = .06 + hash(word.id, salt + 7) * .88;
        shape(g, pattern, u * width, (1 - v) * height, r, COLOR[word.group], word.id);
        spots.push({ u, v, r: r / width, word: word.id });
    }
    if (!words.length) {
        // An empty wall hints softly at what learning will bring.
        g.fillStyle = 'rgba(160,140,120,.18)';
        for (const [x, y] of [[.3, .55], [.5, .45], [.7, .6]]) { g.beginPath(); g.arc(x * width, y * height, 10, 0, Math.PI * 2); g.fill(); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, spots };
}

/** Which wall a word lives on: spread over the three walls, the same wall every time. */
export const wallOf = (word: string) => Math.floor(hash(word, 99) * 3);

export function spotAt(spots: readonly WallSpot[], u: number, v: number, aspect: number) {
    let best: WallSpot | undefined, bestDistance = Infinity;
    for (const spot of spots) {
        const d = Math.hypot((spot.u - u) * aspect, spot.v - v);
        if (d < bestDistance) { best = spot; bestDistance = d; }
    }
    return best && bestDistance <= Math.max(best.r * aspect * 2.2, .03) ? best.word : undefined;
}
