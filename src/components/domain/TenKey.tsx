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
    // 高さ指定(min-h)を削除し、Gridに任せる
    const baseBtnClass = "h-full w-full text-2xl font-semibold bg-white border-b-4 border-slate-100 active:border-b-0 active:translate-y-1 transition-all land:text-xl mobile:text-base";
    const actionBtnClass = "h-full w-full text-xl font-bold bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 transition-all text-slate-500";

    return (
        <div className="h-full w-full min-h-0 grid grid-cols-4 gap-2 p-2 mobile:gap-1 mobile:p-1" style={{ gridTemplateRows: 'repeat(4, 1fr)' }}>
            {/* Row 1 */}
            <Button onClick={() => onInput(7)} className={baseBtnClass} variant="secondary">7</Button>
            <Button onClick={() => onInput(8)} className={baseBtnClass} variant="secondary">8</Button>
            <Button onClick={() => onInput(9)} className={baseBtnClass} variant="secondary">9</Button>
            <Button
                onClick={onClear}
                className={cn(baseBtnClass, "text-lg font-medium text-red-400 bg-red-50 border-red-100 mobile:text-sm")}
                variant="ghost"
            >
                C
            </Button>

            {/* Row 2 */}
            <Button onClick={() => onInput(4)} className={baseBtnClass} variant="secondary">4</Button>
            <Button onClick={() => onInput(5)} className={baseBtnClass} variant="secondary">5</Button>
            <Button onClick={() => onInput(6)} className={baseBtnClass} variant="secondary">6</Button>
            <Button
                onClick={onDelete}
                className={cn(baseBtnClass, "text-lg font-medium text-slate-400 bg-slate-50")}
                variant="ghost"
            >
                <Icons.Backspace className="w-6 h-6 mobile:w-5 mobile:h-5" />
            </Button>

            {/* Row 3 */}
            <Button onClick={() => onInput(1)} className={baseBtnClass} variant="secondary">1</Button>
            <Button onClick={() => onInput(2)} className={baseBtnClass} variant="secondary">2</Button>
            <Button onClick={() => onInput(3)} className={baseBtnClass} variant="secondary">3</Button>
            {showDecimal ? (
                <Button onClick={() => onInput(".")} className={baseBtnClass} variant="secondary">.</Button>
            ) : (
                <div /> /* Empty cell for alignment */
            )}

            {/* Row 4 */}
            <Button
                onClick={() => onCursorMove?.("left")}
                className={actionBtnClass}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowLeft className="w-6 h-6" />
            </Button>
            <Button onClick={() => onInput(0)} className={baseBtnClass} variant="secondary">0</Button>
            <Button
                onClick={() => onCursorMove?.("right")}
                className={actionBtnClass}
                disabled={!onCursorMove}
                variant="secondary"
            >
                <Icons.ArrowRight className="w-6 h-6" />
            </Button>

            {/* Enter Key */}
            <Button
                onClick={onEnter}
                className={cn(
                    baseBtnClass,
                    "text-white bg-yellow-400 hover:bg-yellow-500 border-yellow-500 border-b-4",
                    "flex flex-col items-center justify-center"
                )}
                variant="ghost"
            >
                <Icons.Check className="w-8 h-8 mobile:w-6 mobile:h-6" />
            </Button>
        </div>
    );
};
