export const ISLAND_SCREENS = ['home', 'help', 'learning', 'reward', 'inventory', 'placement', 'play', 'growth', 'album', 'customization', 'guide', 'experience', 'expression', 'showcase', 'workshop', 'camera', 'photos', 'shared', 'furniture', 'keepsakes', 'challenge'] as const;
export type IslandScreen = typeof ISLAND_SCREENS[number];
export type IslandHouseSection = 'home' | 'keepsakes' | 'notices';

export function islandHouseSectionFromSearch(search: string): IslandHouseSection {
    const query = new URLSearchParams(search);
    const section = query.get('house');
    return query.get('view') === 'keepsakes' && (section === 'keepsakes' || section === 'notices') ? section : 'home';
}

export function islandHouseUrl(section: IslandHouseSection) {
    return `/island?view=keepsakes${section === 'home' ? '' : `&house=${section}`}`;
}

export function islandScreenFromSearch(search: string): IslandScreen {
    const view = new URLSearchParams(search).get('view');
    return ISLAND_SCREENS.find(screen => screen === view && screen !== 'learning') ?? 'home';
}

export function islandLearningRequested(search: string) {
    const query = new URLSearchParams(search);
    return query.get('learn') === '1' || query.get('start') === 'learn';
}

export function withoutIslandLearning(pathname: string, search: string) {
    const query = new URLSearchParams(search);
    query.delete('learn'); query.delete('start'); query.delete('profile');
    return pathname + (query.size ? `?${query}` : '');
}

export function islandViewUrl(screen: IslandScreen) {
    return screen === 'home' ? '/island' : `/island?view=${screen}`;
}

export function islandFocusScreen(screen: IslandScreen, photo?: string | null) {
    return ['learning', 'placement', 'camera', 'showcase', 'workshop', 'reward', 'challenge'].includes(screen)
        || screen === 'photos' && Boolean(photo);
}

export function islandParentUrl(pathname: string, search: string) {
    if (islandLearningRequested(search)) return withoutIslandLearning(pathname, search);
    const query = new URLSearchParams(search);
    if (pathname === '/settings' && query.has('section')) return '/settings';
    if (pathname === '/settings/curriculum') return '/settings?section=learning';
    if (pathname === '/parents' || pathname === '/dev') return '/settings?section=parent';
    if (pathname === '/island') {
        if (islandHouseSectionFromSearch(search) !== 'home') return islandHouseUrl('home');
        if (query.get('view') === 'challenge') return islandViewUrl('keepsakes');
        if (query.has('photo')) return islandViewUrl('photos');
        if (query.get('view') === 'placement') return islandViewUrl('inventory');
        if (query.get('view') === 'camera') return islandViewUrl('photos');
    }
    return '/island';
}
