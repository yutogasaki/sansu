import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { cn } from "../utils/cn";
import { warmUpTTS } from "../utils/tts";

export const Footer: React.FC = () => {
    const navigate = useNavigate();

    const leftItems = [
        { to: "/", icon: Icons.Home, label: "ホーム" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
    ];

    const rightItems = [
        { to: "/battle", icon: Icons.Play, label: "たいせん" },
        { to: "/settings", icon: Icons.Settings, label: "せってい" },
    ];

    const renderNavItem = (item: { to: string; icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>; label: string }) => (
        <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
                cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                    isActive ? "text-primary" : "text-text-sub hover:text-text-main"
                )
            }
        >
            <item.icon className="w-5 h-5 land:w-4 land:h-4" strokeWidth={2.5} />
            <span className="text-[10px] font-bold land:text-[9px]">{item.label}</span>
        </NavLink>
    );

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/82 backdrop-blur-xl border-t border-white/80 safe-area-bottom z-50 shadow-[0_-14px_24px_-20px_rgba(15,23,42,0.6)]">
            <div className="mx-auto max-w-md flex items-center h-16 land:max-w-4xl land:h-14 relative">
                {/* Left nav items */}
                <div className="flex flex-1">
                    {leftItems.map(renderNavItem)}
                </div>

                {/* Center FAB spacer */}
                <div className="w-16" />

                {/* Right nav items */}
                <div className="flex flex-1">
                    {rightItems.map(renderNavItem)}
                </div>

                {/* Center FAB button */}
                <button
                    onClick={() => { warmUpTTS(); navigate("/study"); }}
                    className="absolute left-1/2 -translate-x-1/2 -top-5 w-14 h-14 rounded-full bg-gradient-to-b from-teal-500 to-cyan-600 text-white shadow-[0_8px_20px_-6px_rgba(8,145,178,0.6)] flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Icons.Study className="w-6 h-6" strokeWidth={2.5} />
                </button>
            </div>
        </nav>
    );
};
