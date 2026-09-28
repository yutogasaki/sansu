import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TenKey } from './TenKey';
import { Button } from '../ui/Button';

vi.mock('./answerConfirmGuidance', () => ({
    useAnswerConfirmationDemonstrated: () => false,
    acknowledgeAnswerConfirmation: vi.fn(),
}));

type KeyProps = { 'aria-label': string; disabled?: boolean; onClick: () => void; children?: ReactNode };
function keypad(extra: Partial<Parameters<typeof TenKey>[0]> = {}) {
    const props = { onInput: vi.fn(), onDelete: vi.fn(), onClear: vi.fn(), onEnter: vi.fn(),
        layout: 'compact-three' as const, confirmationMode: 'automatic' as const, ...extra };
    const tree = TenKey(props) as ReactElement;
    const keys: KeyProps[] = [];
    const visit = (node: ReactNode) => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!isValidElement<KeyProps>(node)) return;
        if (node.type === Button) keys.push(node.props);
        else visit(node.props.children);
    };
    visit(tree);
    return { props, keys, labels: keys.map(key => key['aria-label']),
        key: (label: string) => keys.find(key => key['aria-label'] === label)!,
        html: () => renderToStaticMarkup(tree) };
}
const everyday = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'ひとつ もどす', '0', 'こたえを けす'];

describe('compact Island keypad', () => {
    it('keeps the twelve everyday keys in reading and tab order without a redundant submit key', () => {
        const h = keypad();
        expect(h.labels).toEqual(everyday);
        expect(h.html()).toContain('data-keypad-layout="compact-three"');
        expect(h.html()).not.toContain('data-keypad-submit');
        h.key('2').onClick(); h.key('0').onClick();
        h.key('ひとつ もどす').onClick(); h.key('こたえを けす').onClick();
        expect(h.props.onInput).toHaveBeenNthCalledWith(1, 2);
        expect(h.props.onInput).toHaveBeenNthCalledWith(2, 0);
        expect(h.props.onDelete).toHaveBeenCalledOnce();
        expect(h.props.onClear).toHaveBeenCalledOnce();
        expect(h.props.onEnter).not.toHaveBeenCalled();
    });
    it('retains decimal and fraction field controls after the standard twelve keys', () => {
        const move = vi.fn();
        const h = keypad({ showDecimal: true, onCursorMove: move, nextFieldLabel: 'つぎの欄へ' });
        expect(h.labels).toEqual([...everyday, 'カーソルを ひだりへ', 'しょうすうてん', 'つぎの欄へ']);
        h.key('しょうすうてん').onClick(); h.key('カーソルを ひだりへ').onClick(); h.key('つぎの欄へ').onClick();
        expect(h.props.onInput).toHaveBeenCalledWith('.');
        expect(move.mock.calls).toEqual([['left'], ['right']]);
        expect(keypad({ onCursorMove: move, nextFieldLabel: 'つぎの欄へ', nextFieldDisabled: true }).key('つぎの欄へ').disabled).toBe(true);
    });
    it('keeps explicit confirmation when a manual answer or save retry requires it', () => {
        const h = keypad({ confirmationMode: 'manual', enterLabel: 'このだんを たしかめる' });
        expect(h.labels).toEqual([...everyday, 'このだんを たしかめる']);
        h.key('このだんを たしかめる').onClick();
        expect(h.props.onEnter).toHaveBeenCalledOnce();
        expect(keypad({ confirmationMode: 'manual', enterDisabled: true }).key('こたえる').disabled).toBe(true);
    });
    it('fits decimal, cursor and manual confirmation in one auxiliary row', () => {
        const h = keypad({ showDecimal: true, onCursorMove: vi.fn(), nextFieldLabel: 'つぎの欄へ', confirmationMode: 'manual' });
        expect(h.labels).toEqual([...everyday, 'カーソルを ひだりへ', 'しょうすうてん', 'つぎの欄へ', 'こたえる']);
        const html = h.html();
        expect(html.match(/class="ten-key-extra-controls/g)).toHaveLength(1);
        expect(html).toContain('grid-template-columns:repeat(4, minmax(44px, 1fr))');
        h.key('こたえる').onClick();
        expect(h.props.onEnter).toHaveBeenCalledOnce();
    });
    it('does not add cursor controls to a written grid and preserves disabled controls', () => {
        const h = keypad({ writtenInput: true, onCursorMove: vi.fn(), showDecimal: true, disabled: true });
        expect(h.labels).toEqual([...everyday, 'しょうすうてん']);
        expect(h.keys.every(key => key.disabled)).toBe(true);
    });
    it('leaves the shared standard keypad four-column ordering and submit control intact', () => {
        const h = keypad({ layout: 'standard' });
        expect(h.labels).toEqual(['7', '8', '9', 'こたえを けす', '4', '5', '6', 'ひとつ もどす', '1', '2', '3', '0', 'こたえる']);
        expect(h.html()).toContain('grid-cols-4');
    });
});
