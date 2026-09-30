import type { SubjectKey } from '../../domain/types';

export function finishStudyPath(subject: SubjectKey) {
    return `/study?session=finish-test&focus_subject=${subject}&back_to=%2Flearn`;
}
