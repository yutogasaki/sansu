import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useEffect, useLayoutEffect, useState } from "react";
import { Onboarding } from "./pages/Onboarding";
import { Study } from "./pages/Study";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { CurriculumSettings } from "./pages/CurriculumSettings";
import { DevMode } from "./pages/DevMode";
import { ParentsPage } from "./pages/parents/ParentsPage";
import { Battle } from "./pages/Battle";
import { GameHub } from "./pages/GameHub";
import { Explore } from "./pages/Explore";
import { Spinner } from "./components/ui/Spinner";
import { loadSounds, setSoundEnabled } from "./utils/audio";
import { getActiveProfile } from "./domain/user/repository";
import { applyThemeForCurrentTime, getMsUntilNextThemeCheck } from "./utils/theme";
import { notifyPwaRouteNavigation } from "./pwa";

type ProfileResolution = "loading" | "ready" | "missing";

const PwaRouteObserver = () => {
    const location = useLocation();
    const navigate = useNavigate();

    useLayoutEffect(() => {
        notifyPwaRouteNavigation(
            `${location.pathname}${location.search}`,
            location.key,
        );
    }, [location.key, location.pathname, location.search]);

    useEffect(() => {
        const e2eWindow = window as Window & { __SANSU_PWA_E2E__?: boolean };
        if (!e2eWindow.__SANSU_PWA_E2E__) return;

        const handleE2ENavigation = (event: Event) => {
            const destination = (event as CustomEvent<{ to?: string }>).detail?.to;
            if (!destination || ![
                "/onboarding",
                "/study",
                "/explore",
                "/battle/play",
            ].includes(destination)) return;
            navigate(destination);
        };

        window.addEventListener("sansu:pwa-e2e-navigate", handleE2ENavigation);
        return () => window.removeEventListener("sansu:pwa-e2e-navigate", handleE2ENavigation);
    }, [navigate]);

    return null;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    const [resolution, setResolution] = useState<ProfileResolution>("loading");

    useEffect(() => {
        let cancelled = false;

        void getActiveProfile()
            .then((profile) => {
                if (cancelled) return;

                if (!profile) {
                    setSoundEnabled(false);
                    setResolution("missing");
                    return;
                }

                // Apply the resolved profile setting before mounting a page that may play audio.
                setSoundEnabled(profile.soundEnabled);
                setResolution("ready");
            })
            .catch(() => {
                if (cancelled) return;
                setSoundEnabled(false);
                setResolution("missing");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (resolution === "loading") {
        return <Spinner fullScreen message="プロフィールを よみこみちゅう..." />;
    }

    return resolution === "ready" ? <>{children}</> : <Navigate to="/onboarding" replace />;
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
                <PwaRouteObserver />
                <Routes>
                    <Route path="/onboarding" element={<Onboarding />} />

                    <Route path="/battle" element={<Layout />}>
                        <Route path="play" element={
                            <PrivateRoute>
                                <Battle />
                            </PrivateRoute>
                        } />
                        <Route index element={
                            <PrivateRoute>
                                <GameHub />
                            </PrivateRoute>
                        } />
                    </Route>

                    <Route element={<Layout />}>
                        <Route path="/" element={<Navigate to="/explore" replace />} />
                        <Route path="/study" element={
                            <PrivateRoute>
                                <Study />
                            </PrivateRoute>
                        } />
                        <Route path="/explore" element={
                            <PrivateRoute>
                                <Explore />
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
