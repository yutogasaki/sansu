import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { generateWrittenArithmeticGrid } from '../../domain/math/writtenArithmetic';
import { HissanGrid } from './HissanGrid';

function render(question: string, answer: string | string[], index: number) {
    const gridData = generateWrittenArithmeticGrid(question, answer)!;
    const userValues = new Map<string, string>();
    for (const step of gridData.steps.slice(0, index)) step.inputCellIndices.forEach((column, i) => {
        userValues.set(`${step.rowIndex}-${column}`, step.correctValues[i]);
    });
    const step = gridData.steps[index];
    return renderToStaticMarkup(<HissanGrid gridData={gridData} currentStepIndex={index}
        activeCellPos={[step.rowIndex, step.inputCellIndices[0]]} userValues={userValues} onCellClick={() => {}} />);
}

describe('written arithmetic presentation', () => {
    it('keeps future partial-product and total rows out of the initial surface', () => {
        const html = render('999 × 99 =', '98901', 0);
        expect(html).toContain('data-row="2"');
        expect(html).not.toContain('data-row="3"');
        expect(html).not.toContain('98901');
        expect(html).not.toContain('8991');
        expect(html.match(/data-written-input=/g)).toHaveLength(4);
    });
    it('retains earlier quotient digits while making only the current quotient place editable', () => {
        const html = render('816 ÷ 8 =', '102', 6);
        expect(html).toContain('data-written-input="0-2"');
        expect(html).not.toContain('data-written-input="0-0"');
        expect(html).not.toContain('data-written-input="0-1"');
        expect(html).toContain('data-completed="true"');
        expect(html).not.toContain('data-row="8"');
        expect(html).not.toContain('data-row="9"');
    });
    it('labels the final remainder separately from the quotient and keeps its controls accessible', () => {
        const html = render('899 ÷ 9 =', ['99', '8'], 5);
        expect(html).toContain('あまり');
        expect(html).toContain('data-quotient="true"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain('type="button"');
        expect(html).not.toContain('>8</button>');
    });

    it('makes compact division ask for the next quotient instead of the calculation rows', () => {
        const gridData = generateWrittenArithmeticGrid('816 ÷ 8 =', '102', { divisionInput: 'compact' })!;
        const userValues = new Map<string, string>();
        const firstStep = gridData.steps[0];
        firstStep.inputCellIndices.forEach((column, index) => {
            userValues.set(`${firstStep.rowIndex}-${column}`, firstStep.correctValues[index]);
        });
        const step = gridData.steps[1];
        const html = renderToStaticMarkup(<HissanGrid gridData={gridData} currentStepIndex={1}
            activeCellPos={[step.rowIndex, step.inputCellIndices[0]]} userValues={userValues} onCellClick={() => {}} />);
        expect(html).toContain('data-written-input-mode="compact"');
        expect(html).toContain('商を いれよう');
        expect(html).toContain('けいさんの行は 自動でうまるよ');
        expect(html).toContain('data-written-input="0-1"');
        expect(html).not.toContain('data-written-input="2-0"');
        const completed = renderToStaticMarkup(<HissanGrid gridData={gridData} currentStepIndex={2}
            activeCellPos={null} userValues={new Map([['0-0', '1'], ['0-1', '0'], ['0-2', '2']])}
            stepFeedback="correct" onCellClick={() => {}} />);
        expect(completed).toContain('data-row="9"');
    });
});
