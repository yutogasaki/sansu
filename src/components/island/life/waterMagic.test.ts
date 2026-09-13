import { expect, it } from 'vitest';
import { buildWaterMagic } from './waterMagic';
it('clips stars and waves to one actual water surface and restores it after five seconds', () => {
    const effect = buildWaterMagic();
    try {
        expect(effect.root.geometry.parameters.radius).toBe(.312);
        effect.sample(0, true, [.1, -.1], false); expect(effect.root.visible).toBe(true);
        effect.sample(4999, true, [.1, -.1], true); expect(effect.root.visible).toBe(true);
        expect(effect.root.material.uniforms.touchPoint.value.toArray()).toEqual([.1,-.1]);
        effect.sample(5000, true, [.1, -.1], false); expect(effect.root.visible).toBe(false);
        effect.sample(1200, false, [0, 0], false); expect(effect.root.visible).toBe(false);
        effect.sample(100, true, [1, 1], false); expect(effect.root.visible).toBe(false);
    } finally { effect.dispose(); }
});
