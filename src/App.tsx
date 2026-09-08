import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
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
import { LaunchRoute } from "./components/park/LaunchRoute";
import { BUILD_PLAY_AVAILABLE } from "./domain/park/feature";
import { islandAvailable, islandEnabled } from "./domain/island/feature";
import { islandStudyDestination } from "./domain/island/studyRoute";

const Park = lazy(() => import('./pages/Park'));
const Island = lazy(() => import('./pages/Island'));

type ProfileResolution = "loading" | "ready" | "missing";

const StudyRoute = () => {
    const location = useLocation();
    const destination = islandStudyDestination(location.search, islandEnabled());
    return destination ? <Navigate to={destination} replace /> : <Study />;
};

const G0WhiteboxLab = (
    import.meta.env.DEV || import.meta.env.MODE === "test"
)
    ? lazy(() => import("./pages/dev/G0WhiteboxLab"))
    : null;

const G0MechanicRemixLab = (
    import.meta.env.DEV || import.meta.env.MODE === "test"
)
    ? lazy(() => import("./pages/dev/G0MechanicRemixLab"))
    : null;

const NumberSuikaLab = (
    import.meta.env.DEV || import.meta.env.MODE === "test"
)
    ? lazy(() => import("./pages/dev/NumberSuikaLab"))
    : null;

const WagerCoreLab = (
    import.meta.env.DEV || import.meta.env.MODE === "test"
)
    ? lazy(() => import("./pages/dev/WagerCoreLab"))
    : null;

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
                "/stats",
                "/explore",
                "/island",
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
        <div
            className="app-container"
            data-build-revision={__BUILD_REVISION__}
            data-delivery-id={__DELIVERY_ID__}
            data-configured-delivery-id={__DELIVERY_ID__}
            data-visual-lineage-id={__VISUAL_LINEAGE_ID__}
        >
            <HashRouter>
                <PwaRouteObserver />
                <Routes>
                    {WagerCoreLab && (
                        <Route
                            path="/__dev/wager"
                            element={(
                                <Suspense fallback={<Spinner fullScreen message="かけ探検を じゅんびちゅう..." />}>
                                    <WagerCoreLab />
                                </Suspense>
                            )}
                        />
                    )}

                    {NumberSuikaLab && (
                        <Route
                            path="/__dev/suika"
                            element={(
                                <Suspense fallback={<Spinner fullScreen message="かずのスイカを じゅんびちゅう..." />}>
                                    <NumberSuikaLab />
                                </Suspense>
                            )}
                        />
                    )}

                    {G0MechanicRemixLab && (
                        <Route
                            path="/__dev/g0-v2"
                            element={(
                                <Suspense fallback={<Spinner fullScreen message="G0 v2ラボを じゅんびちゅう..." />}>
                                    <G0MechanicRemixLab />
                                </Suspense>
                            )}
                        />
                    )}
                    {G0WhiteboxLab && (
                        <Route
                            path="/__dev/g0"
                            element={(
                                <Suspense fallback={<Spinner fullScreen message="G0ラボを じゅんびちゅう..." />}>
                                    <G0WhiteboxLab />
                                </Suspense>
                            )}
                        />
                    )}
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
                        <Route path="/" element={<LaunchRoute />} />
                        <Route path="/park" element={BUILD_PLAY_AVAILABLE ?
                            <PrivateRoute><Suspense fallback={<Spinner fullScreen message="ゆうえんちを じゅんびちゅう…" />}><Park /></Suspense></PrivateRoute>
                            : <Navigate to="/" replace />
                        } />
                        <Route path="/island" element={islandAvailable() ?
                            <PrivateRoute><Suspense fallback={<Spinner fullScreen message="しまを じゅんびちゅう…" />}><Island /></Suspense></PrivateRoute>
                            : <Navigate to="/" replace />
                        } />
                        <Route path="/study" element={
                            <PrivateRoute>
                                <StudyRoute />
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
