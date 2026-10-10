import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildHome } from './homeGeometry';
import { ROOF_COLORS, STYLE_ROOF } from './plotParts';
import type { PlotStyle } from '../../../domain/growingIsland';

const paint = (color: string) => new T.MeshStandardMaterial({ color });
const styles: PlotStyle[] = ['plain', 'water', 'tree', 'flower', 'light'];

describe('native cottage vocabulary with existing home progression', () => {
    it('keeps a front ground-floor doorway at every built stage and a full-width second floor only at stage four', () => {
        for (const style of styles) for (const stage of [2, 3, 4]) {
            const home = buildHome(paint, stage, style);
            home.updateMatrixWorld(true);
            const door = home.getObjectByName('home-door')!;
            const doorBounds = new T.Box3().setFromObject(door);
            const wallBounds = new T.Box3().setFromObject(home.getObjectByName('home-ground-floor')!);
            expect(doorBounds.min.y).toBeGreaterThanOrEqual(0);
            expect(doorBounds.max.y).toBeLessThan(wallBounds.max.y);
            expect(Math.abs(doorBounds.getCenter(new T.Vector3()).x)).toBeLessThan(.01);
            expect(doorBounds.min.z).toBeGreaterThanOrEqual(wallBounds.max.z);
            const upper = home.getObjectByName('home-upper-floor');
            expect(Boolean(upper)).toBe(stage === 4);
            if (upper) {
                const upperSize = new T.Box3().setFromObject(upper).getSize(new T.Vector3());
                const lowerSize = wallBounds.getSize(new T.Vector3());
                expect(upperSize.x / lowerSize.x).toBeGreaterThan(.94);
                expect(upperSize.z / lowerSize.z).toBeGreaterThan(.94);
            }
        }
    });
    it('keeps saved roof colours while using distinct folded, scalloped and curled outlines', () => {
        for (const style of styles) for (const choice of [0, 1, 3, 5]) {
            const home = buildHome(paint, 4, style, choice);
            const roof = home.getObjectByName(style === 'water' ? 'home-scalloped-cap' : style === 'tree' ? 'home-folded-leaf-roof' : 'home-curled-gable') as T.Mesh;
            expect(roof).toBeDefined();
            expect((roof.material as T.MeshStandardMaterial).color.getHexString()).toBe(new T.Color(choice ? ROOF_COLORS[choice] : STYLE_ROOF[style]).getHexString());
            expect(home.getObjectByName('home-door')).toBeDefined();
            const points = roof.geometry.getAttribute('position');
            for (let i = 0; i < points.count; i++) expect([points.getX(i), points.getY(i), points.getZ(i)].every(Number.isFinite)).toBe(true);
        }
        for (const stage of [0, 1]) {
            const home = buildHome(paint, stage, 'plain');
            expect(home.getObjectByName('home-door')).toBeUndefined();
            expect(home.getObjectByName('home-upper-floor')).toBeUndefined();
        }
    });
});
