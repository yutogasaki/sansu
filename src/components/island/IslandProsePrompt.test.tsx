import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IslandProsePrompt } from './IslandProsePrompt';

describe('Japanese learning prose', () => {
    it.each([
        ['きょり 420 km を 7 じかん。はやさは？', ['420 km', '7 じかん。', 'はやさは？']],
        ['はやさ 60 km/h で 2 じかん。きょりは？', ['60 km/h', '2 じかん。']],
        ['2.5 L と 300 mL。\nあわせて？', ['2.5 L', '300 mL。']],
    ])('preserves the exact saved text and unit groups: %s', (text, groups) => {
        const html = renderToStaticMarkup(<IslandProsePrompt text={text} />);
        expect(html.replace(/<[^>]*>/g, '')).toBe(text);
        for (const group of groups) expect(html).toContain(`>${group}</span>`);
    });
});
