import { expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import type { IslandMaterials } from '../three/primitives';
import { newIsland } from '../../../domain/growingIsland/island';
import { catalogPictureMaker } from './catalogPictures';
import { miniaturePicture } from './menuMiniatures';
vi.mock('./menuMiniatures', () => ({ miniaturePicture: vi.fn(() => 'data:image/png;base64,test') }));
vi.mock('./plotGeometry', () => ({ buildPlot: vi.fn(() => ({})) }));
vi.mock('./objectLayer', () => ({ landmarkModel: vi.fn(() => ({})) }));
vi.mock('./keepsakeGeometry', () => ({ buildKeepsake: vi.fn(() => ({})) }));

it('renders one stored miniature for 100 duplicates and switches owner after placing one', () => {
    const make = catalogPictureMaker({} as WebGLRenderer, {} as IslandMaterials);
    const state = newIsland('miniature-stack', 0); state.plots = []; state.landmarks = []; state.keepsakes = [];
    make(state);
    const baseline = vi.mocked(miniaturePicture).mock.calls.length;
    state.landmarks = Array.from({ length: 100 }, (_, i) => ({ id: `bench-${i}`, kind: 'bench', growth: 0 }));
    const pictures = make(state);
    expect(vi.mocked(miniaturePicture).mock.calls.length - baseline).toBe(baseline + 1);
    expect(Object.keys(pictures).filter(id => id.startsWith('bench-'))).toEqual(['bench-0']);
    state.landmarks[0].cell = { x: 0, z: 0 };
    const next = make(state);
    expect(next['bench-0']).toBeUndefined(); expect(next['bench-1']).toBeDefined();
});
