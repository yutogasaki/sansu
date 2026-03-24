import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { cn } from "../utils/cn";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattlePlay = location.pathname.startsWith("/battle/play");
    const isFullScreen = isStudy || isBattlePlay;
    const showFooter = !isFullScreen;

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-text-main">
            <main
                className={cn(
                    "relative min-h-0 overflow-hidden",
                    !showFooter && "flex-1"
                )}
                style={showFooter ? { height: "calc(100% - (56px + var(--safe-area-bottom)))" } : undefined}
            >
                <div className="h-full w-full min-h-0">
                    <Outlet />
                </div>
            </main>

            {showFooter && <Footer />}
        </div>
    );
};
