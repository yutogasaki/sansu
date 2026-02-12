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
import { loadSounds } from './utils/audio';
import { getActiveProfileId } from "./domain/user/repository";

// Mock auth check
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const hasProfile = getActiveProfileId();
    return hasProfile ? <>{children}</> : <Navigate to="/onboarding" replace />;
};

function App() {
    useEffect(() => {
        loadSounds();
    }, []);

    return (
        <HashRouter>
            <Routes>
                <Route path="/onboarding" element={<Onboarding />} />

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
    )
}

export default App
