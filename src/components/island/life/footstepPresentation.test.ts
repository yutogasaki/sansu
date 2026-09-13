import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { makeFootstepPresentation, type FootstepInput } from './footstepPresentation';
import { buildLifeScene } from './scene';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';

it('uses actual grounded moving feet, never emits while stopped, and bounds trail lifetime and ownership', () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const s = replayLife(newLife('test', 0)); s.footstepMagicVersion = 1; s.target = 'bench';
    s.items = [{ id: 'lamp', kind: 'lantern', cell: { x: 2, z: 3 }, growth: 0, style: 'original' },
        { id: 'bench', kind: 'bench', cell: { x: 5, z: 2 }, growth: 0, style: 'original' }];
    s.residents[0].visit = { itemId: 'bench', from: { x: 2, z: 1 }, path: [{ x: 2, z: 1 }, { x: 3, z: 1 }, { x: 4, z: 1 }, { x: 4, z: 2 }, { x: 4, z: 3 }, { x: 5, z: 3 }], start: 0, end: 30000 };
    const before = structuredClone(s), content = buildLifeScene(s), scene = new T.Scene(); scene.add(content.root);
    const node = { dataset: {} } as HTMLElement;
    const controller = makeFootstepPresentation(scene, new T.PerspectiveCamera(), node, { profileId: () => 'test', presented: () => {} });
    const input: FootstepInput = { profileId: 'test', id: 'walk', targetId: 'bench', source: 'replay' };
    const stamps = () => scene.getObjectByName('life-star-footprints')!.children.filter(s => s.visible);
    const frame = (worldAt: number, at: number, enabled = true, request = input) => {
        content.animate(worldAt, true); controller.update(content, content.snapshot(), request, at, enabled, true);
    };
    try {
        frame(0, 0); expect(stamps()).toHaveLength(0);
        frame(600, 600); expect(stamps().length).toBeGreaterThan(0);
        const positions = stamps().map(p => p.position.clone());
        for (const p of positions) expect(content.feet().some(f => f.point.distanceTo(p) < 1e-8)).toBe(true);
        frame(600, 2700); expect(stamps()).toHaveLength(0);
        frame(1800, 2800); expect(stamps().length).toBeGreaterThan(0);
        frame(2000, 7000); expect(stamps()).toHaveLength(0);
        frame(1500, 7600, true, { ...input, id: 'other', profileId: 'other' }); expect(stamps()).toHaveLength(0);
        const again = { ...input, id: 'again' };
        frame(600, 8000, true, again); frame(1800, 8300, true, again); expect(stamps().length).toBeGreaterThan(0);
        controller.update(content, { ...content.snapshot(), expanded: 'west' }, again, 8400, true, true);
        expect(stamps()).toHaveLength(0); expect(node.dataset.footstepMagic).toBeUndefined();
        expect(s).toEqual(before);
    } finally { controller.dispose(); content.dispose(); vi.unstubAllGlobals(); }
});
