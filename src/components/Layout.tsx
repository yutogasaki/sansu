import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { cn } from "../utils/cn";
import { islandEnabled } from "../domain/island/feature";
import "./island/IslandShell.css";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattlePlay = location.pathname.startsWith("/battle/play");
    const isExplore = location.pathname === "/explore";
    const isFullScreen = isStudy || isBattlePlay || isExplore || location.pathname === "/park" || location.pathname === "/island";
    const showFooter = !isFullScreen;
    const isIslandShell = islandEnabled() && !isBattlePlay && !isExplore
        && location.pathname !== "/park" && location.pathname !== "/island";

    React.useEffect(() => {
        document.body.classList.toggle("app-mode-fullscreen", isFullScreen);
        document.body.classList.toggle("app-mode-island-shell", isIslandShell);

        return () => {
            document.body.classList.remove("app-mode-fullscreen");
            document.body.classList.remove("app-mode-island-shell");
        };
    }, [isFullScreen, isIslandShell]);

    return (
        <div
            className={cn("relative flex h-full min-h-0 flex-col overflow-hidden text-text-main", isIslandShell && "island-shell")}
            data-shell-candidate={isIslandShell ? "pokomoko-color-dots-v1" : undefined}
        >
            <main
                className={cn(
                    "relative min-h-0 overflow-hidden",
                    (!showFooter || isIslandShell) && "flex-1"
                )}
                style={showFooter && !isIslandShell ? { height: "calc(100% - (56px + var(--safe-area-bottom)))" } : undefined}
            >
                <div className="h-full w-full min-h-0">
                    <Outlet />
                </div>
            </main>

            {showFooter && <Footer />}
        </div>
    );
};
