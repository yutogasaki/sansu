import { expect, it } from 'vitest';
import { beginFoodLoop, growFood } from '../../../domain/islandLife/foodLoop';
import { newLife } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';

it.each(['moon-garden-v1', 'fantasy-garden-v1'] as const)('shows the harvested planter and cargo on the same island resident in %s', worldStyle => {
    const state = replayLife(newLife('food-scene', 0));
    state.worldStyle = worldStyle;
    state.items = [
        { id: 'herbs', kind: 'planter', cell: { x: 0, z: 3 }, style: 'original', growth: 0 },
        { id: 'table', kind: 'picnic-table', cell: { x: 4, z: 3 }, style: 'original', growth: 0 },
    ];
    beginFoodLoop(state); growFood(state, 2);
    state.residents[2].cell = { x: 0, z: 4 };
    state.residents[2].foodTrip = { sourceId: 'herbs', tableId: 'table', phase: 'carry',
        toTable: [{ x: 0, z: 4 }, { x: 1, z: 4 }, { x: 2, z: 4 }, { x: 3, z: 4 }, { x: 4, z: 4 }] };
    state.residents[2].visit = { itemId: 'table', from: { x: 0, z: 4 }, path: state.residents[2].foodTrip.toTable, start: 0, end: 10000 };
    const scene = buildLifeScene(state);
    try {
        scene.animate(1000, true);
        expect(scene.audit().find(p => p.id === 'otter')?.foodCargo).toBe(true);
        const cargos: boolean[] = []; scene.root.traverse(object => { if (object.name === 'life-food-cargo') cargos.push(object.visible); });
        expect(cargos.filter(Boolean)).toHaveLength(1);
        expect(scene.root.getObjectByName('life-item-herbs')?.children.some(child => child.userData.foodStage === 2)).toBe(true);
    } finally { scene.dispose(); }
});
