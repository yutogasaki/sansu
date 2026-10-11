/** Authored native-05 coordinates, in its unchanged world scale. */
export const NATIVE_ISLAND_VIEWS = {
    whole: { label: '島全体', position: [39, 43, 46], target: [3, 3.2, -6.3], span: 46 },
    grove: { label: '森と大樹', position: [8, 23, 8], target: [-5, 6.2, -15.7], span: 18 },
    spring: { label: '段泉と丘', position: [24, 24, 8], target: [3.1, 4.9, -15.8], span: 16 },
    harbor: { label: '入り江', position: [30, 21, 20], target: [14.1, 2.1, -2], span: 17 },
    garden: { label: '花の庭', position: [19, 15, 12], target: [5.6, 3.1, -4.2], span: 13 },
} as const;
export type NativeIslandView = keyof typeof NATIVE_ISLAND_VIEWS;
export type NativeIslandLight = 'day' | 'evening';

/** Whole view stays identical; the earlier close views frame their smaller places. */
export function nativeIslandView(name: NativeIslandView, state: 'small' | 'young' | 'grown') {
    if (name === 'whole' || state === 'grown') return NATIVE_ISLAND_VIEWS[name];
    if (name === 'grove') return { ...NATIVE_ISLAND_VIEWS.grove, target: [-4.8, state === 'small' ? 3.8 : 5.0, -16] as const };
    if (name === 'spring') return { ...NATIVE_ISLAND_VIEWS.spring, target: [1.0, state === 'small' ? 2.8 : 4, -13.5] as const };
    if (name === 'harbor' && state === 'small') return { ...NATIVE_ISLAND_VIEWS.harbor, position: [15, 14, 15] as const, target: [.1, 1.4, -1.8] as const };
    if (name === 'harbor') return NATIVE_ISLAND_VIEWS.harbor;
    return NATIVE_ISLAND_VIEWS[name];
}
