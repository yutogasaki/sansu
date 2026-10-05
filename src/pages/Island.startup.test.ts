import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';

// Importing the shell must not evaluate any of its optional WebGL views.
vi.mock('../components/island/growing/GrowingIsland', () => { throw new Error('Eager GrowingIsland'); });
vi.mock('../components/island/IslandStage', () => { throw new Error('Eager IslandStage'); });
vi.mock('../components/island/three/runtime', () => { throw new Error('Eager IslandStage runtime'); });

it('keeps optional 3D modules behind their lazy render boundaries', async () => {
    expect((await import('./Island')).default).toBeTypeOf('function');
});
