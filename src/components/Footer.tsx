import React from "react";
import { NavLink } from "react-router-dom";
import { Icons } from "./icons";
import { cn } from "../utils/cn";
import { warmUpTTS } from "../utils/tts";

type NavItem = {
    to: string;
    icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
    label: string;
    accent?: boolean;
    onClick?: () => void;
};

export const Footer: React.FC = () => {
    const items: NavItem[] = [
        { to: "/", icon: Icons.Home, label: "ホーム" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
        { to: "/study", icon: Icons.Study, label: "まなぶ", accent: true, onClick: warmUpTTS },
        { to: "/battle", icon: Icons.Play, label: "たいせん" },
        { to: "/settings", icon: Icons.Settings, label: "せってい" },
    ];

    return (
        <footer className="relative z-20 px-3 pt-2 pb-[calc(0.8rem+var(--safe-area-inset-bottom))] md:px-4 md:pt-3 md:pb-4">
            <nav className="app-dock rounded-[1.9rem] p-2">
                <div className="grid grid-cols-5 gap-1.5">
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={item.onClick}
                            className={({ isActive }) =>
                                cn(
                                    "group flex h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 text-[10px] font-bold transition-all duration-200",
                                    item.accent
                                        ? "bg-[linear-gradient(140deg,#14b8a6_0%,#06b6d4_56%,#0ea5e9_100%)] text-white shadow-[0_16px_28px_-18px_rgba(8,145,178,0.8)]"
                                        : isActive
                                            ? "bg-cyan-50/90 text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                                            : "text-slate-500 hover:bg-white/65 hover:text-slate-700"
                                )
                            }
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 transition-transform duration-200",
                                    item.accent ? "h-5 w-5" : "group-hover:-translate-y-0.5"
                                )}
                                strokeWidth={item.accent ? 2.5 : 2.2}
                            />
                            <span className={cn("leading-none", item.accent ? "text-[11px]" : "")}>
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </footer>
    );
};
