import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IslandPlacement } from './IslandItems';
import type { IslandFurniturePlacementResult } from './islandFurniturePlacement';

const noop = () => {};
function render(status: IslandFurniturePlacementResult['status'], valid = true) {
    return renderToStaticMarkup(<IslandPlacement item={{ id: 'telescope', kind: 'telescope', rotation: Math.PI, position: { x: -1, z: 2.5 } }}
        valid={valid} disabled={false} onPoint={noop} onRotate={noop} onSave={noop} onStore={noop} onCancel={noop} onFindUsable={noop} onArrangeSurroundings={noop}
        availability={{ key: 'preview', itemId: 'telescope', residentId: 'otter', status }} />);
}
describe('optional furniture placement keeps choosing and saving distinct', () => {
    it('allows a legal decorative placement while explaining that the selected resident cannot use it', () => {
        const markup = render('blocked');
        expect(markup).toContain('ここには おけるけれど、つかうには すきまが いるよ。');
        expect(markup).toMatch(/class="island-primary"><svg[^]*?ここに おく/);
        expect(markup).toContain('つかえる ばしょを さがす');
        expect(markup).toContain('みつかった ばしょを みてから');
    });
    it('does not claim an occupied placement can be saved', () => {
        const markup = render('blocked', false);
        expect(markup).toContain('ここには おけないよ。');
        expect(markup).not.toContain('ここには おけるけれど');
        expect(markup).toMatch(/class="island-primary" disabled=""/);
    });
    it('distinguishes a pending search from an exhausted search and leaves manual movement available', () => {
        const searching = render('searching');
        expect(searching).toContain('なかまが つかえる ばしょを さがしているよ。');
        expect(searching).toMatch(/class="island-secondary" disabled=""/);
        expect(searching).toMatch(/aria-label="ひだりへ"><svg/);
        expect(searching).not.toContain('まわりの ものを うごかす');
        const done = render('no-space');
        expect(done).toContain('つかえる ばしょが みつからなかったよ。');
        expect(done).toMatch(/class="island-secondary">つかえる ばしょを さがす/);
        expect(done).toContain('まわりの ものを うごかす');
        expect(done).toContain('いまの ばしょえらびは やめて、もちものを ひらくよ。どうぐは のこるよ。');
        expect(render('ready')).toContain('えらんだ なかまが、ここで つかえるよ。');
    });
});
