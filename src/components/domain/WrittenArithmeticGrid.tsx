import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { HissanGridProps } from './HissanGrid';
import './WrittenArithmeticGrid.css';

const phaseLabels = {
    multiply: 'かける', sum: 'あわせる', quotient: 'たてる',
    subtract: 'ひく', 'bring-down': 'おろす', remainder: 'あまり',
};

/** A written calculation retains the paper's places while the keypad owns input. */
export function WrittenArithmeticGrid({ gridData, currentStepIndex, activeCellPos, userValues,
    onCellClick, stepFeedback = 'none', correcting = false, disabled = false }: HissanGridProps) {
    const layout = gridData.writtenLayout!;
    // The legacy coordinate model reserves a full operator column. Put × in
    // the row label so its empty cells do not shrink the child's digit targets.
    const columnOffset = layout.kind === 'multiplication' ? 1 : 0;
    const step = gridData.steps[currentStepIndex];
    const historyRef = useRef<HTMLDivElement>(null);
    const currentRowRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const history = historyRef.current;
        const row = currentRowRef.current;
        if (!history) return;
        // Scroll only the written-work history, never the page or keypad.
        if (row && history.contains(row)) history.scrollTop = Math.max(0, row.offsetTop + row.offsetHeight - history.clientHeight);
        else history.scrollTop = history.scrollHeight;
    }, [currentStepIndex, gridData]);

    const renderRow = (rowIndex: number) => {
        const row = gridData.rows[rowIndex];
        if ((row.visibleFromStep ?? 0) > currentStepIndex) return null;
        if (row.type === 'separator') return <div className="written-rule" key={rowIndex} aria-hidden="true" />;
        const current = step?.rowIndex === rowIndex;
        const dividend = layout.kind === 'division' && rowIndex === layout.dividendRow;
        const quotient = layout.kind === 'division' && rowIndex === layout.quotientRow;
        return <div key={rowIndex} ref={current ? currentRowRef : undefined} className="written-row"
            data-row={rowIndex} data-current={current} data-dividend={dividend} data-quotient={quotient}
            data-line-above={row.lineAbove || undefined}>
            <span className="written-row-label" data-operator={row.type === 'operator' || undefined}>
                {dividend ? layout.divisor : row.type === 'operator' ? '×' : row.label}</span>
            <div className="written-digits">
                {row.cells.map((cell, column) => {
                    if (column < columnOffset) return null;
                    const index = current ? step.inputCellIndices.indexOf(column) : -1;
                    const editable = index >= 0;
                    const completed = gridData.steps.some(previous => previous.index < currentStepIndex
                        && previous.rowIndex === rowIndex && previous.inputCellIndices.includes(column));
                    const future = cell.correctValue !== undefined && !editable && !completed;
                    const value = userValues.get(`${rowIndex}-${column}`) ?? cell.value;
                    const active = editable && activeCellPos?.[0] === rowIndex && activeCellPos[1] === column;
                    const focus = step?.focusCells?.some(([r, c]) => r === rowIndex && c === column);
                    const className = 'written-cell';
                    const style = dividend && column === layout.dividendStartColumn ? { borderLeft: '2px solid var(--written-ink)' } : undefined;
                    const props = { className, style, 'data-active': active, 'data-completed': completed,
                        'data-focus': focus || undefined, 'data-empty': !value && !editable, 'data-future': future || undefined };
                    if (!editable) return <span key={column} {...props}>{future ? '' : value}</span>;
                    return <button key={column} {...props} type="button" disabled={disabled || stepFeedback !== 'none'}
                        aria-label={`${row.label || 'こたえ'}、ひだりから ${column + 1 - columnOffset} マスめ${value ? `、${value}` : '、から'}`}
                        aria-pressed={active} data-written-input={`${rowIndex}-${column}`}
                        onClick={() => onCellClick(rowIndex, column)}>
                        {value || <span className="written-placeholder" aria-hidden="true">{active ? '▏' : '·'}</span>}
                    </button>;
                })}
            </div>
        </div>;
    };

    const pinned = layout.kind === 'division'
        ? [layout.quotientRow!, layout.dividendRow!]
        : gridData.rows.map((row, index) => row.type === 'operand' || row.type === 'operator' ? index : -1).filter(index => index >= 0);
    const direction = step && step.inputCellIndices.length > 1
        ? step.inputCellIndices[0] > step.inputCellIndices[step.inputCellIndices.length - 1] ? '← みぎから' : 'ひだりから →'
        : 'ここに いれよう';
    return <section className="written-arithmetic" aria-label={`${layout.expression} のひっさん`}
        data-written-operation={layout.kind} data-written-step={currentStepIndex} data-written-phase={step?.phase}
        data-written-correction={correcting}
        style={{ '--written-columns': gridData.columnCount - columnOffset } as CSSProperties}>
        <div className="written-heading"><span>{layout.expression}</span><span className="written-kind">ひっさん</span></div>
        <div className="written-guidance" aria-live="polite" aria-atomic="true">
            <strong>{step?.phase ? phaseLabels[step.phase] : 'こたえ'}</strong>
            <span>{step?.hint || step?.description}</span>
        </div>
        <div className="written-paper">
            <div className="written-pinned">{pinned.map(renderRow)}</div>
            <div className="written-history" ref={historyRef} tabIndex={0} aria-label="ここまでの ひっさん">
                {gridData.rows.map((_, index) => pinned.includes(index) ? null : renderRow(index))}
            </div>
        </div>
        <div className="written-input-guide"><span>{direction}</span>
            <span>{correcting ? 'あいたマスを なおそう' : stepFeedback === 'incorrect' ? 'このだんを もういちど' : 'マスを おすと なおせるよ'}</span></div>
    </section>;
}
