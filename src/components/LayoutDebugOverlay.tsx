import React, { useState, useEffect } from "react";

export const LayoutDebugOverlay: React.FC = () => {
    // DEVモード以外では何も表示しない
    if (!import.meta.env.DEV) return null;

    const [metrics, setMetrics] = useState({
        width: 0,
        height: 0,
        scrollHeight: 0,
        visualViewportHeight: 0,
        scrollDiff: 0,
        safeAreaBottom: 0
    });

    const [componentHeights, setComponentHeights] = useState({
        header: 0,
        card: 0,
        controls: 0
    });

    useEffect(() => {
        const updateMetrics = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const scrollHeight = document.documentElement.scrollHeight;
            const visualViewportHeight = window.visualViewport?.height || height;

            // 簡易的なSafe Area計測（CSS変数経由で取れればベストだが、ここでは計算値で近似）
            const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-inset-bottom")) || 0;

            // 各主要要素の高さ取得
            const headerEl = document.getElementById("debug-header");
            const cardEl = document.getElementById("debug-card-container");
            const controlsEl = document.getElementById("debug-controls");

            setMetrics({
                width,
                height,
                scrollHeight,
                visualViewportHeight,
                scrollDiff: scrollHeight - height,
                safeAreaBottom
            });

            setComponentHeights({
                header: headerEl?.offsetHeight || 0,
                card: cardEl?.offsetHeight || 0,
                controls: controlsEl?.offsetHeight || 0,
            });
        };

        updateMetrics();
        window.addEventListener("resize", updateMetrics);
        // 定期更新（アニメーション等での変更検知）
        const interval = setInterval(updateMetrics, 500);

        return () => {
            window.removeEventListener("resize", updateMetrics);
            clearInterval(interval);
        };
    }, []);

    const isScrollSafe = metrics.scrollDiff <= 1; // 1px許容
    const totalContentHeight = componentHeights.header + componentHeights.card + componentHeights.controls;

    return (
        <div className="fixed top-0 right-0 z-[9999] bg-black/80 text-white text-[10px] p-2 font-mono pointer-events-none max-w-[200px] opacity-90">
            <h3 className="font-bold border-b border-gray-600 mb-1">Layout Debugger</h3>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <span className="text-gray-400">Viewport:</span>
                <span>{metrics.width} x {metrics.height}</span>

                <span className="text-gray-400">ScrollH:</span>
                <span className={metrics.scrollDiff > 1 ? "text-red-400 font-bold" : "text-green-400"}>
                    {metrics.scrollHeight} ({metrics.scrollDiff > 0 ? `+${metrics.scrollDiff}` : "OK"})
                </span>

                <span className="text-gray-400">Components:</span>
                <span className="text-xs">
                    H:{componentHeights.header} + C:{componentHeights.card} + K:{componentHeights.controls}
                </span>

                <span className="text-gray-400">Total:</span>
                <span className={totalContentHeight > metrics.height ? "text-red-400" : "text-green-400"}>
                    {totalContentHeight} / {metrics.height}
                </span>

                <span className="text-gray-400">Result:</span>
                <span className={`font-bold ${isScrollSafe ? "text-green-400" : "text-red-500 bg-white px-1"}`}>
                    {isScrollSafe ? "PASS" : "FAIL (Scroll)"}
                </span>
            </div>

            <div className="mt-1 flex items-center gap-1 text-[9px] text-gray-400">
                <div className={`w-2 h-2 rounded-full ${isScrollSafe ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></div>
                {isScrollSafe ? "Perfect Fit" : "Overflowing!"}
            </div>
        </div>
    );
};
