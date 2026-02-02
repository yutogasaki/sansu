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
    const numBtnClass = "h-full min-h-[var(--tenkey-key,44px)] text-2xl font-semibold bg-white border-b-4 border-slate-100 active:border-b-0 active:translate-y-1 transition-all land:text-xl mobile:text-base";
    const arrowBtnClass = "h-full min-h-[var(--tenkey-key,44px)] text-xl font-bold text-slate-500 bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all";

    return (
        <div className="h-full min-h-0 grid grid-cols-4 grid-rows-[repeat(5,minmax(var(--tenkey-key,44px),1fr))] gap-2 p-2 mobile:gap-1 mobile:p-1">
            <Button onClick={() => onInput(7)} className={`${numBtnClass} row-start-1 col-start-1`} variant="secondary">
                7
            </Button>
            <Button onClick={() => onInput(8)} className={`${numBtnClass} row-start-1 col-start-2`} variant="secondary">
                8
            </Button>
            <Button onClick={() => onInput(9)} className={`${numBtnClass} row-start-1 col-start-3`} variant="secondary">
                9
            </Button>
            <Button
                onClick={onClear}
                className={`${numBtnClass} text-lg font-medium text-red-400 bg-red-50 border-red-100 row-start-1 col-start-4 mobile:text-sm`}
                variant="ghost"
            >
                C
            </Button>

            <Button onClick={() => onInput(4)} className={`${numBtnClass} row-start-2 col-start-1`} variant="secondary">
                4
            </Button>
            <Button onClick={() => onInput(5)} className={`${numBtnClass} row-start-2 col-start-2`} variant="secondary">
                5
            </Button>
            <Button onClick={() => onInput(6)} className={`${numBtnClass} row-start-2 col-start-3`} variant="secondary">
                6
            </Button>
            <Button
                onClick={onDelete}
                className={`${numBtnClass} text-lg font-medium text-slate-400 bg-slate-50 row-start-2 col-start-4`}
                variant="ghost"
            >
                <Icons.Backspace className="w-6 h-6 mobile:w-5 mobile:h-5" />
            </Button>

            <Button onClick={() => onInput(1)} className={`${numBtnClass} row-start-3 col-start-1`} variant="secondary">
                1
            </Button>
            <Button onClick={() => onInput(2)} className={`${numBtnClass} row-start-3 col-start-2`} variant="secondary">
                2
            </Button>
            <Button onClick={() => onInput(3)} className={`${numBtnClass} row-start-3 col-start-3`} variant="secondary">
                3
            </Button>
            {showDecimal ? (
                <Button onClick={() => onInput(".")} className={`${numBtnClass} row-start-3 col-start-4`} variant="secondary">
                    .
                </Button>
            ) : (
                <div className="row-start-3 col-start-4" />
            )}

            <Button
                onClick={() => onCursorMove?.("left")}
                className={`${arrowBtnClass} row-start-4 col-start-1`}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </Button>

            <Button onClick={() => onInput(0)} className={`${numBtnClass} row-start-4 col-start-2`} variant="secondary">
                0
            </Button>

            <Button
                onClick={() => onCursorMove?.("right")}
                className={`${arrowBtnClass} row-start-4 col-start-3`}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowRight className="w-6 h-6" />
            </Button>

            <Button
                onClick={onEnter}
                className={`${numBtnClass} row-start-4 row-span-2 col-start-4 w-full self-stretch min-h-[calc(var(--tenkey-key,44px)*2)] text-white bg-yellow-400 hover:bg-yellow-500 border-yellow-500`}
                variant="ghost"
            >
                <Icons.Check className="w-8 h-8 mobile:w-6 mobile:h-6" />
            </Button>
        </div>
    );
};
