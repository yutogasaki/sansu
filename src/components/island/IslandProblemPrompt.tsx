import type { ChoiceOption, Problem, ProblemVisualItem } from '../../domain/types';
import { MathProblemPrompt } from '../domain/MathProblemPrompt';
import { IslandGlyph } from './IslandGlyph';
import { splitIslandLabel } from './islandGlyphs';
import { islandReferenceChoices } from './islandReferenceChoices';

const renderItem = (item: ProblemVisualItem) => <IslandGlyph symbol={item.emoji} label={item.label} />;

export function IslandProblemPrompt({ problem }: { problem: Problem }) {
    const reference = islandReferenceChoices(problem) && problem.questionVisual?.kind === 'reference-choice-grid'
        ? problem.questionVisual : undefined;
    return <div className="island-problem-prompt" data-problem-visual={problem.questionVisual?.kind ?? 'symbolic'} data-subject={problem.subject}>
        {problem.subject === 'vocab' && <svg className="island-word-seal" viewBox="0 0 48 36" aria-hidden="true" focusable="false">
            <rect x="4" y="4" width="40" height="28" rx="4" fill="#eadbb8" />
            <path d="m5 6 19 15L43 6M5 31l13-12m25 12L30 19" fill="none" stroke="#c1a879" strokeWidth="2" />
            <path d="M24 18q0-10 9-8-1 9-9 8" fill="#71916b" />
        </svg>}
        {reference ? <div className="island-prompt-content island-reference-prompt">
            <div data-visual-surface="reference-grid" className="island-reference-target">
                {renderItem(reference.grid.reference)}
                <span>おてほん</span>
            </div>
            <p data-visual-caption>{reference.prompt || 'おなじ ものは？'}</p>
        </div> : <MathProblemPrompt problem={problem} className="island-prompt-content" renderItem={renderItem} />}
    </div>;
}

export function IslandChoiceLabel({ choice, problem, showReferenceVisual = false }: {
    choice: ChoiceOption; problem: Problem; showReferenceVisual?: boolean;
}) {
    // A vocabulary illustration would reveal a new clue. Its labels stay plain words.
    if (problem.subject === 'vocab') return <span>{choice.label}</span>;
    const parts = splitIslandLabel(choice.label);
    const referenceItems = showReferenceVisual ? islandReferenceChoices(problem) : undefined;
    const choiceIndex = problem.inputConfig?.choices?.findIndex(option => option.value === choice.value && option.label === choice.label) ?? -1;
    const item = referenceItems?.[choiceIndex];
    return <span className="island-choice-label">{item && !parts.some(part => part.kind === 'glyph')
        && <><IslandGlyph symbol={item.emoji} decorative />{' '}</>}{parts.map((part, index) => part.kind === 'glyph'
        ? <IslandGlyph key={index} symbol={part.value} decorative />
        : <span key={index}>{part.value}</span>)}</span>;
}
