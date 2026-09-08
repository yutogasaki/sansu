import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IslandStageProps } from './three/types';

const stages = vi.hoisted(() => [] as IslandStageProps[]);
vi.mock('./IslandStage', () => ({ default: (props: IslandStageProps) => { stages.push(props); return <figure />; } }));
import IslandWelcome from './IslandWelcome';

describe('profile-free Island welcome', () => {
    beforeEach(() => { stages.length = 0; });
    it('offers the actual flower and lamp plus one learning entry before any required setup field', () => {
        const markup = renderToStaticMarkup(<IslandWelcome onStart={() => undefined} />);
        expect(markup).toContain('data-mode="welcome"');
        expect(markup).toContain('data-onboarding-world="island"');
        expect(markup).toContain('data-onboarding-candidate="island-touch-first-v1"');
        expect(markup).toContain('おはな');
        expect(markup).toContain('あかり');
        expect(markup).toContain('まなぶ');
        expect(markup).not.toContain('<input');
        expect(markup).not.toContain('おうちのひと');
        expect(markup).not.toContain('ひとつ とくと');
    });
    it('shows the same initial growth scenery as the first island without a persistence callback', () => {
        renderToStaticMarkup(<IslandWelcome onStart={() => undefined} />);
        expect(stages).toHaveLength(1);
        expect(stages[0].growth?.progress).toEqual({ garden: 0, waterside: 0, grove: 0, village: 0 });
        expect(stages[0].items.every(item => item.growthLevel === 0)).toBe(true);
        expect(stages[0].onDiscovery).toBeUndefined();
        expect(stages[0].onItemSelect).toBeTypeOf('function');
        expect(stages[0].learning).toBe(false);
        expect(stages[0].readOnly).toBeUndefined();
    });
});
