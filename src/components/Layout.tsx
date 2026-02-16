import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattle = location.pathname === "/battle";
    const isFullScreen = isStudy || isBattle;

    return (
        <div className="min-h-screen text-text-main font-sans selection:bg-primary/20 selection:text-text-main">
            <main className={`mx-auto w-full min-h-screen relative flex flex-col overflow-hidden ${isFullScreen ? '' : 'max-w-md land:max-w-4xl'}`}>
                {!isFullScreen && <div className="app-shell-glow" />}
                {/* Content Area */}
                <div className={`flex-1 flex flex-col relative z-10 ${isFullScreen ? '' : 'p-4 pb-24 land:px-8 land:pb-20'}`}>
                    <Outlet />
                </div>

                {!isFullScreen && <Footer />}
            </main>
        </div>
    );
};
