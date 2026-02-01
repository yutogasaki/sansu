import React from "react";
import { Button } from "../ui/Button";
import { Icons } from "../icons";

interface TenKeyProps {
    onInput: (val: number | string) => void;
    onDelete: () => void;
    onEnter: () => void;
    onClear: () => void;
    showDecimal?: boolean;
}

export const TenKey: React.FC<TenKeyProps> = ({ onInput, onDelete, onEnter, onClear, showDecimal = false }) => {
    const numBtnClass = "h-16 text-2xl font-semibold bg-white border-b-4 border-slate-100 active:border-b-0 active:translate-y-1 transition-all land:h-12 land:text-xl";

    if (showDecimal) {
        // 4列レイアウト（小数点付き）
        return (
            <div className="grid grid-cols-4 gap-3 p-2">
                {[7, 8, 9].map((n) => (
                    <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                        {n}
                    </Button>
                ))}
                <Button onClick={onClear} className="h-16 text-lg font-medium text-red-400 bg-red-50 border-red-100 land:h-12 land:text-base" variant="ghost">
                    C
                </Button>

                {[4, 5, 6].map((n) => (
                    <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                        {n}
                    </Button>
                ))}
                <Button onClick={onDelete} className="h-16 text-lg font-medium text-slate-400 bg-slate-50 land:h-12 land:text-base" variant="ghost">
                    <Icons.Backspace className="w-6 h-6" />
                </Button>

                {[1, 2, 3].map((n) => (
                    <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                        {n}
                    </Button>
                ))}
                <Button onClick={onEnter} className="h-16 row-span-2 text-white bg-yellow-400 hover:bg-yellow-500 border-b-4 border-yellow-500 active:border-b-0 active:translate-y-1 land:h-12" variant="ghost">
                    <Icons.Check className="w-8 h-8" />
                </Button>

                <Button onClick={() => onInput(0)} className={numBtnClass} variant="secondary">
                    0
                </Button>
                <Button onClick={() => onInput(".")} className={`${numBtnClass} col-span-2`} variant="secondary">
                    .
                </Button>
            </div>
        );
    }

    // 通常4列レイアウト（戻すを追加）
    return (
        <div className="grid grid-cols-4 gap-3 p-2">
            {[7, 8, 9].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            <Button onClick={onClear} className="h-16 text-lg font-medium text-red-400 bg-red-50 border-red-100 land:h-12 land:text-base" variant="ghost">
                C
            </Button>

            {[4, 5, 6].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            <Button onClick={onDelete} className="h-16 text-lg font-medium text-slate-400 bg-slate-50 land:h-12 land:text-base" variant="ghost">
                <Icons.Backspace className="w-6 h-6" />
            </Button>

            {[1, 2, 3].map((n) => (
                <Button key={n} onClick={() => onInput(n)} className={numBtnClass} variant="secondary">
                    {n}
                </Button>
            ))}
            <Button onClick={onEnter} className="h-16 row-span-2 text-white bg-yellow-400 hover:bg-yellow-500 border-b-4 border-yellow-500 active:border-b-0 active:translate-y-1 land:h-12" variant="ghost">
                <Icons.Check className="w-8 h-8" />
            </Button>

            <Button onClick={() => onInput(0)} className={`${numBtnClass} col-span-2`} variant="secondary">
                0
            </Button>
            <div />
        </div>
    );
};
