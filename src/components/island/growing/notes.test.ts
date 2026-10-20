import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('caps tap voices at three and cancels both playing and scheduled notes', async () => {
    const gains: { disconnect: ReturnType<typeof vi.fn> }[] = [];
    class Audio {
        currentTime = 0; state = 'running'; destination = {};
        createGain() { const value = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect: vi.fn() }; gains.push(value); return value; }
        createOscillator() { return { type: 'sine', frequency: { value: 0 }, connect() {}, disconnect() {}, start() {}, stop() {}, onended: undefined }; }
    }
    vi.stubGlobal('window', { AudioContext: Audio });
    const { playNote, playTune, stopNotes } = await import('./notes');
    for (let index = 0; index < 30; index++) playNote(index);
    expect(gains.filter(gain => !gain.disconnect.mock.calls.length)).toHaveLength(9);
    playTune(true, 0); stopNotes();
    expect(gains.every(gain => gain.disconnect.mock.calls.length === 1)).toBe(true);
});
