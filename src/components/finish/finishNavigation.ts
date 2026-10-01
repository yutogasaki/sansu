import type { SubjectKey } from '../../domain/types';

export function finishStudyPath(subject: SubjectKey) {
    return `/study?session=finish-test&focus_subject=${subject}&back_to=%2Flearn`;
}

export function finishRecoveryStudyPath(subject: SubjectKey, itemIds: readonly string[]) {
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (!ids.length) return '/learn';
    const params = new URLSearchParams({ session: 'review', focus_subject: subject,
        focus_ids: ids.join(','), force_review: '1', back_to: '/learn' });
    return `/study?${params.toString()}`;
}
