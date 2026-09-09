/** Keep the actual shutter frame. Resizing never asks the world to render again. */
export interface CapturedPhotoImage {
    mime: 'image/png'; width: number; height: number; bytes: number; sha256: string;
}

const IMAGE_LIMIT = 2 * 1024 * 1024;
const THUMBNAIL_LIMIT = 128 * 1024;

export function islandPhotoDimensions(width: number, height: number, maximum: number) {
    if (![width, height, maximum].every(value => Number.isSafeInteger(value) && value > 0)) {
        throw new Error('Empty island frame');
    }
    const scale = Math.min(1, maximum / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function islandPhotoResizeCandidates(width: number, height: number) {
    return [1600, 1280, 1024, 800].map(size => islandPhotoDimensions(width, height, size))
        .filter((size, index, all) => index === 0 || size.width !== all[index - 1].width || size.height !== all[index - 1].height);
}

function assertCurrent(isCurrent: () => boolean) {
    if (!isCurrent()) throw new DOMException('Photo view closed', 'AbortError');
}

async function encode(canvas: HTMLCanvasElement, isCurrent: () => boolean) {
    assertCurrent(isCurrent);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    assertCurrent(isCurrent);
    if (!blob || blob.type !== 'image/png' || blob.size === 0) throw new Error('Island photo unavailable');
    return blob;
}

async function describe(blob: Blob, width: number, height: number, isCurrent: () => boolean): Promise<CapturedPhotoImage> {
    const bytes = await blob.arrayBuffer();
    assertCurrent(isCurrent);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    assertCurrent(isCurrent);
    return { mime: 'image/png', width, height, bytes: blob.size,
        sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}

export async function prepareIslandPhoto(frame: string, isCurrent: () => boolean = () => true) {
    assertCurrent(isCurrent);
    if (!frame.startsWith('data:image/png;base64,')) throw new Error('Island photo unavailable');
    const image = new Image();
    const canvas = document.createElement('canvas');
    try {
        image.src = frame;
        await image.decode();
        assertCurrent(isCurrent);
        const candidates = islandPhotoResizeCandidates(image.naturalWidth, image.naturalHeight);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Island photo unavailable');
        let original: { blob: Blob; width: number; height: number } | undefined;
        for (const size of candidates) {
            canvas.width = size.width; canvas.height = size.height;
            context.drawImage(image, 0, 0, size.width, size.height);
            const blob = await encode(canvas, isCurrent);
            if (blob.size <= IMAGE_LIMIT) { original = { blob, ...size }; break; }
        }
        if (!original) throw new Error('Photo is too large');
        // Detailed scenery can exceed the PNG byte limit even at 320px. Keep
        // the original untouched and choose the largest permitted thumbnail.
        const thumbnailCandidates = [320, 256, 192, 160]
            .map(size => islandPhotoDimensions(image.naturalWidth, image.naturalHeight, size))
            .filter((size, index, all) => index === 0 || size.width !== all[index - 1].width || size.height !== all[index - 1].height);
        let thumbnail: { blob: Blob; width: number; height: number } | undefined;
        for (const size of thumbnailCandidates) {
            canvas.width = size.width; canvas.height = size.height;
            context.drawImage(image, 0, 0, size.width, size.height);
            const blob = await encode(canvas, isCurrent);
            if (blob.size <= THUMBNAIL_LIMIT) { thumbnail = { blob, ...size }; break; }
        }
        if (!thumbnail) throw new Error('Photo thumbnail is too large');
        const imageMetadata = await describe(original.blob, original.width, original.height, isCurrent);
        const thumbnailMetadata = await describe(thumbnail.blob, thumbnail.width, thumbnail.height, isCurrent);
        return { image: imageMetadata, thumbnail: thumbnailMetadata,
            blobs: { image: original.blob, thumbnail: thumbnail.blob } };
    } finally {
        image.src = '';
        canvas.width = 1; canvas.height = 1;
    }
}

/** Export the stored pixels, independent of today's theme, names or camera. */
export function downloadStoredIslandPhoto(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'しまのしゃしん.png';
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
