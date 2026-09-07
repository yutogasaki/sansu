import { parkHissanGrid } from '../../domain/park/learning';
import type { LearningSlot } from '../../domain/park/types';
import { IslandChoiceLabel } from './IslandProblemPrompt';
import { islandLearningGuidance } from './learningGuidance';

const hissanGuide = {
    addition: 'おなじ くらいを たそう。10の まとまりは、となりの くらいへ。',
    subtraction: 'おなじ くらいを ひこう。ひけないときは、となりから 10を もらおう。',
    multiplication: 'ひとつずつ かけて、くりあがりも あわせよう。',
    division: 'かけて、ひいて、つぎの くらいへ すすもう。',
};

export function IslandLearningSupport({ slot }: { slot: LearningSlot }) {
    const problem = slot.problem;
    const grid = parkHissanGrid(problem);
    const step = grid?.steps[slot.hissanStep ?? 0];
    const inputOrder = step && step.inputCellIndices.length > 1
        ? (step.inputCellIndices[0] > step.inputCellIndices[step.inputCellIndices.length - 1] ? 'みぎの マスから' : 'ひだりの マスから') : 'ひかる マスに';
    const guidance = grid ? { text: hissanGuide[grid.operation] } : islandLearningGuidance(problem);
    const answer = problem.displayAnswer ?? (Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join(' / ') : problem.correctAnswer);
    return <div className="island-learning-support" data-support-kind={grid ? grid.operation : guidance?.example ? 'worked-example' : 'guide'}>
        <p><strong>{guidance ? 'ヒント' : 'いっしょに たしかめよう'}</strong>{guidance && <> {guidance.text}</>}</p>
        {guidance && 'example' in guidance && guidance.example && <p className="island-support-example">{guidance.example}</p>}
        <p>{step ? `${inputOrder} ${step.correctValues.join('、')}を いれよう。`
            : <>こたえは <IslandChoiceLabel choice={{ label: answer, value: answer }} problem={problem} />。たしかめて、いれてみよう。</>}</p>
    </div>;
}
