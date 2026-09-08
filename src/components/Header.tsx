import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { islandEnabled } from "../domain/island/feature";
import { IslandMark } from "./island/IslandMark";
import { cn } from "../utils/cn";

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
    const { pathname } = useLocation();
    const isIslandHeader = islandEnabled() && !["/onboarding", "/explore", "/park", "/island"].includes(pathname)
        && !pathname.startsWith("/battle/play");

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    return (
        <header className={cn("relative z-10 flex items-center justify-between gap-3 px-[var(--screen-padding-x)] pt-[var(--screen-header-top)] pb-4", isIslandHeader && "island-shell-header")}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
                {showBack && (
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="もどる"
                        className={cn("app-pill flex h-11 min-w-11 items-center justify-center rounded-full border-white/80 bg-white/72 text-slate-700 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.34)] transition-all duration-150 hover:bg-white/84 active:scale-95", isIslandHeader && "island-shell-back")}
                    >
                        <Icons.Back className="w-5 h-5" />
                    </button>
                )}
                {title && !showBack && (isIslandHeader ? (
                    <span className="island-shell-mark"><IslandMark size={24} strokeWidth={2} /></span>
                ) : (
                    <img
                        src="/icons/icon-192.png"
                        alt=""
                        aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-[13px] border-2 border-[var(--brand-ink)] object-cover shadow-[0_5px_0_rgba(23,63,73,0.16)]"
                    />
                ))}
                <div className="min-w-0 flex flex-col">
                    {title && isIslandHeader && <span className="island-shell-eyebrow">ふしぎな しま</span>}
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
