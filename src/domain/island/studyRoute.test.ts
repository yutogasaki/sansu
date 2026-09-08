import { describe, expect, it } from 'vitest';
import { islandStudyDestination } from './studyRoute';

describe('island practice routing', () => {
    it.each(['', '?session=normal'])('opens native island practice for %s', search => {
        expect(islandStudyDestination(search, true)).toBe('/island?start=learn');
    });

    it.each([
        '?session=review&force_review=1',
        '?session=weak&focus_subject=math&focus_ids=add_1',
        '?session=weak-review',
        '?session=periodic-test',
        '?session=check-normal',
        '?session=check-event',
        '?session=dev&benchmark=cold-open-fixed-ten-v1',
        '?session=normal&focus_subject=vocab',
        '?focus_ids=add_1',
        '?force_review=1',
        '?back_to=/stats',
        '?session=normal&session=review',
        '?future_scope=1',
    ])('preserves explicit Study intent: %s', search => {
        expect(islandStudyDestination(search, true)).toBeUndefined();
    });

    it('keeps classic normal practice when the island delivery is disabled', () => {
        expect(islandStudyDestination('', false)).toBeUndefined();
        expect(islandStudyDestination('?session=normal', false)).toBeUndefined();
    });
});
