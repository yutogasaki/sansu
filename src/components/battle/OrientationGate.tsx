import React, { useEffect, useState } from "react";

const QUERY = "(min-width: 768px) and (orientation: landscape)";

export const OrientationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ok, setOk] = useState(() => window.matchMedia(QUERY).matches);

    useEffect(() => {
        const mq = window.matchMedia(QUERY);
        const handler = (e: MediaQueryListEvent) => setOk(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    if (ok) return <>{children}</>;

    return (
        <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-white z-50 p-8">
            <div className="text-6xl mb-6">📱↔️</div>
            <div className="text-2xl font-black mb-3">iPadを よこにしてね</div>
            <div className="text-sm text-slate-400">
                このゲームは iPad のよこがめん でしか あそべないよ
            </div>
        </div>
    );
};
