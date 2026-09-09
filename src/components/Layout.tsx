import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { cn } from "../utils/cn";
import { islandEnabled } from "../domain/island/feature";
import "./island/IslandShell.css";
import { IslandNavigationContext, useIslandNavigationState } from './island/useIslandNavigation';
import { Spinner } from './ui/Spinner';

const Island = React.lazy(() => import('../pages/Island'));

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattlePlay = location.pathname.startsWith("/battle/play");
    const isExplore = location.pathname === "/explore";
    const supportsIslandShell = islandEnabled() && !isStudy && !isBattlePlay && !isExplore && location.pathname !== '/park';
    const navigation = useIslandNavigationState(supportsIslandShell);
    const isFullScreen = isStudy || isBattlePlay || isExplore || location.pathname === "/park"
        || (supportsIslandShell ? navigation.focus : location.pathname === '/island');
    const showFooter = !isFullScreen;
    const isIslandShell = supportsIslandShell && !navigation.active;

    React.useEffect(() => {
        document.body.classList.toggle("app-mode-fullscreen", isFullScreen || navigation.active);
        document.body.classList.toggle("app-mode-island-shell", isIslandShell);

        return () => {
            document.body.classList.remove("app-mode-fullscreen");
            document.body.classList.remove("app-mode-island-shell");
        };
    }, [isFullScreen, isIslandShell, navigation.active]);

    return (
        <IslandNavigationContext.Provider value={supportsIslandShell ? navigation : null}>
        <div
            className={cn("relative flex h-full min-h-0 flex-col overflow-hidden text-text-main", supportsIslandShell && "island-shell")}
            data-shell-candidate={supportsIslandShell ? "island-navigation-v1" : undefined}
        >
            <main
                className={cn(
                    "relative min-h-0 overflow-hidden",
                    (!showFooter || supportsIslandShell) && "flex-1"
                )}
                style={showFooter && !supportsIslandShell ? { height: "calc(100% - (56px + var(--safe-area-bottom)))" } : undefined}
            >
                <div className="h-full w-full min-h-0" inert={navigation.active || undefined} aria-hidden={navigation.active || undefined}
                    style={navigation.active ? { visibility: 'hidden' } : undefined}>
                    <Outlet />
                </div>
                {navigation.mounted && <div className="island-session-host" hidden={!navigation.active} inert={!navigation.active || undefined}>
                    <React.Suspense fallback={<Spinner fullScreen message="しまを じゅんびちゅう…" />}><Island /></React.Suspense>
                </div>}
            </main>

            {showFooter && <Footer />}
        </div>
        </IslandNavigationContext.Provider>
    );
};
