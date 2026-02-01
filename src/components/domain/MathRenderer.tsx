import React from "react";
import { cn } from "../../utils/cn";

interface MathRendererProps {
    text: string;
    className?: string;
    isFraction?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className, isFraction }) => {
    // 分数を含むかどうか判定 (簡易的: / があれば分数処理とみなす)
    // ただし "÷" (div) もあるので注意
    const hasFraction = text.includes("/");

    if (!hasFraction && !isFraction) {
        return <span className={className}>{text}</span>;
    }

    // トークンに分割 (演算子と数値/分数を分ける)
    // スペースで区切られている前提 (fraction.tsを見ると `a/b + c/d =` のようにスペースがある)
    const tokens = text.split(" ");

    return (
        <div className={cn(
            "flex items-center justify-center flex-wrap gap-x-2 gap-y-2 max-w-full overflow-hidden",
            // 分数時のline-height調整のみ残す (スケールダウンは削除)
            isFraction && "leading-none",
            className
        )}>
            {tokens.map((token, idx) => {
                // 分数判定 (数字/数字)
                // 帯分数 "1 1/2" は split(" ") で "1", "1/2" に分かれるので並べて表示でOK
                if (token.match(/^\d+\/\d+$/)) {
                    const [num, den] = token.split("/");
                    return (
                        <div key={idx} className="inline-flex flex-col items-center align-middle mx-1">
                            <span className="border-b-2 border-slate-800 px-1 mb-[1px] leading-none text-[1em]">{num}</span>
                            <span className="px-1 leading-none text-[1em]">{den}</span>
                        </div>
                    );
                }

                // 演算子や整数
                return (
                    <span key={idx} className="leading-none mt-[-2px]">
                        {token}
                    </span>
                );
            })}
        </div>
    );
};
