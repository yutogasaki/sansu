import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { cn } from "../utils/cn";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattle = location.pathname === "/battle";
    const isFullScreen = isStudy || isBattle;

    return (
        <div className="min-h-screen text-text-main font-sans selection:bg-primary/20 selection:text-text-main">
            <main
                className={cn(
                    "mx-auto flex min-h-screen w-full flex-col overflow-hidden",
                    isFullScreen
                        ? "relative"
                        : "app-shell relative max-w-[30rem] md:my-4 md:max-w-[34rem] md:min-h-[calc(100vh-2rem)] md:rounded-[2.4rem] lg:max-w-5xl"
                )}
            >
                {!isFullScreen && <div className="app-shell-glow" />}

                <div
                    className={cn(
                        "relative z-10 flex min-h-0 flex-1 flex-col",
                        isFullScreen ? "" : "px-3 pt-3 md:px-4 md:pt-4"
                    )}
                >
                    <Outlet />
                </div>

                {!isFullScreen && <Footer />}
            </main>
        </div>
    );
};
