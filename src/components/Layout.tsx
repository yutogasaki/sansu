import React from "react";
import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";

export const Layout: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-slate-700 font-sans selection:bg-yellow-200 selection:text-yellow-900">
            <main className="mx-auto max-w-md w-full min-h-screen relative flex flex-col land:max-w-4xl">
                {/* Content Area */}
                <div className="flex-1 flex flex-col p-4 pb-24 land:px-8 land:pb-20">
                    <Outlet />
                </div>

                <Footer />
            </main>
        </div>
    );
};
