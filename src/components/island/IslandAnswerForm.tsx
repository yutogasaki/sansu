import { LearningAnswerForm, type LearningAnswerFormProps } from '../domain/LearningAnswerForm';
import { IslandChoiceLabel, IslandProblemPrompt } from './IslandProblemPrompt';
import { IslandLearningSupport } from './IslandLearningSupport';
import './IslandAnswerForm.css';

export function IslandAnswerForm(props: Pick<LearningAnswerFormProps, 'slot' | 'disabled' | 'onAnswer'>) {
    return <LearningAnswerForm {...props} className="island-answer" resetCursorOnClear
        renderPrompt={problem => <IslandProblemPrompt problem={problem} />}
        renderSupport={slot => <IslandLearningSupport slot={slot} />}
        renderSupportAnswer={(answer, problem) => <IslandChoiceLabel choice={{ label: answer, value: answer }} problem={problem} />}
        renderChoiceLabel={(choice, problem) => <IslandChoiceLabel choice={choice} problem={problem} />} />;
}
