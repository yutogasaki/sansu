import React from "react";
import { useNavigate } from "react-router-dom";
import { Icons } from "./icons";

interface HeaderProps {
    title?: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
    center?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, showBack, onBack, rightAction, center }) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    return (
        <header className="relative z-10 flex items-center justify-between gap-3 px-[var(--screen-padding-x)] pt-[var(--screen-header-top)] pb-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                {showBack && (
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="もどる"
                        className="flex h-11 min-w-11 items-center justify-center rounded-full border-0 bg-[#F0F3F5] text-slate-700 shadow-sm transition-transform duration-150 active:scale-95"
                    >
                        <Icons.Back className="w-5 h-5" />
                    </button>
                )}
                <div className="min-w-0 flex flex-col">
                    {title && (
                        <h1
                            className="truncate text-[28px] font-bold leading-none tracking-[-0.03em] text-text-main"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            {title}
                        </h1>
                    )}
                    {subtitle && <span className="mt-1 text-xs font-bold text-slate-400">{subtitle}</span>}
                </div>
            </div>

            {center && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    {center}
                </div>
            )}

            {rightAction ? (
                <div className="flex shrink-0 items-center gap-3">{rightAction}</div>
            ) : (
                <div className="w-11 shrink-0" />
            )}
        </header>
    );
};
