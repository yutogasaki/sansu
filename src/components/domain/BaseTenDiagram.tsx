import type { BaseTenBlocks } from '../../domain/types';

export function baseTenFrame(groups: BaseTenBlocks[]) {
    return {
        width: Math.max(12, ...groups.map(b => Math.min(2, b.hundreds) * 12 + (b.tens ? Math.min(5, b.tens) * 2 + 2 : 0) + (b.ones ? 7 : 0))),
        height: Math.max(12, ...groups.map(b => Math.max(Math.ceil(b.hundreds / 2), Math.ceil(b.tens / 5)) * 12)),
    };
}

/** Every square is the same unit, including the grid inside a rod or a plate. */
export function BaseTenDiagram({ blocks, frame = baseTenFrame([blocks]) }: { blocks: BaseTenBlocks; frame?: { width: number; height: number } }) {
    const { hundreds, tens, ones } = blocks;
    const plateColumns = Math.min(2, hundreds), rodColumns = Math.min(5, tens);
    const plateWidth = plateColumns ? plateColumns * 12 : 0;
    const rodWidth = rodColumns ? rodColumns * 2 + 2 : 0;
    const cell = (x: number, y: number, key: string) => <rect key={key} x={x} y={y} width="1" height="1" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="0.12" />;
    return <svg role="img" aria-label={`100の板${hundreds}まい、10のぼう${tens}本、1のマス${ones}こ`}
        data-base-ten-diagram data-hundreds={hundreds} data-tens={tens} data-ones={ones}
        className="mx-auto block w-full max-w-sm text-slate-700" style={{ maxHeight: 'var(--base-ten-max-height, 156px)' }} viewBox={`-0.5 -0.5 ${frame.width + 1} ${frame.height + 1}`}>
        {Array.from({ length: hundreds }, (_, i) => <g key={`h${i}`} data-base-ten-unit="100">
            {Array.from({ length: 100 }, (_, j) => cell(i % 2 * 12 + j % 10, Math.floor(i / 2) * 12 + Math.floor(j / 10), `h${j}`))}
        </g>)}
        {Array.from({ length: tens }, (_, i) => <g key={`t${i}`} data-base-ten-unit="10">
            {Array.from({ length: 10 }, (_, j) => cell(plateWidth + i % 5 * 2, Math.floor(i / 5) * 12 + j, `t${j}`))}
        </g>)}
        {Array.from({ length: ones }, (_, i) => <g key={`o${i}`} data-base-ten-unit="1">
            {cell(plateWidth + rodWidth + i % 3 * 2, Math.floor(i / 3) * 2, 'one')}
        </g>)}
    </svg>;
}

export function BaseTenExchangeGuide() {
    return <div className="grid grid-cols-3 items-center gap-1 text-center text-sm" aria-label="10のまとまりの関係">
        <div><BaseTenDiagram frame={{ width: 12, height: 12 }} blocks={{ hundreds: 0, tens: 0, ones: 1 }} />1</div>
        <div><BaseTenDiagram frame={{ width: 12, height: 12 }} blocks={{ hundreds: 0, tens: 1, ones: 0 }} />1が10こで 10</div>
        <div><BaseTenDiagram frame={{ width: 12, height: 12 }} blocks={{ hundreds: 1, tens: 0, ones: 0 }} />10が10こで 100</div>
    </div>;
}
