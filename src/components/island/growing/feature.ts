/** The growing island (spec 52) replaces the island home only when this flag is on. */
export function growingIslandEnabled() {
    return import.meta.env.VITE_GROWING_ISLAND_ENABLED === 'true';
}
