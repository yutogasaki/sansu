import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandCustomization } from '../../domain/island/customization';
import { getIslandExpression, ISLAND_EXPRESSION_CATALOG, reduceIslandExpression } from '../../domain/island/expression';
import { reduceIslandRewardGoal, type IslandRewardGoalTarget } from '../../domain/island/rewardGoal';
import { IslandRewardGoal, IslandRewardGoalChoice, IslandRewardGoalFeedback } from './IslandRewardGoal';
import { IslandExpression, type IslandExpressionProps } from './IslandExpression';
import { IslandFurniture } from './IslandFurniture';

const base = () => { const island = createIsland('child', 1); island.customization = { ...getIslandCustomization(island), points: 0 }; return island; };
const controls = () => ({ action: vi.fn(async () => true) });
const noop = () => undefined;
function expressionProps(island = base()): IslandExpressionProps {
    return { island, disabled: false, pending: false, previewSelection: getIslandExpression(island).selection,
        soundEnabled: false, soundStatus: 'off', onAction: async () => true, onPreview: noop, onFocusResident: noop,
        onVisit: noop, onListen: noop, onClose: noop, onLearn: noop, onSaveScene: noop };
}
describe('cross-category goal visibility and deliberate selection', () => {
    it('renders no empty home goal and opens the exact saved target in every category', () => {
        expect(IslandRewardGoal({ island: base(), disabled: false, onOpen: noop })).toBeNull();
        const targets: IslandRewardGoalTarget[] = [{ category: 'customization', itemId: 'candy-house' },
            { category: 'furniture', kind: 'tea-table' }, { category: 'expression', itemId: 'shell-three-notes' }];
        for (const target of targets) {
            const island = reduceIslandRewardGoal(base(), { type: 'choose', target }), before = structuredClone(island), onOpen = vi.fn();
            const tree = IslandRewardGoal({ island, disabled: false, onOpen })!; tree.props.onClick();
            expect(onOpen).toHaveBeenCalledTimes(1); expect(onOpen).toHaveBeenCalledWith(target);
            const html = renderToStaticMarkup(tree); expect(html).toContain(`data-reward-goal-category="${target.category}"`);
            expect(island).toEqual(before);
        }
    });
    it.each(ISLAND_EXPRESSION_CATALOG.filter(item => item.price === 0))('shows the real condition for unqualified $itemId while allowing a free goal', item => {
        const target = { category: 'expression', itemId: item.itemId } as const, island = reduceIslandRewardGoal(base(), { type: 'choose', target });
        const home = renderToStaticMarkup(<IslandRewardGoal island={island} disabled={false} onOpen={noop} />);
        expect(home).not.toContain('もらえるよ'); expect(home).not.toContain('こうかん できるよ');
        expect(home).toContain(item.requirement === 'bell' ? 'かいの おとを みとどける' : item.requirement === 'leaf-bird' ? 'ことりを みつける' : 'ちょうを みつける');
        const html = renderToStaticMarkup(<IslandExpression {...expressionProps(island)} initialItemId={item.itemId} rewardGoal={controls()} />);
        expect(html).toContain(`data-expression-item="${item.itemId}"`);
        expect(html).toContain(`data-expression-tab="${item.slot === 'soundscape' ? 'world' : item.slot === 'pattern' ? 'friends' : 'memories'}"`);
        expect(html.match(/<button[^>]*data-reward-goal-action="clear"[^>]*>/)?.[0]).not.toContain('disabled');
        expect(html.match(/<button[^>]*data-expression-action="acquire"[^>]*>/)?.[0]).toContain('disabled');
        expect(html.match(/<button[^>]*data-expression-action="learn"[^>]*>/)?.[0]).not.toContain('disabled');
    });
    it('chooses and clears only the goal action, and offers no goal for owned products', () => {
        const action = controls(), target = { category: 'expression', itemId: 'raincoat' } as const;
        IslandRewardGoalChoice({ island: base(), target, controls: action, disabled: false })!.props.onClick();
        expect(action.action).toHaveBeenLastCalledWith({ type: 'choose', target });
        const selected = reduceIslandRewardGoal(base(), { type: 'choose', target });
        IslandRewardGoalChoice({ island: selected, target, controls: action, disabled: false })!.props.onClick();
        expect(action.action).toHaveBeenLastCalledWith({ type: 'clear' });
        const rich = base(); rich.customization!.points = 25;
        expect(IslandRewardGoalChoice({ island: reduceIslandExpression(rich, { type: 'acquire', itemId: 'raincoat' }), target, controls: action, disabled: false })).toBeNull();
    });
    it('offers a furniture goal at zero points and keeps ordinary learning/close available during an uncertain goal receipt', () => {
        const props = { island: base(), kind: 'hammock' as const, residents: [{ id: 'rabbit' as const, name: 'うさぎ' }],
            residentId: 'rabbit' as const, partnerId: 'otter' as const, disabled: false, pending: false,
            onSelect: noop, onResident: noop, onPartner: noop, onTry: noop, onPurchase: noop, onPlace: noop, onInventory: noop, onClose: noop, onLearn: noop };
        const html = renderToStaticMarkup(<IslandFurniture {...props} rewardGoal={controls()} />);
        expect(html).toContain('これが ほしい'); expect(html).toContain('あと 25 ほし');
        const pending = { ...controls(), pending: { type: 'choose' as const, target: { category: 'furniture' as const, kind: 'hammock' as const } }, error: 'きろくを たしかめよう。', retry: async () => true };
        const retry = renderToStaticMarkup(<IslandFurniture {...props} rewardGoal={pending} />);
        expect(retry.match(/<button[^>]*data-reward-goal-action="choose"[^>]*>/)?.[0]).toContain('disabled');
        expect(retry).toContain('ほしいものの きろくを たしかめる');
        expect(retry.match(/<button[^>]*aria-label="どうぐから もどる"[^>]*>/)?.[0]).not.toContain('disabled');
        expect(retry).toContain('>まなぶ ');
        expect(renderToStaticMarkup(<IslandRewardGoalFeedback controls={pending} disabled={false} />)).toContain('data-reward-goal-action="retry"');
    });
});
