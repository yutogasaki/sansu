import { parkHissanGrid } from '../../domain/park/learning';
import type { IslandLearningSlot } from '../../domain/island/types';
import { islandSupportStage } from '../../domain/island/learningSupport';
import { HissanGrid } from '../domain/HissanGrid';
import { IslandChoiceLabel, IslandProblemPrompt } from './IslandProblemPrompt';
import { islandLearningGuidance } from './learningGuidance';

const hissanGuide = {
    addition: 'おなじ くらいを たそう。10の まとまりは、となりの くらいへ。',
    subtraction: 'おなじ くらいを ひこう。ひけないときは、となりから 10を もらおう。',
    multiplication: 'ひとつずつ かけて、くりあがりも あわせよう。',
    division: 'かけて、ひいて、つぎの くらいへ すすもう。',
};

export function IslandLearningSupport({ slot }: { slot: IslandLearningSlot }) {
    const problem = slot.problem;
    const grid = parkHissanGrid(problem);
    const stage = islandSupportStage(slot);
    if (!stage) return null;
    const guidance = grid ? { text: hissanGuide[grid.operation] } : islandLearningGuidance(problem);
    const answer = problem.displayAnswer ?? (Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join(' / ') : problem.correctAnswer);
    if (stage === 'hint') return <div className="island-learning-support" data-support-kind="hint">
        <p><strong>ヒント</strong> {guidance?.text ?? 'わかっている ところから、ためしてみよう。'}</p>
    </div>;
    // These are presentation-only values. The child's saved/draft Hissan values
    // stay in the disabled form; none of the model's cells are submitted.
    const modelValues = new Map<string, string>();
    grid?.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
        if (cell.correctValue !== undefined) modelValues.set(`${r}-${c}`, cell.correctValue);
    }));
    return <div className="island-learning-support island-support-model" data-support-kind={grid ? grid.operation : 'model'}>
        <p><strong>おてほん</strong>{guidance && <> {guidance.text}</>}</p>
        {grid ? <HissanGrid gridData={grid} currentStepIndex={grid.steps.length} activeCellPos={null}
            userValues={modelValues} disabled onCellClick={() => undefined} /> : <>
            <IslandProblemPrompt problem={problem} />
            {guidance && 'example' in guidance && guidance.example && <p className="island-support-example">{guidance.example}</p>}
            <p className="island-support-answer">こたえは <IslandChoiceLabel choice={{ label: answer, value: answer }} problem={problem} />。</p>
        </>}
    </div>;
}
