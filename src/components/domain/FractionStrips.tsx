import type { ProblemVisual } from '../../domain/types';

export const FractionStrips = ({ visual }: { visual: Extract<ProblemVisual, { kind: 'fraction-strips' }> }) => (
    <div className="mx-auto grid w-full max-w-sm gap-2" data-visual-surface="fraction-strips">
        {visual.groups.map((group, index) => (
            <div key={index} className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
                <div className="text-sm font-bold leading-tight text-slate-600">{group.label}</div>
                <div role="img" aria-label={`1を${group.parts}等分したうち${group.filled}こぶん`}
                    data-parts={group.parts} data-filled={group.filled}
                    className="grid h-8 w-full overflow-hidden rounded-lg border-2 border-slate-500 bg-white"
                    style={{ gridTemplateColumns: `repeat(${group.parts}, minmax(0, 1fr))` }}>
                    {Array.from({ length: group.parts }, (_, cell) => (
                        <span key={cell} aria-hidden="true" data-filled-cell={cell < group.filled}
                            className={`flex items-center justify-center border-r border-slate-500 text-sm last:border-r-0 ${cell < group.filled ? 'bg-indigo-200 text-indigo-950' : 'bg-white'}`}>
                            {cell < group.filled ? '●' : ''}
                        </span>
                    ))}
                </div>
            </div>
        ))}
    </div>
);
