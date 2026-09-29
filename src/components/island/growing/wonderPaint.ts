import * as T from 'three';

/**
 * The island's "ふしぎ" accents, in Pokomoko's lineage of patchwork and dots: Kusama-like
 * polka dots and Britto-like bold outlined colour blocks. Used here and there, never on
 * everything (spec 52 §19 art note). Textures are drawn once and shared for the session.
 */
export type Wonder = 'dots-red' | 'dots-yellow' | 'dots-pastel' | 'blocks';

const cache = new Map<Wonder, T.MeshStandardMaterial>();

function draw(kind: Wonder) {
    const size = 128, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) return undefined;
    if (kind === 'blocks') {
        const colors = ['#f25c8a', '#ffd23f', '#3fb8e8', '#6ccf6b', '#9b6ae0', '#ff8a3d'];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = colors[(x + y * 2) % colors.length]; g.fillRect(x * 32, y * 32, 32, 32); }
        g.strokeStyle = '#1f1a24'; g.lineWidth = 4;
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 - 8, size); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(size, i * 32 + 6); g.stroke(); }
        g.fillStyle = '#fff'; for (const [x, y] of [[16, 16], [80, 48], [48, 96], [112, 112]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    } else {
        const [ground, dot] = kind === 'dots-red' ? ['#e23b3b', '#fff7f0'] : kind === 'dots-yellow' ? ['#f7c83a', '#1f1a24'] : ['#f6c6d4', '#fff1b0'];
        g.fillStyle = ground; g.fillRect(0, 0, size, size); g.fillStyle = dot;
        for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
            const x = col * 28 + (row % 2) * 14 + 6, y = row * 26 + 10, r = 5 + ((row * 3 + col) % 3) * 2;
            g.beginPath(); g.arc(x % size, y, r, 0, Math.PI * 2); g.fill();
        }
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping;
    return texture;
}

export function wonder(kind: Wonder): T.Material {
    let material = cache.get(kind);
    if (!material) {
        const map = typeof document === 'undefined' ? undefined : draw(kind);
        material = new T.MeshStandardMaterial({ color: map ? '#ffffff' : '#e23b3b', map, roughness: .7 });
        cache.set(kind, material);
    }
    return material;
}
