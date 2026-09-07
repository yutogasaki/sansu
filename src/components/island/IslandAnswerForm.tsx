import { useState } from 'react';
import { LearningAnswerForm, type LearningAnswerFormProps } from '../domain/LearningAnswerForm';
import type { IslandLearningSlot } from '../../domain/island/types';
import { islandSupportStage } from '../../domain/island/learningSupport';
import { IslandChoiceLabel, IslandProblemPrompt } from './IslandProblemPrompt';
import { IslandLearningSupport } from './IslandLearningSupport';
import './IslandAnswerForm.css';

export function IslandAnswerForm({ slot, disabled, onAnswer, answerReceiptId }: Pick<LearningAnswerFormProps, 'disabled' | 'onAnswer'> & {
    slot: IslandLearningSlot;
    answerReceiptId?: string;
}) {
    const stage = islandSupportStage(slot);
    // A saved answer clears the old entry synchronously before the next ready
    // paint. Help receipts do not replace that key or discard the child's draft.
    const [lastAnswerReceipt, setLastAnswerReceipt] = useState(answerReceiptId);
    if (answerReceiptId && answerReceiptId !== lastAnswerReceipt) setLastAnswerReceipt(answerReceiptId);
    const model = stage === 'model';
    return <div className="island-answer-stage" data-support-stage={stage ?? 'none'}>
        <LearningAnswerForm key={lastAnswerReceipt ?? 'initial'} slot={slot} disabled={disabled || model}
        onAnswer={answer => { if (!disabled && !model) onAnswer(answer); }} className="island-answer" resetCursorOnClear
        renderPrompt={problem => <IslandProblemPrompt problem={problem} />}
        renderSupport={() => <IslandLearningSupport slot={slot} />}
        renderSupportAnswer={(answer, problem) => <IslandChoiceLabel choice={{ label: answer, value: answer }} problem={problem} />}
        renderChoiceLabel={(choice, problem) => <IslandChoiceLabel choice={choice} problem={problem} showReferenceVisual />} />
    </div>;
}
