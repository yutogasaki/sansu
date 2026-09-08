import { deflateSync } from 'node:zlib';
import { islandPhotoId, type IslandPhotoBlobPair, type IslandPhotoImageMetadata, type IslandPhotoInput } from './photos';

function chunk(type: string, data: Uint8Array): Uint8Array {
    const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer);
    view.setUint32(0, data.length); bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8);
    let crc = 0xffffffff;
    for (const byte of bytes.subarray(4, -4)) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
    return bytes;
}
/** Valid 1×1 RGB PNG; a legal tEXt chunk supplies deterministic capacity cases. */
export function photoPng(size?: number): Blob {
    const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, 1); view.setUint32(4, 1); header[8] = 8; header[9] = 2;
    const parts: Uint8Array<ArrayBuffer>[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), new Uint8Array(chunk('IHDR', header)), new Uint8Array(chunk('IDAT', deflateSync(new Uint8Array([0, 120, 190, 80]))))];
    const end = chunk('IEND', new Uint8Array()), base = parts.reduce((sum, part) => sum + part.length, 0) + end.length;
    if (size && size > base) {
        const text = new Uint8Array(size - base - 12); text.fill(97); text[0] = 107; text[1] = 0;
        parts.push(new Uint8Array(chunk('tEXt', text)));
    }
    parts.push(new Uint8Array(end)); return new Blob(parts, { type: 'image/png' });
}
export async function describePhotoBlob(blob: Blob): Promise<IslandPhotoImageMetadata> {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return { mime: 'image/png', width: 1, height: 1, bytes: blob.size, sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
}
export async function photoInput(profileId = 'child', pair: IslandPhotoBlobPair = { image: photoPng(), thumbnail: photoPng() }) {
    const input: IslandPhotoInput = { id: islandPhotoId(profileId, crypto.randomUUID()), profileId, capturedAt: 100, islandName: 'こもれび', composition: 'island',
        image: await describePhotoBlob(pair.image), thumbnail: await describePhotoBlob(pair.thumbnail) };
    return { input, blobs: pair };
}
