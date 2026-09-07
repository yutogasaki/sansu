import type { ChoiceOption, Problem, ProblemVisualItem } from '../../domain/types';
import { MathProblemPrompt } from '../domain/MathProblemPrompt';
import { IslandGlyph } from './IslandGlyph';
import { splitIslandLabel } from './islandGlyphs';

const renderItem = (item: ProblemVisualItem) => <IslandGlyph symbol={item.emoji} label={item.label} />;

export function IslandProblemPrompt({ problem }: { problem: Problem }) {
    return <div className="island-problem-prompt" data-problem-visual={problem.questionVisual?.kind ?? 'symbolic'} data-subject={problem.subject}>
        {problem.subject === 'vocab' && <svg className="island-word-seal" viewBox="0 0 48 36" aria-hidden="true" focusable="false">
            <rect x="4" y="4" width="40" height="28" rx="4" fill="#eadbb8" />
            <path d="m5 6 19 15L43 6M5 31l13-12m25 12L30 19" fill="none" stroke="#c1a879" strokeWidth="2" />
            <path d="M24 18q0-10 9-8-1 9-9 8" fill="#71916b" />
        </svg>}
        <MathProblemPrompt problem={problem} className="island-prompt-content" renderItem={renderItem} />
    </div>;
}

export function IslandChoiceLabel({ choice, problem }: { choice: ChoiceOption; problem: Problem }) {
    // A vocabulary illustration would reveal a new clue. Its labels stay plain words.
    if (problem.subject === 'vocab') return <span>{choice.label}</span>;
    return <span className="island-choice-label">{splitIslandLabel(choice.label).map((part, index) => part.kind === 'glyph'
        ? <IslandGlyph key={index} symbol={part.value} decorative />
        : <span key={index}>{part.value}</span>)}</span>;
}
