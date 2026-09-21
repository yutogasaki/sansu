import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PHONE_TOO_SHORT_QUERY = "(max-width: 767px) and (max-height: 639px)";
const SUPPORTED_QUERY = "(max-width: 767px) and (min-height: 640px), (min-width: 768px) and (orientation: landscape)";

type OrientationStatus = "ready" | "rotate-tablet" | "screen-too-small";

const getOrientationStatus = (): OrientationStatus => {
    if (window.matchMedia(PHONE_TOO_SHORT_QUERY).matches) return "screen-too-small";
    return window.matchMedia(SUPPORTED_QUERY).matches ? "ready" : "rotate-tablet";
};

export const OrientationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<OrientationStatus>(getOrientationStatus);

    useEffect(() => {
        const queries = [
            window.matchMedia(PHONE_TOO_SHORT_QUERY),
            window.matchMedia(SUPPORTED_QUERY),
        ];
        const updateStatus = () => setStatus(getOrientationStatus());
        const supportsEvents = queries.every((query) => typeof query.addEventListener === "function");

        if (supportsEvents) {
            queries.forEach((query) => query.addEventListener("change", updateStatus));
            return () => queries.forEach((query) => query.removeEventListener("change", updateStatus));
        }

        queries.forEach((query) => query.addListener(updateStatus));
        return () => queries.forEach((query) => query.removeListener(updateStatus));
    }, []);

    if (status === "ready") return <>{children}</>;

    const screenTooSmall = status === "screen-too-small";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--app-overlay)] p-8 backdrop-blur-lg">
            <div className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/14 px-8 py-10 text-center text-white shadow-[0_32px_70px_-40px_rgba(15,23,42,0.56)]">
                <div className="mb-6 text-6xl">📱↔️</div>
                <div className="mb-3 text-2xl font-black">
                    {screenTooSmall ? "もうすこし 大きな画面で あそんでね" : "タブレットを よこにしてね"}
                </div>
                <div className="text-sm text-white/74">
                    {screenTooSmall ? "このゲームは 画面の大きな端末で あそべるよ" : "タブレットは よこむきで あそんでね"}
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/battle")}
                    className="mt-6 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-white/70 bg-white/80 px-3 font-black text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-600"
                >
                    ほかの あそびへ もどる
                </button>
            </div>
        </div>
    );
};
