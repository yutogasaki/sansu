import React from "react";
import { cn } from "../../utils/cn";
import { HissanCell as HissanCellType } from "../../domain/math/hissanTypes";

interface HissanCellProps {
    cell: HissanCellType;
    isActive: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * 筆算グリッドの1セル
 * 状態に応じてスタイルが変わる
 */
export const HissanCellView: React.FC<HissanCellProps> = ({
    cell,
    isActive,
    onClick,
    size = 'md',
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-lg',
        md: 'w-11 h-11 text-2xl',
        lg: 'w-14 h-14 text-3xl',
    };

    // 区切り線
    if (cell.value === '─') {
        return (
            <div className={cn(
                sizeClasses[size],
                "flex items-center justify-center"
            )}>
                <div className="w-full h-[2px] bg-slate-800" />
            </div>
        );
    }

    const stateClasses = (() => {
        if (isActive) {
            return "bg-violet-50 border-2 border-violet-500 text-violet-700 ring-2 ring-violet-200";
        }
        switch (cell.state) {
            case 'fixed':
                return "bg-white text-slate-800 border border-slate-200";
            case 'filled':
                return "bg-violet-50/50 text-violet-700 border border-violet-200";
            case 'locked':
                return "bg-emerald-50/50 text-emerald-700 border border-emerald-200";
            case 'empty':
                if (cell.correctValue !== undefined) {
                    // 入力待ちセル
                    return "bg-slate-50 border-2 border-dashed border-slate-200 text-transparent";
                }
                // 空セル（何もない）
                return "bg-transparent border border-transparent text-transparent";
            default:
                return "bg-white text-slate-800 border border-slate-200";
        }
    })();

    const isOperator = ['+', '−', '×', '÷'].includes(cell.value);
    const isClickable = cell.correctValue !== undefined && cell.state !== 'locked';

    return (
        <div
            className={cn(
                sizeClasses[size],
                "flex items-center justify-center rounded-lg font-mono font-bold transition-all select-none",
                stateClasses,
                isClickable && "cursor-pointer active:scale-95",
                isOperator && "text-slate-500 font-normal",
            )}
            onClick={isClickable ? onClick : undefined}
        >
            {cell.value || (isActive && (
                <span className="animate-pulse w-0.5 h-6 bg-violet-400 rounded-full" />
            ))}
        </div>
    );
};
