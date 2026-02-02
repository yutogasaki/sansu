import React from "react";
import { Button } from "../ui/Button";
import { Icons } from "../icons";

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
    // モバイルはCSS変数で動的高さ、それ以外は固定
    const numBtnClass = "h-16 text-2xl font-semibold bg-white border-b-4 border-slate-100 active:border-b-0 active:translate-y-1 transition-all land:h-12 land:text-xl mobile:h-[var(--tenkey-h)] mobile:text-base";
    const arrowBtnClass = "h-16 text-xl font-bold text-slate-500 bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all land:h-12 mobile:h-[var(--tenkey-h)]";

    return (
        <div className="grid grid-cols-4 gap-3 p-2 mobile:gap-1 mobile:p-1">
            {[7, 8, 9].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            <Button onClick={onClear} className="h-16 text-lg font-medium text-red-400 bg-red-50 border-red-100 land:h-12 land:text-base mobile:h-[var(--tenkey-h)] mobile:text-sm" variant="ghost">
                C
            </Button>

            {[4, 5, 6].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            <Button onClick={onDelete} className="h-16 text-lg font-medium text-slate-400 bg-slate-50 land:h-12 land:text-base mobile:h-[var(--tenkey-h)]" variant="ghost">
                <Icons.Backspace className="w-6 h-6 mobile:w-5 mobile:h-5" />
            </Button>

            {[1, 2, 3].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            {showDecimal ? (
                <Button onClick={() => onInput(".")} className={numBtnClass} variant="secondary">
                    .
                </Button>
            ) : (
                <div />
            )}

            <Button
                onClick={() => onCursorMove?.("left")}
                className={arrowBtnClass}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </Button>

            <Button onClick={() => onInput(0)} className={numBtnClass} variant="secondary">
                0
            </Button>

            <Button
                onClick={() => onCursorMove?.("right")}
                className={arrowBtnClass}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowRight className="w-6 h-6" />
            </Button>

            <Button onClick={onEnter} className="h-16 text-white bg-yellow-400 hover:bg-yellow-500 border-b-4 border-yellow-500 active:border-b-0 active:translate-y-1 land:h-12 mobile:h-[var(--tenkey-h)]" variant="ghost">
                <Icons.Check className="w-8 h-8 mobile:w-6 mobile:h-6" />
            </Button>
        </div>
    );
};
