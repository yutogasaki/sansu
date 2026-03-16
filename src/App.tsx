import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useEffect } from 'react';
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { Study } from "./pages/Study";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { CurriculumSettings } from "./pages/CurriculumSettings";
import { DevMode } from "./pages/DevMode";
import { ParentsPage } from "./pages/parents/ParentsPage";
import { Battle } from "./pages/Battle";
import { loadSounds } from './utils/audio';
import { getActiveProfileId } from "./domain/user/repository";
import { applyThemeForCurrentTime, getMsUntilNextThemeCheck } from "./utils/theme";

// Mock auth check
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const hasProfile = getActiveProfileId();
    return hasProfile ? <>{children}</> : <Navigate to="/onboarding" replace />;
};

function App() {
    useEffect(() => {
        loadSounds();

        let timeoutId = 0;
        const syncTheme = () => {
            applyThemeForCurrentTime();
        };
        const scheduleThemeSync = () => {
            timeoutId = window.setTimeout(() => {
                syncTheme();
                scheduleThemeSync();
            }, getMsUntilNextThemeCheck());
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                syncTheme();
            }
        };

        syncTheme();
        scheduleThemeSync();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearTimeout(timeoutId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return (
        <div className="app-container">
            <HashRouter>
                <Routes>
                    <Route path="/onboarding" element={<Onboarding />} />

                    <Route path="/battle" element={<Layout />}>
                        <Route index element={<Battle />} />
                    </Route>

                    <Route element={<Layout />}>
                        <Route path="/" element={
                            <PrivateRoute>
                                <Home />
                            </PrivateRoute>
                        } />
                        <Route path="/study" element={
                            <PrivateRoute>
                                <Study />
                            </PrivateRoute>
                        } />
                        <Route path="/stats" element={
                            <PrivateRoute>
                                <Stats />
                            </PrivateRoute>
                        } />
                        <Route path="/settings" element={
                            <PrivateRoute>
                                <Settings />
                            </PrivateRoute>
                        } />
                        <Route path="/settings/curriculum" element={
                            <PrivateRoute>
                                <CurriculumSettings />
                            </PrivateRoute>
                        } />
                        <Route path="/parents" element={
                            <PrivateRoute>
                                <ParentsPage />
                            </PrivateRoute>
                        } />
                        <Route path="/dev" element={<DevMode />} />
                    </Route>
                </Routes>
            </HashRouter>
        </div>
    )
}

export default App
