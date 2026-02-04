import React from "react";
import { NavLink } from "react-router-dom";
import { Icons } from "./icons";
import { cn } from "../utils/cn";

export const Footer: React.FC = () => {
    const navItems = [
        { to: "/", icon: Icons.Home, label: "ホーム" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
        { to: "/settings", icon: Icons.Settings, label: "せってい" },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 safe-area-bottom z-50">
            <div className="mx-auto max-w-md flex justify-around items-center h-16 land:max-w-4xl land:h-14">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                                isActive ? "text-primary" : "text-text-sub hover:text-text-main"
                            )
                        }
                    >
                        <item.icon className="w-6 h-6 land:w-5 land:h-5" strokeWidth={2.5} />
                        <span className="text-[10px] font-bold land:text-[9px]">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};
