import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { warmUpTTS } from "../utils/tts";

type TabItem = {
    to: string;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
    activePaths?: string[];
};

export const Footer: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const leftTabs: TabItem[] = [
        { to: "/", icon: Icons.Home, label: "ホーム" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
    ];

    const rightTabs: TabItem[] = [
        { to: "/battle", icon: Icons.Play, label: "Game" },
        { to: "/settings", icon: Icons.Settings, label: "せってい", activePaths: ["/settings", "/parents", "/dev"] },
    ];

    const renderTab = (item: TabItem) => {
        const activePaths = item.activePaths ?? [item.to];
        const isActive = activePaths.some((path) => (
            path === "/"
                ? currentPath === "/"
                : currentPath === path || currentPath.startsWith(`${path}/`)
        ));

        return (
            <button
                key={item.to}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                    if (item.to === currentPath) return;
                    navigate(item.to);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 border-none bg-transparent px-4 py-2 transition-colors duration-200 ${isActive ? "text-teal-500" : "text-slate-400"}`}
            >
                <item.icon
                    width={22}
                    height={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="pointer-events-none"
                    aria-hidden="true"
                />
                <span className="pointer-events-none text-[10px] font-medium font-[var(--font-body)]">
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <nav className="fixed bottom-0 left-1/2 z-50 flex w-[min(100%,430px)] -translate-x-1/2 items-center justify-around border-t border-black/6 bg-[var(--toolbar-bg)] shadow-[var(--toolbar-shadow)] backdrop-blur-[var(--blur-lg)] h-[calc(56px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]">

            {leftTabs.map(renderTab)}

            <button
                className="fab"
                type="button"
                aria-label="まなぶ"
                onClick={() => {
                    warmUpTTS();
                    navigate("/study");
                }}
            >
                <Icons.Study
                    width={26}
                    height={26}
                    strokeWidth={2.6}
                    color="#FFFFFF"
                    aria-hidden="true"
                />
            </button>

            {rightTabs.map(renderTab)}
        </nav>
    );
};
