import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { decodeNativeGrowingKit } from './decodeNativeGrowingKit';

describe('native kit verified static-host delivery', () => {
    const source = new TextEncoder().encode('known native GLB bytes'), compressed = gzipSync(source);
    const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const expected = { sha256: hash(source), gzipSha256: hash(compressed), bytes: source.length };
    it('accepts both the exact gzip and browser-decoded Content-Encoding representations', async () => {
        for (const representation of [source, compressed]) {
            const decoded = await decodeNativeGrowingKit(Uint8Array.from(representation).buffer, expected);
            expect(new Uint8Array(decoded)).toEqual(source);
        }
    });
    it('rejects a mismatched model and a corrupt or substituted delivery before parsing', async () => {
        const changed = Uint8Array.from(source); changed[0] ^= 1;
        await expect(decodeNativeGrowingKit(changed.buffer, expected)).rejects.toThrow('delivery differs');
        await expect(decodeNativeGrowingKit(Uint8Array.from(compressed).buffer, { ...expected, sha256: '0'.repeat(64) })).rejects.toThrow('source differs');
    });
});
