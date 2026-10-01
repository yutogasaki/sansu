import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GuidanceEvidence, Plot, Villager } from '../../../domain/growingIsland';
import { GrowingGuideArt } from './GrowingGuideArt';

const plot: Plot = { id: 'home-1', kind: 'home', cell: { x: 1, z: 0 }, plantedAt: 0, builtAt: 6, stage: 1, style: 'plain', growth: 0, origin: 'seed', paid: 4, roof: 3 };
const render = (id: 'A1' | 'A2' | 'A3', evidence: GuidanceEvidence) => renderToStaticMarkup(createElement(GrowingGuideArt, { id, evidence }));

describe('growing guide memory illustrations', () => {
    it('keeps the recorded roof and tent when the current house is repainted and grows', () => {
        const evidence: GuidanceEvidence = { source: 'open', snapshot: { flagColor: 0, target: structuredClone(plot) } };
        const current = { ...plot, roof: 1, stage: 3 };
        const picture = render('A2', evidence);
        expect(current.roof).toBe(1);
        expect(picture).toContain('fill="#5f9ec4"');
        expect(picture).toContain('M0 108 42 28l47 80Z');
        expect(picture).not.toContain('M10 41 70 36');
    });
    it('uses the recorded flag colour independently of its current appearance', () => {
        const picture = render('A3', { source: 'flag', targetId: 'flag', snapshot: { flagColor: 2 } });
        expect(picture).toContain('fill="#e0b454"');
        expect(picture).not.toContain('fill="#5f9ec4"');
    });
    it('draws the actual remembered resident species rather than always a rabbit', () => {
        const friend: Villager = { id: 'v1', species: 'otter', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'mellow', home: 'home-1', arrivedAt: 1 };
        const picture = render('A1', { source: 'disembark', snapshot: { flagColor: 0, target: friend } });
        expect(picture).toContain('fill="#7d5236"');
        expect(picture).not.toContain('rotate(-12 -10 -38)');
    });
});
