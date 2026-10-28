import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newIsland, FLOWER_COLORS, type FlowerColor } from '../../../domain/growingIsland';
import { FlowerBook } from './FlowerBook';
import { FLOWER_NAME } from './flowerGeometry';

const render = (colors: FlowerColor[]) => {
    const state = newIsland('flower-book-test', 0);
    state.flowerBook = colors;
    return renderToStaticMarkup(<FlowerBook state={state} onClose={() => {}} />);
};
describe('flower collection visibility', () => {
    it('keeps all eleven unknown targets without revealing their colors', () => {
        const html = render([]);
        expect(html).toContain('0/11');
        expect(html.match(/<li /g)).toHaveLength(11);
        expect(html).not.toContain('ならべてみよう');
        expect(html).not.toContain('data-known="true"');
    });
    it('retains parent hints and accounts for every known and unknown target', () => {
        const html = render(['red', 'yellow']);
        expect(html.match(/data-known="true"/g)).toHaveLength(2);
        expect(html.match(/ならべてみよう/g)).toHaveLength(1);
        expect(html.match(/<li /g)).toHaveLength(8);
        expect(html).toContain('ほかにも 8しゅるい');
        expect(html).not.toContain(FLOWER_NAME.orange);
    });
    it('shows the completed collection without unknown placeholders', () => {
        const html = render([...FLOWER_COLORS]);
        expect(html).toContain('11/11');
        expect(html.match(/data-known="true"/g)).toHaveLength(11);
        expect(html).not.toContain('growing-flower-unknown');
    });
});
