import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattle = location.pathname === "/battle";
    const isFullScreen = isStudy || isBattle;

    return (
        <div className="min-h-screen bg-background text-text-main font-sans selection:bg-primary/20 selection:text-text-main">
            <main className={`mx-auto w-full min-h-screen relative flex flex-col ${isFullScreen ? '' : 'max-w-md land:max-w-4xl'}`}>
                {/* Content Area */}
                <div className={`flex-1 flex flex-col ${isFullScreen ? '' : 'p-4 pb-24 land:px-8 land:pb-20'}`}>
                    <Outlet />
                </div>

                {!isFullScreen && <Footer />}
            </main>
        </div>
    );
};
