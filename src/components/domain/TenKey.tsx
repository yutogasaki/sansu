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
    compact?: boolean;
}

export const TenKey: React.FC<TenKeyProps> = ({
    onInput,
    onDelete,
    onEnter,
    onClear,
    showDecimal = false,
    onCursorMove,
    compact = false
}) => {
    const baseBtnClass = cn(
        "h-full w-full font-bold bg-white shadow-sm border border-slate-100 active:scale-95 transition-all text-slate-700",
        compact ? "text-lg rounded-xl mobile:text-sm" : "text-2xl rounded-2xl land:text-xl mobile:text-base"
    );
    const actionBtnClass = cn(
        "h-full w-full font-bold bg-slate-50 shadow-sm border border-slate-100 active:scale-95 transition-all text-slate-400",
        compact ? "text-base rounded-xl" : "text-xl rounded-2xl"
    );
    const iconClass = compact ? "w-5 h-5 mobile:w-4 mobile:h-4" : "w-6 h-6 mobile:w-5 mobile:h-5";
    const enterIconClass = compact ? "w-8 h-8 mobile:w-6 mobile:h-6 drop-shadow-md" : "w-10 h-10 mobile:w-8 mobile:h-8 drop-shadow-md";

    return (
        <div
            className={cn("h-full w-full min-h-0 grid grid-cols-4 p-3 mobile:p-2", compact ? "gap-2 mobile:gap-1.5" : "gap-3 mobile:gap-2")}
            style={{ gridTemplateRows: `repeat(4, minmax(${compact ? "38px" : "44px"}, 1fr))` }}
        >
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
                <Icons.Backspace className={iconClass} />
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
            {onCursorMove ? (
                <>
                    <Button
                        onClick={() => onCursorMove("left")}
                        className={actionBtnClass}
                        variant="ghost"
                    >
                        <Icons.ArrowLeft className={iconClass} />
                    </Button>
                    <Button onClick={() => onInput(0)} className={baseBtnClass} variant="ghost">0</Button>
                    <Button
                        onClick={() => onCursorMove("right")}
                        className={actionBtnClass}
                        variant="ghost"
                    >
                        <Icons.ArrowRight className={iconClass} />
                    </Button>
                </>
            ) : (
                <>
                    <div /> {/* Empty cell for alignment */}
                    <Button onClick={() => onInput(0)} className={baseBtnClass} variant="ghost">0</Button>
                    <div /> {/* Empty cell for alignment */}
                </>
            )}

            {/* Enter Key */}
            <Button
                onClick={onEnter}
                className={cn(
                    "h-full w-full bg-violet-600 text-white shadow-md border-2 border-violet-500 active:scale-95 hover:bg-violet-700 transition-all flex flex-col items-center justify-center mobile:text-base",
                    compact ? "rounded-xl" : "rounded-2xl"
                )}
                variant="ghost"
            >
                <Icons.Check className={enterIconClass} strokeWidth={3} />
            </Button>
        </div>
    );
};
