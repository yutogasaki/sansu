const digest = async (buffer: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(n => n.toString(16).padStart(2, '0')).join('');

/** Some static hosts mark .gz as Content-Encoding, so fetch already decompresses
 * it. Verify either exact representation before parsing; never trust the header. */
export async function decodeNativeGrowingKit(delivered: ArrayBuffer, expected: { sha256: string; gzipSha256: string; bytes: number }) {
    const deliveryHash = await digest(delivered);
    let buffer = delivered;
    if (deliveryHash !== expected.sha256) {
        if (deliveryHash !== expected.gzipSha256) throw Error('Native owned kit delivery differs');
        buffer = await new Response(new Blob([delivered]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }
    if (buffer.byteLength !== expected.bytes || await digest(buffer) !== expected.sha256) throw Error('Native owned kit source differs');
    return buffer;
}
