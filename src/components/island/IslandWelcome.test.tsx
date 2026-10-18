import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import IslandWelcome from './IslandWelcome';

describe('profile-free Island welcome', () => {
    it('offers the approved companion and island entry before any learning setup', () => {
        const markup = renderToStaticMarkup(<IslandWelcome onStart={() => undefined} />);
        expect(markup).toContain('data-mode="welcome"');
        expect(markup).toContain('data-onboarding-world="island"');
        expect(markup).toContain('data-onboarding-candidate="island-first-play-v2"');
        expect(markup).toMatch(/data-island-feature-enabled="(?:true|false)"/);
        expect(markup).toContain('icons/icon-512.png');
        expect(markup).toContain('ぽこもこに あいさつ');
        expect(markup).toContain('しまへ いく');
        expect(markup).not.toContain('<input');
        expect(markup).not.toContain('<canvas');
        expect(markup).not.toContain('おうちのひと');
    });
    it('keeps the existing additional-profile entry label and prevents duplicate entry while saving', () => {
        const markup = renderToStaticMarkup(<IslandWelcome onStart={() => undefined} actionLabel="はじめる" />);
        expect(markup).toContain('はじめる');
        expect(markup).not.toContain('しまへ いく');
        const saving = renderToStaticMarkup(<IslandWelcome onStart={() => undefined} busy error="ほぞんできなかったよ" />);
        expect(saving).toContain('disabled=""');
        expect(saving).toContain('しまを ひらいているよ…');
        expect(saving).toContain('role="alert"');
    });
});
