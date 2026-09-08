import { useState } from 'react';
import { LearningAnswerForm, type LearningAnswerFormProps } from '../domain/LearningAnswerForm';
import type { IslandLearningSlot } from '../../domain/island/types';
import { islandSupportStage } from '../../domain/island/learningSupport';
import { IslandChoiceLabel, IslandProblemPrompt } from './IslandProblemPrompt';
import { IslandLearningSupport } from './IslandLearningSupport';
import { playSound } from '../../utils/audio';
import { useIslandSpeech } from './useIslandSpeech';
import { IslandSpeechControl } from './IslandSpeechControl';
import './IslandAnswerForm.css';

export function IslandAnswerForm({ slot, disabled, onAnswer, answerReceiptId, retryAnswer, onInteraction, englishAutoRead = false }: Pick<LearningAnswerFormProps, 'disabled' | 'onAnswer' | 'onInteraction' | 'retryAnswer'> & {
    slot: IslandLearningSlot;
    answerReceiptId?: string;
    englishAutoRead?: boolean;
}) {
    const stage = islandSupportStage(slot);
    const speech = useIslandSpeech(slot.problem.subject === 'vocab' ? slot.problem.questionText : undefined, englishAutoRead, disabled);
    // A saved answer clears the old entry synchronously before the next ready
    // paint. Help receipts do not replace that key or discard the child's draft.
    const [lastAnswerReceipt, setLastAnswerReceipt] = useState({ id: answerReceiptId, retryAnswer });
    if (answerReceiptId && answerReceiptId !== lastAnswerReceipt.id) setLastAnswerReceipt({ id: answerReceiptId, retryAnswer });
    const model = stage === 'model';
    return <div className="island-answer-stage" data-support-stage={stage ?? 'none'}>
        <LearningAnswerForm key={lastAnswerReceipt.id ?? 'initial'} slot={slot} disabled={disabled || model}
        retryAnswer={lastAnswerReceipt.retryAnswer}
        onInteraction={() => { playSound('tap'); onInteraction?.(); }}
        onAnswer={answer => { if (!disabled && !model) onAnswer(answer); }} className="island-answer" resetCursorOnClear
        renderPrompt={problem => <IslandProblemPrompt problem={problem}
            speechControl={problem.subject === 'vocab' ? <IslandSpeechControl speech={speech} disabled={disabled} /> : undefined} />}
        renderSupport={() => <IslandLearningSupport slot={slot} />}
        renderSupportAnswer={(answer, problem) => <IslandChoiceLabel choice={{ label: answer, value: answer }} problem={problem} />}
        renderChoiceLabel={(choice, problem) => <IslandChoiceLabel choice={choice} problem={problem} showReferenceVisual />} />
    </div>;
}
