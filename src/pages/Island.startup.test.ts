import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';

// Importing the shell must not evaluate any of its optional WebGL views.
// In DEV, an eager HomeJourney import otherwise loads Three even with Life on.
vi.mock('../components/island/homeJourney/HomeJourneyPreview', () => { throw new Error('Eager HomeJourney'); });
vi.mock('../components/island/life/IslandLife', () => { throw new Error('Eager IslandLife'); });
vi.mock('../components/island/IslandStage', () => { throw new Error('Eager IslandStage'); });
vi.mock('../components/island/three/runtime', () => { throw new Error('Eager IslandStage runtime'); });

it('keeps optional 3D modules behind their lazy render boundaries', async () => {
    expect((await import('./Island')).default).toBeTypeOf('function');
});
