import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberFieldsLayout } from './NumberFieldsLayout';

describe('saved multi-number field presentation', () => {
    it.each([
        [['分子', '分母'], 'fraction'],
        [['整数', '分子', '分母'], 'mixed'],
        [['商', 'あまり'], undefined],
        [['分母', '分子'], undefined],
    ])('preserves field order for %j', (labels, layout) => {
        const html = renderToStaticMarkup(<NumberFieldsLayout fields={labels.map(label => ({ label }))}>
            {labels.map(label => <button key={label}>{label}</button>)}
        </NumberFieldsLayout>);
        if (layout) expect(html).toContain(`data-number-layout="${layout}"`);
        else expect(html).not.toContain('data-number-layout');
        expect(html.match(/<button>.*?<\/button>/g)).toEqual(labels.map(label => `<button>${label}</button>`));
    });
});
