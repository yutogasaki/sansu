import './AnswerCells.css';

/** Every character stays blank until entered, including the decimal point. */
export function AnswerCells({ shape, value, active = false }: { shape: string; value: string; active?: boolean }) {
    const next = [...shape].findIndex((_, i) => !value[i]);
    return <span className="answer-cells" data-answer-shape={shape} role="group" aria-label={`こたえ ${value || '未入力'}`}>
        {[...shape].map((cell, i) => cell === '.'
            ? <span key={i} className="answer-cells-point answer-cell" data-active={active && next === i} data-filled={Boolean(value[i])}>{value[i] || '□'}</span>
            : <span key={i} className="answer-cell" data-active={active && next === i} data-filled={Boolean(value[i])}>{value[i] || '□'}</span>)}
    </span>;
}
