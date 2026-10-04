import { afterEach, expect, it, vi } from 'vitest';
const construct = vi.hoisted(() => vi.fn());
vi.mock('three', () => ({ WebGLRenderer: class { constructor(options: unknown) { construct(options); } } }));
import { createIslandRenderer } from './createIslandRenderer';
afterEach(() => { construct.mockReset(); vi.unstubAllGlobals(); });

it('keeps the normal graphics profile on desktop', () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome', platform: 'Linux', maxTouchPoints: 0 });
    expect(createIslandRenderer({ alpha: false }).compact).toBe(false);
    expect(construct).toHaveBeenCalledWith({ alpha: false, antialias: true, powerPreference: 'low-power' });
});
it.each([
    { userAgent: 'Mozilla iPad', platform: 'iPad', maxTouchPoints: 5 },
    { userAgent: 'Mozilla Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 },
])('starts Apple touch devices without multisampling (%j)', device => {
    vi.stubGlobal('navigator', device);
    expect(createIslandRenderer().compact).toBe(true);
    expect(construct).toHaveBeenCalledOnce();
    expect(construct).toHaveBeenCalledWith({ antialias: false, powerPreference: 'low-power' });
});
it('retries a failed normal allocation exactly once with the smaller profile', () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome', platform: 'Linux', maxTouchPoints: 0 });
    construct.mockImplementationOnce(() => { throw Error('surface allocation failed'); });
    expect(createIslandRenderer({ alpha: false }).compact).toBe(true);
    expect(construct).toHaveBeenCalledTimes(2);
    expect(construct).toHaveBeenLastCalledWith({ alpha: false, antialias: false, powerPreference: 'low-power' });
});
it('reports an unsupported GPU and does not retry compact mode indefinitely', () => {
    construct.mockImplementation(() => { throw Error('WebGL2 unavailable'); });
    expect(() => createIslandRenderer({}, true)).toThrow('WebGL2 unavailable');
    expect(construct).toHaveBeenCalledOnce();
});
