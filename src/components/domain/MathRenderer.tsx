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
            "flex items-center justify-center flex-wrap gap-y-2 max-w-full overflow-hidden",
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

                // 前のトークンが整数(数字のみ)で、現在が分数なら、帯分数として間隔を詰める
                // 逆に、現在が数字で次が分数... という判定はmap内だと難しいので一律 gap-x-2 を外して mx で制御する
                // 演算子や整数
                const isOperator = ["+", "-", "×", "÷", "="].includes(token);

                return (
                    <span key={idx} className={cn(
                        "leading-none flex items-center h-full",
                        isOperator ? "mx-2" : "mx-1" // 整数と分数の間は狭く(mx-1)、演算子は広く(mx-2)
                    )}>
                        {token}
                    </span>
                );
            })}
        </div>
    );
};
