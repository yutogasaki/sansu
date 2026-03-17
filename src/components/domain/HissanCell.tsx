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
                <div className="h-[2px] w-full bg-slate-700/80" />
            </div>
        );
    }

    const stateClasses = (() => {
        if (isActive) {
            return "border-2 border-cyan-400 bg-cyan-50/86 text-cyan-700 ring-2 ring-cyan-200/70";
        }
        switch (cell.state) {
            case 'fixed':
                return "border border-white/80 bg-white/76 text-slate-800";
            case 'filled':
                return "border border-cyan-100/90 bg-cyan-50/70 text-cyan-700";
            case 'locked':
                return "border border-emerald-100/90 bg-emerald-50/72 text-emerald-700";
            case 'empty':
                if (cell.correctValue !== undefined) {
                    // 入力待ちセル
                    return "border-2 border-dashed border-white/85 bg-white/38 text-transparent";
                }
                // 空セル（何もない）
                return "bg-transparent border border-transparent text-transparent";
            default:
                return "border border-white/80 bg-white/76 text-slate-800";
        }
    })();

    const isOperator = ['+', '−', '×', '÷'].includes(cell.value);
    const isClickable = cell.correctValue !== undefined && cell.state !== 'locked';

    return (
        <div
            className={cn(
                sizeClasses[size],
                "flex select-none items-center justify-center rounded-[14px] font-mono font-bold shadow-[0_12px_24px_-20px_rgba(15,23,42,0.28)] transition-all",
                stateClasses,
                isClickable && "cursor-pointer active:scale-95",
                isOperator && "text-slate-500 font-normal",
            )}
            onClick={isClickable ? onClick : undefined}
        >
            {cell.value || (isActive && (
                <span className="h-6 w-0.5 animate-pulse rounded-full bg-cyan-500" />
            ))}
        </div>
    );
};
