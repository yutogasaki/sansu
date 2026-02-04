import React from "react";
import { Button } from "../ui/Button";
import { Icons } from "../icons";
import { cn } from "../../utils/cn";

interface TenKeyProps {
    onInput: (val: number | string) => void;
    onDelete: () => void;
    onEnter: () => void;
    onClear: () => void;
    showDecimal?: boolean;
    onCursorMove?: (direction: "left" | "right") => void;
}

export const TenKey: React.FC<TenKeyProps> = ({
    onInput,
    onDelete,
    onEnter,
    onClear,
    showDecimal = false,
    onCursorMove
}) => {
    // 共通ボタンスタイル
    // 共通ボタンスタイル
    const baseBtnClass = "h-full w-full text-2xl font-bold bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all text-slate-700 land:text-xl mobile:text-base";
    const actionBtnClass = "h-full w-full text-xl font-bold bg-slate-50 rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all text-slate-400";

    return (
        <div className="h-full w-full min-h-0 grid grid-cols-4 gap-3 p-3 mobile:gap-2 mobile:p-2" style={{ gridTemplateRows: 'repeat(4, 1fr)' }}>
            {/* Row 1 */}
            <Button onClick={() => onInput(7)} className={baseBtnClass} variant="ghost">7</Button>
            <Button onClick={() => onInput(8)} className={baseBtnClass} variant="ghost">8</Button>
            <Button onClick={() => onInput(9)} className={baseBtnClass} variant="ghost">9</Button>
            <Button
                onClick={onClear}
                className={cn(baseBtnClass, "text-lg font-medium text-red-500 bg-red-50/50 border-red-100 mobile:text-sm")}
                variant="ghost"
            >
                C
            </Button>

            {/* Row 2 */}
            <Button onClick={() => onInput(4)} className={baseBtnClass} variant="ghost">4</Button>
            <Button onClick={() => onInput(5)} className={baseBtnClass} variant="ghost">5</Button>
            <Button onClick={() => onInput(6)} className={baseBtnClass} variant="ghost">6</Button>
            <Button
                onClick={onDelete}
                className={cn(baseBtnClass, "text-lg font-medium text-slate-400 bg-slate-50")}
                variant="ghost"
            >
                <Icons.Backspace className="w-6 h-6 mobile:w-5 mobile:h-5" />
            </Button>

            {/* Row 3 */}
            <Button onClick={() => onInput(1)} className={baseBtnClass} variant="ghost">1</Button>
            <Button onClick={() => onInput(2)} className={baseBtnClass} variant="ghost">2</Button>
            <Button onClick={() => onInput(3)} className={baseBtnClass} variant="ghost">3</Button>
            {showDecimal ? (
                <Button onClick={() => onInput(".")} className={baseBtnClass} variant="ghost">.</Button>
            ) : (
                <div /> /* Empty cell for alignment */
            )}

            {/* Row 4 */}
            <Button
                onClick={() => onCursorMove?.("left")}
                className={actionBtnClass}
                disabled={!onCursorMove}
                variant="ghost"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </Button>
            <Button onClick={() => onInput(0)} className={baseBtnClass} variant="ghost">0</Button>
            <Button
                onClick={() => onCursorMove?.("right")}
                className={actionBtnClass}
                disabled={!onCursorMove}
                variant="ghost"
            >
                <Icons.ArrowRight className="w-6 h-6" />
            </Button>

            {/* Enter Key */}
            <Button
                onClick={onEnter}
                className="h-full w-full rounded-2xl bg-violet-600 text-white shadow-md border-2 border-violet-500 active:scale-95 hover:bg-violet-700 transition-all flex flex-col items-center justify-center mobile:text-base"
                variant="ghost"
            >
                <Icons.Check className="w-10 h-10 mobile:w-8 mobile:h-8 drop-shadow-md" strokeWidth={3} />
            </Button>
        </div>
    );
};
