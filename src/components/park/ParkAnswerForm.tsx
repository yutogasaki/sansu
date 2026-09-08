import { LearningAnswerForm, type LearningAnswerFormProps } from '../domain/LearningAnswerForm';

export function ParkAnswerForm(props: Pick<LearningAnswerFormProps, 'slot' | 'disabled' | 'onAnswer' | 'retryAnswer'>) {
    return <LearningAnswerForm {...props} />;
}
