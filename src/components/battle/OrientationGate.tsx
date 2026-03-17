import React, { useEffect, useState } from "react";

const QUERY = "(min-width: 768px) and (orientation: landscape)";

export const OrientationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ok, setOk] = useState(() => window.matchMedia(QUERY).matches);

    useEffect(() => {
        const mq = window.matchMedia(QUERY);
        const updateMatch = (event?: MediaQueryListEvent) => {
            setOk(event?.matches ?? mq.matches);
        };

        updateMatch();

        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", updateMatch);
            return () => mq.removeEventListener("change", updateMatch);
        }

        mq.addListener(updateMatch);
        return () => mq.removeListener(updateMatch);
    }, []);

    if (ok) return <>{children}</>;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--app-overlay)] p-8 backdrop-blur-lg">
            <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/14 px-8 py-10 text-center text-white shadow-[0_32px_70px_-40px_rgba(15,23,42,0.56)]">
                <div className="mb-6 text-6xl">📱↔️</div>
                <div className="mb-3 text-2xl font-black">iPadを よこにしてね</div>
                <div className="text-sm text-white/74">
                    このゲームは iPad のよこがめん でしか あそべないよ
                </div>
            </div>
        </div>
    );
};
