import type { KokugoItem } from './types';
export async function kokugoAudioBlob(item: KokugoItem) {
    if (!item.audio || !item.audioSha256) throw new Error('音の じゅんびを たしかめてね。');
    const response = await fetch(item.audio);
    if (!response.ok) throw new Error('音を よみこめなかったよ。');
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== item.audioSha256) throw new Error('音を たしかめられなかったよ。');
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}
