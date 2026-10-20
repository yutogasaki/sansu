import { newIsland } from './island';
import type { GrowingState } from './types';

export function architectureFixture(): GrowingState {
    const state = newIsland('architecture', 0); state.land = { expanded: 'east', extra: ['south', 'west'], capes: ['east'] };
    state.tutorial = 'done'; state.plots = []; state.landmarks = []; state.arrivals = []; state.unopened = [];
    state.nature.hours = 1000;
    for (const [id, x] of [['h1', 7], ['h2', 10]] as const) state.plots.push({ id, kind: 'home', cell: { x, z: 3 }, stage: 2, style: id === 'h1' ? 'plain' : 'tree', plantedAt: 0, builtAt: 0, growth: 0, origin: 'seed', paid: 40 });
    state.villagers = []; return state;
}
