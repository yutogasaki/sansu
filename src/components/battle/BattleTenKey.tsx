import React from "react";
import { cn } from "../../utils/cn";

interface BattleTenKeyProps {
    onInput: (val: number | string) => void;
    onDelete: () => void;
    onEnter: () => void;
    showDecimal?: boolean;
    disabled?: boolean;
}

export const BattleTenKey: React.FC<BattleTenKeyProps> = ({
    onInput,
    onDelete,
    onEnter,
    showDecimal = false,
    disabled = false,
}) => {
    const numBtn = "h-full w-full text-xl font-bold bg-white rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-all text-slate-700 disabled:opacity-40";
    const actBtn = "h-full w-full text-lg font-bold rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-all disabled:opacity-40";

    return (
        <div
            className="h-full w-full grid grid-cols-3 gap-1.5 p-1.5"
            style={{ gridTemplateRows: "repeat(4, 1fr)" }}
        >
            {/* Row 1: 7 8 9 */}
            {[7, 8, 9].map((n) => (
                <button key={n} disabled={disabled} onClick={() => onInput(n)} className={numBtn}>{n}</button>
            ))}
            {/* Row 2: 4 5 6 */}
            {[4, 5, 6].map((n) => (
                <button key={n} disabled={disabled} onClick={() => onInput(n)} className={numBtn}>{n}</button>
            ))}
            {/* Row 3: 1 2 3 */}
            {[1, 2, 3].map((n) => (
                <button key={n} disabled={disabled} onClick={() => onInput(n)} className={numBtn}>{n}</button>
            ))}
            {/* Row 4: ⌫/. 0 ✓ */}
            {showDecimal ? (
                <button disabled={disabled} onClick={() => onInput(".")} className={cn(actBtn, "text-slate-500 bg-slate-50")}>.</button>
            ) : (
                <button disabled={disabled} onClick={onDelete} className={cn(actBtn, "text-red-400 bg-red-50/50 border-red-100")}>
                    <span className="text-base">&#x232B;</span>
                </button>
            )}
            <button disabled={disabled} onClick={() => onInput(0)} className={numBtn}>0</button>
            <button
                disabled={disabled}
                onClick={onEnter}
                className="h-full w-full rounded-xl bg-violet-600 text-white shadow-md border-2 border-violet-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </button>
        </div>
    );
};
