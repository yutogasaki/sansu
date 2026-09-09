import { parkHissanGrid } from '../../domain/park/learning';
import type { IslandLearningSlot } from '../../domain/island/types';
import { islandSupportStage } from '../../domain/island/learningSupport';
import { HissanGrid } from '../domain/HissanGrid';
import { IslandChoiceLabel, IslandProblemPrompt } from './IslandProblemPrompt';
import { islandLearningGuidance } from './learningGuidance';
import type { HissanStep } from '../../domain/math/hissanTypes';

const hissanGuide = {
    addition: '右はしから、上下の 数を たそう。10以上なら、左へ 1を くりあげるよ。',
    subtraction: '右はしから、上の 数から 下の 数を ひこう。ひけないときは 左の位から かりよう。',
    multiplication: '下の 数の 右はしから、上の 数に かけよう。くりあがりも たすよ。',
    division: 'わられる 数の 左から みよう。わる 数が いくつ はいるかな。',
};

const stepGuide: Record<NonNullable<HissanStep['phase']>, string> = {
    multiply: '一の位から 1けたずつ かけよう。10以上なら 一の位を かき、十の位の 数を 次の位の かけ算に たすよ。',
    sum: '同じ位の 数を 上下に たそう。10以上なら 一の位を かき、十の位の 数を 左の位に たすよ。',
    quotient: 'わる数を 1倍、2倍…して、いま 見ている数を こえない いちばん大きい かける数を さがそう。',
    subtract: '上の 数から、いま かけて 出した数を ひこう。ひけない位は 左から かりよう。',
    'bring-down': 'まだ 使っていない 次の数字を、のこりの 右となりへ おろそう。',
    remainder: 'のこった 数が あまりだよ。わる数より 小さいか たしかめよう。',
};

export function IslandLearningSupport({ slot }: { slot: IslandLearningSlot }) {
    const problem = slot.problem;
    const grid = parkHissanGrid(problem);
    const stage = islandSupportStage(slot);
    if (!stage) return null;
    const phase = grid?.steps[slot.hissanStep ?? 0]?.phase;
    const guidance = grid ? { text: stage === 'hint'
        ? phase === 'multiply' && grid.operation === 'division'
            ? 'たてた 商と わる数を かけよう。その数を 上の数から ひいて、のこりを 調べるよ。'
            : phase ? stepGuide[phase] : hissanGuide[grid.operation]
        : hissanGuide[grid.operation] } : islandLearningGuidance(problem);
    const answer = problem.displayAnswer ?? (Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join(' / ') : problem.correctAnswer);
    if (stage === 'hint') return <div className="island-learning-support" data-support-kind="hint">
        <p><strong>ヒント</strong> {guidance?.text ?? '「おてほんを みる」で、こたえを たしかめられるよ。'}</p>
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
