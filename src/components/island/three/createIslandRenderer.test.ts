import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const construct = vi.hoisted(() => vi.fn());
vi.mock('three', () => ({ WebGLRenderer: class {
    dispose = vi.fn();
    constructor(options: unknown) { construct(options); }
} }));
import { createIslandRenderer } from './createIslandRenderer';

const contexts: ReturnType<typeof makeContext>[] = [], canvases: ReturnType<typeof makeCanvas>[] = [];
const makeContext = () => ({ isContextLost: vi.fn(() => false), getExtension: vi.fn(() => ({ loseContext: lose })) });
const lose = vi.fn();
const makeCanvas = () => {
    const context = makeContext(); contexts.push(context);
    return { width: 300, height: 150, getContext: vi.fn(() => context), addEventListener: vi.fn<(type: string, listener: EventListener) => void>(), removeEventListener: vi.fn(), remove: vi.fn() };
};
const create = vi.fn(() => { const canvas = makeCanvas(); canvases.push(canvas); return canvas; });
beforeEach(() => {
    vi.stubGlobal('document', { createElement: create });
    vi.stubGlobal('navigator', { userAgent: 'Chrome', platform: 'Linux', maxTouchPoints: 0 });
});
afterEach(() => { vi.clearAllMocks(); construct.mockReset(); create.mockReset().mockImplementation(() => { const canvas = makeCanvas(); canvases.push(canvas); return canvas; }); contexts.length = canvases.length = 0; vi.unstubAllGlobals(); });

it('keeps the normal graphics profile on desktop', () => {
    expect(createIslandRenderer({ alpha: false })).toMatchObject({ compact: false, recovery: false });
    expect(canvases[0].getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ alpha: false, antialias: true, powerPreference: 'low-power' }));
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ canvas: canvases[0], context: contexts[0] }));
    expect(lose).not.toHaveBeenCalled();
});
it.each([
    { userAgent: 'Mozilla iPad', platform: 'iPad', maxTouchPoints: 5 },
    { userAgent: 'Mozilla Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 },
])('starts Apple touch devices without multisampling (%j)', device => {
    vi.stubGlobal('navigator', device);
    expect(createIslandRenderer().compact).toBe(true);
    expect(construct).toHaveBeenCalledOnce();
    expect(canvases[0].getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ antialias: false }));
});
it.each([false, true])('releases a partially constructed renderer before fallback, including compact=%s', compact => {
    const sequence: string[] = [];
    lose.mockImplementationOnce(() => { sequence.push('released'); });
    construct.mockImplementationOnce(() => { sequence.push('failed'); throw Error('initialization failed'); })
        .mockImplementationOnce(() => { sequence.push('recovered'); });
    expect(createIslandRenderer({}, compact)).toMatchObject({ compact: true, recovery: true });
    expect(sequence).toEqual(['failed', 'released', 'recovered']);
    expect(canvases[0]).not.toBe(canvases[1]);
    expect(canvases[0].remove).toHaveBeenCalledOnce();
    expect(canvases[1].getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ antialias: false, powerPreference: 'default' }));
});
it('a manual recovery starts with different attributes even on an already compact iPad', () => {
    vi.stubGlobal('navigator', { userAgent: 'iPad' });
    expect(createIslandRenderer({}, true, true)).toMatchObject({ compact: true, recovery: true });
    expect(construct).toHaveBeenCalledOnce();
    expect(canvases[0].getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ antialias: false, powerPreference: 'default' }));
});
it('preserves both errors and releases both contexts when all constructor attempts fail', () => {
    construct.mockImplementationOnce(() => { throw Error('first'); }).mockImplementationOnce(() => { throw Error('second'); });
    expect(() => createIslandRenderer({}, true)).toThrow('Initial: first; Recovery: second');
    expect(construct).toHaveBeenCalledTimes(2);
    expect(lose).toHaveBeenCalledTimes(2);
});
it('does not loop a manual recovery failure', () => {
    construct.mockImplementation(() => { throw Error('no GPU'); });
    expect(() => createIslandRenderer({}, true, true)).toThrow('no GPU');
    expect(construct).toHaveBeenCalledOnce();
    expect(lose).toHaveBeenCalledOnce();
});
it('rejects an already lost context even if Three construction did not throw', () => {
    create.mockImplementation(() => {
        const canvas = makeCanvas(); contexts.at(-1)!.isContextLost.mockReturnValue(true); canvases.push(canvas); return canvas;
    });
    expect(() => createIslandRenderer({}, true, true)).toThrow('context lost during initialization');
    expect(lose).toHaveBeenCalledOnce();
});
it('retains native context-creation details without creating an extra diagnostic context', () => {
    create.mockImplementation(() => {
        const canvas = makeCanvas();
        canvas.getContext.mockImplementation(() => {
            const listener = canvas.addEventListener.mock.calls[0][1] as (event: unknown) => void;
            listener({ statusMessage: 'GPU process unavailable' });
            return null as never;
        });
        canvases.push(canvas); return canvas;
    });
    expect(() => createIslandRenderer({}, true, true)).toThrow('GPU process unavailable');
    expect(canvases[0].getContext).toHaveBeenCalledOnce();
    expect(construct).not.toHaveBeenCalled();
    expect(lose).not.toHaveBeenCalled();
});
