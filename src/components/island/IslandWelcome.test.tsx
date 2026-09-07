import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import IslandWelcome from './IslandWelcome';

describe('profile-free Island welcome', () => {
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
});
