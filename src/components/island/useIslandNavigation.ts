import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { islandFocusScreen, islandHouseSectionFromSearch, islandHouseUrl, islandLearningRequested, islandParentUrl, islandScreenFromSearch, islandViewUrl, withoutIslandLearning, type IslandScreen, type IslandHouseSection } from '../../domain/island/navigation';
import { warmUpTTS } from '../../utils/tts';

export type IslandTab = 'island' | 'house' | 'stats' | 'settings';
type NavigationState = { islandParent?: { href: string; key: string }; islandTab?: IslandTab };
export const islandTabUrl = (tab: IslandTab) => tab === 'house' ? islandViewUrl('keepsakes') : `/${tab}`;

/** One live Island instance serves both its ordinary pages and focused learning.
 * Learning adds a query parameter to the current route, so its source page stays mounted. */
export function useIslandNavigationState(enabled: boolean) {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const targetProfile = query.get('profile');
    const isIsland = location.pathname === '/island';
    const learning = enabled && islandLearningRequested(location.search);
    const active = enabled && (isIsland || learning);
    const view = isIsland ? islandScreenFromSearch(location.search) : 'home';
    const houseSection = isIsland ? islandHouseSectionFromSearch(location.search) : 'home';
    const [blocked, setBlocked] = useState(false);
    // A discovery save can leave reading routes open while new learning must wait.
    const [learningBlocked, setLearningBlocked] = useState(false);
    const [visited, setVisited] = useState(active);
    const state = location.state as NavigationState | null;
    const tab: IslandTab = isIsland
        ? ['keepsakes', 'challenge'].includes(view) ? 'house' : view === 'home' ? 'island' : state?.islandTab ?? 'island'
        : location.pathname === '/stats' ? 'stats'
        : /^\/(settings(?:\/|$)|parents$|dev$)/.test(location.pathname) ? 'settings' : state?.islandTab ?? 'island';
    const [houseEntry, setHouseEntry] = useState(0);
    const photoId = isIsland ? query.get('photo') : null;
    const focus = active && (learning || islandFocusScreen(view, photoId));
    const href = location.pathname + location.search;
    const scrollPositions = useRef(new Map<string, { top: number; left: number }[]>());
    const learningTrigger = useRef<HTMLElement | null>(null);
    const scrollSurfaces = () => Array.from(document.querySelectorAll<HTMLElement>('.island-shell .brand-utility-screen > .overflow-y-auto, .island-shell .island-page, .island-shell .island-page > .island-sheet, .island-shell .island-home-actions'));
    const rememberScroll = useCallback(() => {
        scrollPositions.current.set(href, scrollSurfaces().map(element => ({ top: element.scrollTop, left: element.scrollLeft })));
    }, [href]);

    useLayoutEffect(() => { if (active) setVisited(true); }, [active]);
    useLayoutEffect(() => {
        const positions = scrollPositions.current.get(href);
        const frame = requestAnimationFrame(() => {
            if (positions) scrollSurfaces().forEach((element, index) => {
                element.scrollTop = positions[index]?.top ?? 0;
                element.scrollLeft = positions[index]?.left ?? 0;
            });
            if (!learning && learningTrigger.current) {
                const target = learningTrigger.current.isConnected ? learningTrigger.current : document.querySelector<HTMLElement>('.island-shell-tab--learn');
                target?.focus({ preventScroll: true });
                learningTrigger.current = null;
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [href, learning]);

    const open = useCallback((to: string, replace = false) => {
        if (blocked) return;
        rememberScroll();
        navigate(to, { replace, state: { islandTab: tab, islandParent: replace ? state?.islandParent : { href, key: location.key } } satisfies NavigationState });
    }, [blocked, navigate, tab, href, location.key, rememberScroll, state?.islandParent]);
    const back = useCallback(() => {
        if (blocked) return;
        if (state?.islandParent?.key && state.islandParent.href.startsWith('/') && !state.islandParent.href.startsWith('//')) navigate(-1);
        else navigate(islandParentUrl(location.pathname, location.search), { replace: true, state: { islandTab: tab } });
    }, [blocked, navigate, state, location.pathname, location.search, tab]);
    const setHouseSection = useCallback((next: IslandHouseSection) => {
        if (blocked || learning || view !== 'keepsakes' || next === houseSection) return;
        if (next === 'home' && state?.islandParent?.href === islandHouseUrl('home')) back();
        else open(islandHouseUrl(next), houseSection !== 'home');
    }, [blocked, learning, view, houseSection, state?.islandParent?.href, back, open]);
    const openPhotoGallery = useCallback(() => {
        const gallery = islandViewUrl('photos');
        if (view === 'camera' && state?.islandParent?.href === gallery) back();
        else open(gallery, view === 'camera');
    }, [view, state?.islandParent?.href, back, open]);
    const startLearning = useCallback(() => {
        if (blocked || learningBlocked || learning) return;
        learningTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        warmUpTTS();
        const next = new URLSearchParams(location.search);
        next.set('learn', '1');
        open(`${location.pathname}?${next}`);
    }, [blocked, learningBlocked, learning, location.pathname, location.search, open]);
    const setView = useCallback((screen: IslandScreen) => {
        if (screen === 'learning') { startLearning(); return; }
        // A committed placement/reward must not leave its transient editor in forward history.
        const replace = screen === 'home';
        if (replace) navigate('/island', { replace: true, state: { islandTab: 'island' } });
        else if (islandViewUrl(screen) !== href) open(islandViewUrl(screen));
    }, [startLearning, navigate, href, open]);
    const selectTab = useCallback((next: IslandTab) => {
        if (blocked) return;
        const target = islandTabUrl(next);
        if (next === 'house') setHouseEntry(value => value + 1);
        scrollPositions.current.delete(target);
        scrollSurfaces().forEach(element => { element.scrollTop = 0; element.scrollLeft = 0; });
        navigate(target, { state: { islandTab: next } });
    }, [blocked, navigate, setHouseEntry]);

    return useMemo(() => ({ enabled, active, isIsland, learning, view, focus, tab, houseEntry, houseSection, photoId, blocked, learningBlocked,
        mounted: enabled && (visited || active), targetProfile,
        open, back, startLearning, setView, selectTab, setHouseSection, openPhotoGallery, setBlocked, setLearningBlocked,
        ordinaryHref: withoutIslandLearning(location.pathname, location.search),
    }), [enabled, active, isIsland, learning, view, focus, tab, houseEntry, houseSection, photoId, blocked, learningBlocked, visited, targetProfile, open, back, startLearning, setView, selectTab, setHouseSection, openPhotoGallery, setBlocked, setLearningBlocked, location.pathname, location.search]);
}

export type IslandNavigation = ReturnType<typeof useIslandNavigationState>;
export const IslandNavigationContext = createContext<IslandNavigation | null>(null);
export const useIslandNavigation = () => useContext(IslandNavigationContext);
