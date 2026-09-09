import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandCustomization } from '../../domain/island/customization';
import { getIslandExpression, previewIslandExpression, reduceIslandExpression } from '../../domain/island/expression';
import { IslandExpression, type IslandExpressionProps } from './IslandExpression';

function base(points: number): IslandExpressionProps {
    const island = createIsland('child', 1);
    island.customization = { ...getIslandCustomization(island), points };
    const noop = () => undefined;
    return { island, disabled: false, pending: false, previewSelection: getIslandExpression(island).selection,
        soundEnabled: false, soundStatus: 'off', onAction: async () => true, onPreview: noop, onFocusResident: noop,
        onVisit: noop, onListen: noop, onClose: noop, onLearn: noop, onSaveScene: noop };
}
const button = (html: string, action: string) => html.match(new RegExp(`<button[^>]*data-expression-action="${action}"[^>]*>`))?.[0];

describe('expression acquisition and learning exits', () => {
    it('marks the free preview actually shown, retains the saved setting, and restores its marker on cancel', () => {
        for (const action of [{ type: 'period', period: 'morning' }, { type: 'season', season: 'winter' }] as const) {
            const props = { ...base(0), initialItemId: 'shell-three-notes' as const }, before = structuredClone(props.island);
            const preview = previewIslandExpression(props.island, action), attribute = `data-expression-${action.type}`;
            const value = action.type === 'period' ? action.period : action.season;
            const selectedButton = (html: string, choice: string) => html.match(new RegExp(`<button[^>]*${attribute}="${choice}"[^>]*>`))?.[0];
            const html = renderToStaticMarkup(<IslandExpression {...props} previewAction={preview.action} previewSelection={preview.selection} />);
            expect(selectedButton(html, value)).toContain('aria-pressed="true"');
            expect(selectedButton(html, 'default')).toContain('aria-pressed="false"');
            expect(html).toContain(`おためし：${action.type === 'period' ? 'あさ' : 'ふゆ'}`);
            expect(html).toContain('いまの しま：いつもの');
            expect(button(html, 'apply-free')).not.toContain('disabled');
            const cancelled = renderToStaticMarkup(<IslandExpression {...props} />);
            expect(selectedButton(cancelled, 'default')).toContain('aria-pressed="true"');
            expect(selectedButton(cancelled, value)).toContain('aria-pressed="false"');
            expect(button(cancelled, 'apply-free')).toBeUndefined();
            expect(props.island).toEqual(before);
        }
    });
    it('shows a saved free setting as current, while a trial of the default remains explicitly uncommitted', () => {
        const props = { ...base(0), initialItemId: 'shell-three-notes' as const };
        props.island = reduceIslandExpression(props.island, { type: 'season', season: 'winter' });
        props.previewSelection = getIslandExpression(props.island).selection;
        const before = structuredClone(props.island), preview = previewIslandExpression(props.island, { type: 'season', season: null });
        const html = renderToStaticMarkup(<IslandExpression {...props} previewAction={preview.action} previewSelection={preview.selection} />);
        expect(html.match(/<button[^>]*data-expression-season="default"[^>]*>/)?.[0]).toContain('aria-pressed="true"');
        expect(html.match(/<button[^>]*data-expression-season="winter"[^>]*>/)?.[0]).toContain('aria-pressed="false"');
        expect(html).toContain('おためし：いつもの'); expect(html).toContain('いまの しま：ふゆ');
        expect(props.island).toEqual(before);
    });
    it('allows a free real preview with no points while keeping acquisition unavailable and learning reachable', () => {
        const props = base(0), before = structuredClone(props.island);
        const preview = previewIslandExpression(props.island, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' });
        const html = renderToStaticMarkup(<IslandExpression {...props} previewSelection={preview.selection} previewAction={preview.action} />);
        expect(button(html, 'preview')).not.toContain('disabled');
        expect(button(html, 'acquire')).toContain('disabled');
        expect(button(html, 'equip')).toBeUndefined();
        expect(button(html, 'learn')).not.toContain('disabled');
        expect(html).toContain('あと 25 ほし'); expect(props.island).toEqual(before);
    });
    it('offers a separate equip action after purchase, then shows removal only when actually equipped', () => {
        const props = base(25);
        props.island = reduceIslandExpression(props.island, { type: 'acquire', itemId: 'raincoat' });
        props.previewSelection = getIslandExpression(props.island).selection;
        const acquired = renderToStaticMarkup(<IslandExpression {...props} />);
        expect(button(acquired, 'acquire')).toBeUndefined(); expect(button(acquired, 'equip')).not.toContain('disabled');
        expect(button(acquired, 'remove')).toBeUndefined();
        props.island = reduceIslandExpression(props.island, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' });
        props.previewSelection = getIslandExpression(props.island).selection;
        const equipped = renderToStaticMarkup(<IslandExpression {...props} />);
        expect(button(equipped, 'equip')).toContain('disabled'); expect(button(equipped, 'remove')).not.toContain('disabled');
    });
    it('retains the close and learning exits during an uncertain saved result while blocking a new purchase', () => {
        const props = base(100);
        const html = renderToStaticMarkup(<IslandExpression {...props} pending error="きろくを たしかめよう。" onRetry={() => undefined} />);
        expect(button(html, 'acquire')).toContain('disabled'); expect(button(html, 'learn')).not.toContain('disabled');
        expect(html.match(/<button[^>]*aria-label="みじたくから もどる"[^>]*>/)?.[0]).not.toContain('disabled');
        expect(html).toContain('きろくを たしかめる');
    });
});
