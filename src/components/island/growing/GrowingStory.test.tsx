import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { experienceFixture } from '../../../prototypes/placeQa/experienceFixture';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { StoryView } from './GrowingPanels';

it('keeps the first story without photos and only offers a current place while its original owners remain usable', () => {
    const state = experienceFixture('forest'), place = derivePlaces(state).find(place => place.ruleId === 'P01')!;
    state.placeProgress!.milestones.P01 = { at: 10, ruleId: 'P01', anchorId: place.anchorId, memberIds: [...place.memberIds], variant: place.variant, revision: place.revision };
    const render = () => renderToStaticMarkup(<StoryView state={state} moments={[]} onClose={vi.fn()} onFocus={vi.fn()} />);
    expect(render()).toContain('森が そだったよ');
    expect(render()).toContain('aria-label="森の 今の場所を みる"');
    for (const owner of state.landmarks) if (place.mainIds.includes(owner.id)) owner.cell = undefined;
    const stored = render();
    expect(stored).toContain('森が そだったよ');
    expect(stored).not.toContain('今の場所を みる');
    expect(state.placeProgress!.milestones.P01.memberIds).toEqual(place.memberIds);
});
