import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { reduceIslandExperience } from '../../domain/island/experience';
import { IslandExperiencePanel } from './IslandExperiencePanel';

describe('saved-scene disclosure semantics', () => {
    it('links the delete confirmation toggle to its confirmation group', () => {
        const island = reduceIslandExperience(createIsland('child', 1), { type: 'save-layout', layoutId: 'slot-1', name: 'ひかりの にわ' }, 2);
        const html = renderToStaticMarkup(<IslandExperiencePanel island={island} disabled={false} initialTab="layouts"
            onAction={async () => true} onPreview={() => undefined} onPhoto={() => undefined} onView={() => undefined} onClose={() => undefined} />);
        const removeButton = html.match(/<button class="island-icon-button"[^>]*>/)?.[0];
        expect(removeButton).toContain('aria-expanded="false"');
        expect(removeButton).toContain('aria-controls="island-layout-delete-slot-1"');
        expect(html).not.toContain('id="island-layout-delete-slot-1"');
    });
});
