import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
    const location = useLocation();
    const isStudy = location.pathname === "/study";
    const isBattle = location.pathname === "/battle";
    const isFullScreen = isStudy || isBattle;

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-text-main">
            <main className="relative flex-1 overflow-hidden">
                <div className="h-full w-full">
                    <Outlet />
                </div>
            </main>

            {!isFullScreen && <Footer />}
        </div>
    );
};
