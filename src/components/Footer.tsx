import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icons } from "./icons";
import { warmUpTTS } from "../utils/tts";
import { islandEnabled } from "../domain/island/feature";
import { IslandToyHouse, IslandToyLand } from "./island/IslandToyIcon";
import { islandTabUrl, type IslandTab, useIslandNavigation } from './island/useIslandNavigation';
import { useWaitingSeeds } from './island/growing/seedBadge';

type TabItem = {
    to: string;
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
    activePaths?: string[];
    tab?: IslandTab;
};

export const Footer: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;
    const islandHome = islandEnabled();
    const navigation = useIslandNavigation();
    const seeds = useWaitingSeeds();
    const startLearning = () => {
        warmUpTTS();
        if (navigation) navigation.startLearning();
        else navigate('/study');
    };

    if (islandHome) {
        const tabs: TabItem[] = [
            { to: "/island", icon: IslandToyLand, label: "しま", tab: "island" },
            { to: islandTabUrl("house"), icon: IslandToyHouse, label: "いえ", tab: "house" },
            { to: "/study", icon: Icons.Study, label: "まなぶ" },
            { to: "/stats", icon: Icons.Stats, label: "きろく", tab: "stats" },
            { to: "/settings", icon: Icons.Settings, label: "設定", tab: "settings" },
        ];

        const compactHome = navigation?.active && navigation.view === 'home' && !navigation.learning;
        return (
            <nav className={`island-shell-nav${compactHome ? ' island-shell-nav--home' : ''}`} aria-label="メインメニュー">
                {tabs.filter(item => !compactHome || item.to === '/study').map(item => {
                    const active = item.to === "/study" && currentPath === "/learn"
                        ? true : currentPath === "/learn" ? false : navigation ? item.tab === navigation.tab : currentPath === item.to;
                    const primary = item.to === "/study";
                    const waiting = primary && seeds > 0 ? seeds : 0;
                    return (
                        <button
                            key={item.to}
                            type="button"
                            className={`island-shell-tab${primary ? " island-shell-tab--learn island-start" : ""}`}
                            aria-label={waiting ? `${item.label}（たねが ${waiting}こ まってるよ）` : item.label}
                            aria-current={active ? "page" : undefined}
                            disabled={navigation?.blocked || (primary && navigation?.learningBlocked)}
                            onClick={() => {
                                if (navigation) {
                                    if (primary) void startLearning();
                                    else if (item.tab) navigation.selectTab(item.tab);
                                } else { if (primary) void startLearning(); else navigate(item.to); }
                            }}
                        >
                            <item.icon width={24} height={24} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                            <span>{item.label}{waiting > 0 && <span aria-hidden="true"> 🌱{waiting}</span>}</span>
                        </button>
                    );
                })}
            </nav>
        );
    }

    const leftTabs: TabItem[] = [
        { to: "/explore", icon: Icons.Explore, label: "たんけん" },
        { to: "/stats", icon: Icons.Stats, label: "きろく" },
    ];

    const rightTabs: TabItem[] = [
        { to: "/battle", icon: Icons.Play, label: "基地" },
        { to: "/settings", icon: Icons.Settings, label: "せってい", activePaths: ["/settings", "/parents", "/dev"] },
    ];

    const renderTab = (item: TabItem) => {
        const activePaths = item.activePaths ?? [item.to];
        const isActive = activePaths.some((path) => (
            path === "/"
                ? currentPath === "/"
                : currentPath === path || currentPath.startsWith(`${path}/`)
        ));

        return (
            <button
                key={item.to}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                    if (item.to === currentPath) return;
                    navigate(item.to);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 border-none bg-transparent px-4 py-2 transition-colors duration-200 ${isActive ? "text-teal-500" : "text-slate-400"}`}
            >
                <item.icon
                    width={22}
                    height={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="pointer-events-none"
                    aria-hidden="true"
                />
                <span className="pointer-events-none text-[10px] font-medium font-[var(--font-body)]">
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <nav className="fixed bottom-0 left-1/2 z-50 flex w-[min(100%,430px)] -translate-x-1/2 items-center justify-around border-t border-[var(--brand-paper-edge)] bg-[var(--toolbar-bg)] shadow-[var(--toolbar-shadow)] h-[calc(56px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]">

            {leftTabs.map(renderTab)}

            <button
                className="fab"
                type="button"
                aria-label="まなぶ"
                onClick={() => {
                    void startLearning();
                }}
            >
                <Icons.Study
                    width={26}
                    height={26}
                    strokeWidth={2.6}
                    color="#FFFFFF"
                    aria-hidden="true"
                />
            </button>

            {rightTabs.map(renderTab)}
        </nav>
    );
};
