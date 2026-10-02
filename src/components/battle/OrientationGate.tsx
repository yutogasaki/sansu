import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tablet, MoveHorizontal } from 'lucide-react';

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
        <div className="battle-orientation-gate fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="battle-orientation-card w-full max-w-md px-6 py-8 text-center">
                <div className="battle-orientation-symbol" aria-hidden="true"><Tablet size={48} strokeWidth={1.5} /><MoveHorizontal size={32} strokeWidth={1.5} /></div>
                <div className="mb-3 text-2xl font-black">
                    {screenTooSmall ? "もうすこし 大きな画面で あそんでね" : "タブレットを よこにしてね"}
                </div>
                <div className="text-sm text-pokomoko-muted">
                    {screenTooSmall ? "このゲームは 画面の大きな端末で あそべるよ" : "タブレットは よこむきで あそんでね"}
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/battle")}
                    className="app-button app-button--secondary mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--pokomoko-edge)] bg-[var(--pokomoko-paper)] px-4 py-2 font-bold text-[var(--pokomoko-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pokomoko-blue)]"
                >
                    ほかの あそびへ もどる
                </button>
            </div>
        </div>
    );
};
