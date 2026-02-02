import React from "react";
import { cn } from "../../utils/cn";

interface MathRendererProps {
    text: string;
    className?: string;
    isFraction?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className, isFraction }) => {
    // 分数を含むかどうか判定
    const hasFraction = text.includes("/");

    if (!hasFraction && !isFraction) {
        return <span className={className}>{text}</span>;
    }

    // トークンに分割
    const tokens = text.split(" ");

    return (
        <div className={cn(
            "flex items-center justify-center flex-wrap gap-x-2 gap-y-2 max-w-full overflow-hidden",
            // 縦位置合わせ: 分数（背が高い）と演算子（低い）の中心を合わせる
            "items-center",
            isFraction && "leading-none",
            className
        )}>
            {tokens.map((token, idx) => {
                // 分数判定 (数字/数字)
                if (token.match(/^\d+\/\d+$/)) {
                    const [num, den] = token.split("/");
                    return (
                        <div key={idx} className="inline-flex flex-col items-center justify-center mx-1 vertical-align-middle">
                            <span className="border-b-2 border-slate-800 px-1 text-[0.85em] leading-tight mb-[2px]">{num}</span>
                            <span className="px-1 text-[0.85em] leading-tight">{den}</span>
                        </div>
                    );
                }

                // 演算子や整数
                return (
                    <span key={idx} className="leading-none flex items-center h-full">
                        {token}
                    </span>
                );
            })}
        </div>
    );
};
