import type { CSSProperties } from 'react';
import type { HissanGridProps } from './HissanGrid';
import { writtenAutomaticValues } from '../../domain/math/writtenInput';
import { writtenPlaceValue, type PlaceDigit } from '../../domain/math/writtenPlaceValue';
import './WrittenArithmeticGrid.css';

export function PlaceValueArithmeticGrid({ gridData, currentStepIndex, activeCellPos, userValues, onCellClick, disabled, correcting, stepFeedback = 'none' }: HissanGridProps) {
    const model = writtenPlaceValue(gridData);
    const step = gridData.steps[0];
    const automatic = writtenAutomaticValues(step);
    const division = gridData.operation === 'division';
    const row = (digits: PlaceDigit[], label: string, result = false, dividend = false) => <div className="written-row" data-current={result} data-dividend={dividend}>
        <span className="written-row-label" data-operator={!result}>{label}</span>
        <div className="written-digits">{digits.map(digit => {
            const index = digit.sourceColumn === undefined ? -1 : step.inputCellIndices.indexOf(digit.sourceColumn);
            const editable = result && index >= 0 && !automatic[index];
            const value = editable ? userValues.get(`${step.rowIndex}-${digit.sourceColumn}`) ?? '' : digit.value;
            const active = editable && activeCellPos?.[0] === step.rowIndex && activeCellPos[1] === digit.sourceColumn;
            return <span className="written-place" key={digit.column} style={{ gridColumn: digit.column + 1 }} data-padding={digit.padding}>
                {editable ? <button type="button" className="written-cell" data-active={active}
                    data-written-input={`${step.rowIndex}-${digit.sourceColumn}`} aria-label={`答え 左から${digit.column + 1}けた目${value ? ` ${value}` : ''}`}
                    disabled={disabled || stepFeedback !== 'none' || currentStepIndex > 0} onClick={() => onCellClick(step.rowIndex, digit.sourceColumn!)}>
                    {value || <span className="written-placeholder">·</span>}
                </button> : <span className="written-cell">{value}</span>}
                {digit.point && <span className="written-decimal" aria-label="小数点">.</span>}
            </span>;
        })}</div>
    </div>;
    return <div className="written-arithmetic written-place-value" data-written-operation={gridData.operation} style={{ '--written-columns': model.columns } as CSSProperties}>
        {model.normalization && <div className="written-normalization">{model.normalization}<small>どちらも同じだけ小数点をうごかす</small></div>}
        <div className="written-paper" style={division ? { '--written-label-width': `${Math.max(42, model.divisor.length * 20 + 12)}px` } as CSSProperties : undefined}>
            {division ? <>{row(model.result, '商', true)}{row(model.operands[0], model.divisor, false, true)}</> : <>
                {row(model.operands[0], '')}{row(model.operands[1], gridData.operation === 'addition' ? '+' : gridData.operation === 'subtraction' ? '−' : '×')}
                <div className="written-rule" />{row(model.result, '答え', true)}
            </>}
        </div>
        <div className="written-input-guide"><span>{correcting ? 'あいた ところを なおそう' : '左から いれよう'}</span><span>小数点は じどう</span></div>
    </div>;
}
