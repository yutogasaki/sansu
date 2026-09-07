import { LearningAnswerForm, type LearningAnswerFormProps } from '../domain/LearningAnswerForm';

export function ParkAnswerForm(props: Pick<LearningAnswerFormProps, 'slot' | 'disabled' | 'onAnswer'>) {
    return <LearningAnswerForm {...props} />;
}
