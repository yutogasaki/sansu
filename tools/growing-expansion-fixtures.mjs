import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaceDomain, makePlacePack, addDiagnosticLayout, nativeCase } from './growing-place-fixtures.mjs';
import { hash, stableJSON } from './growing-fixture-data.mjs';

const plans = {
    bay: { name: '入り江を抱く島', sides: ['west', 'west', 'east', 'east'], lane: { x: -6, z: 1 }, garden: { x: 15, z: 5 },
        homes: [{ x: -5, z: 5 }, { x: -2, z: 6 }, { x: -4, z: 8 }, { x: -1, z: 9 }, { x: 16, z: 2 }, { x: 19, z: 4 }, { x: 19, z: 9 }],
        more: ['west', 'east', 'south', 'south', 'south'], nextLane: { x: -9, z: 12 }, nextGarden: { x: 15, z: 12 } },
    forest: { name: '森の回廊が伸びる島', sides: ['east', 'east', 'east', 'east'], lane: { x: 15, z: 0 }, garden: { x: 20, z: 5 },
        homes: [{ x: 16, z: 4 }, { x: 19, z: 4 }, { x: 21, z: 2 }, { x: 24, z: 3 }, { x: 25, z: 6 }, { x: 20, z: 9 }, { x: 24, z: 9 }],
        more: ['east', 'east', 'east', 'east', 'south', 'south'], nextLane: { x: 27, z: 1 }, nextGarden: { x: 31, z: 7 } },
    garden: { name: '丘と庭が連なる島', sides: ['south', 'south', 'south', 'south'], lane: { x: 0, z: 11 }, garden: { x: 8, z: 11 },
        homes: [{ x: 1, z: 16 }, { x: 4, z: 16 }, { x: 6, z: 12 }, { x: 7, z: 16 }, { x: 10, z: 17 }, { x: 12, z: 20 }, { x: 8, z: 21 }],
        more: ['south', 'south', 'south', 'south', 'east', 'east'], nextLane: { x: 1, z: 24 }, nextGarden: { x: 8, z: 25 } },
};
function addHome(domain, state, cell, serial) {
    state = domain.applyIntent(state, { id: `qa-expansion-home-${serial}`, command: { type: 'plant', kind: 'home', cell } }).state;
    const home = state.plots.find(p => p.kind === 'home' && p.cell.x === cell.x && p.cell.z === cell.z);
    Object.assign(home, { stage: 4, builtAt: 0, stagedAt: 0, style: ['plain', 'water', 'tree', 'flower', 'light'][serial % 5], roof: serial % 7 });
    state.unopened = []; state.arrivals = [];
    return state;
}
const materials = state => [...state.plots, ...state.landmarks].map(item => ({ id: item.id, kind: item.kind, stage: item.stage, growth: item.growth, style: item.style, roof: item.roof })).sort((a, b) => a.id.localeCompare(b.id));

/** A comparison pack, never earned learning or a new production save mode. All
 * three 16-home alternatives contain the same owned materials and maturity. */
export async function makeExpansionPack(root = process.cwd()) {
    const pack = await makePlacePack(root), { domain } = await loadPlaceDomain(root);
    const base = pack.cases.find(entry => entry.id === 'qa-place-whole-island-v1').island.state;
    const oldOwners = [...base.plots, ...base.landmarks];
    const extra = [];
    for (const [direction, plan] of Object.entries(plans)) {
        const id = `qa-place-expansion-${direction}-16-v1`;
        let state = structuredClone(base); state.seed = id; state.land.districts.push(...plan.sides);
        state = addDiagnosticLayout(domain, state, 'P02', 'lane', plan.lane, 'expansion-lane').state;
        state = addDiagnosticLayout(domain, state, 'P05', 'canopy', plan.garden, 'expansion-garden').state;
        for (const [i, cell] of plan.homes.entries()) state = addHome(domain, state, cell, i);
        state.plots.filter(p => p.kind === 'home').forEach(p => { p.stage = 4; });
        const case16 = nativeCase(domain, id, state, { homes: 16, homeStage: 4, places: [{ ruleId: 'P02', variant: 'lane' }] });
        case16.expansion = { name: plan.name, direction, size: 16, addedLand: plan.sides, oldHomeCount: 8, wholeComparison: 'Equal owned materials and maturity; land directions and placement differ.' };
        extra.push(case16);

        const id32 = `qa-place-expansion-${direction}-32-v1`, before = structuredClone(state);
        state = structuredClone(state);
        state.seed = id32; state.land.districts.push(...plan.more);
        state = addDiagnosticLayout(domain, state, 'P01', 'lane', plan.nextLane, 'expansion-next-lane').state;
        state = addDiagnosticLayout(domain, state, 'P05', 'arch', plan.nextGarden, 'expansion-next-garden').state;
        const originalCells = new Set(domain.landCells(before).map(domain.key));
        const free = domain.landCells(state).filter(cell => !originalCells.has(domain.key(cell)) && cell.x % 2 === 0 && cell.z % 2 === 0
            && !domain.occupant(state, cell) && !domain.occupant(state, { x: cell.x, z: cell.z + 1 }));
        // Spread small settlement groups through the actual new district, keeping
        // doors and a low route open. No fictional houses on unowned sea cells.
        const spread = free.filter((_, i) => i % 3 === 0).concat(free.filter((_, i) => i % 3 !== 0));
        let serial = 7;
        for (const cell of spread) {
            if (state.plots.filter(p => p.kind === 'home').length === 32) break;
            if (domain.occupant(state, cell)) continue;
            try { state = addHome(domain, state, cell, serial++); } catch (error) {
                if (!/いけない|あけて/.test(error.message)) throw error;
            }
        }
        assert.equal(state.plots.filter(p => p.kind === 'home').length, 32);
        const case32 = nativeCase(domain, id32, state, { homes: 32, homeStage: 4, places: [{ ruleId: 'P02', variant: 'lane' }] });
        case32.expansion = { name: plan.name, direction, size: 32, addedLand: [...plan.sides, ...plan.more], oldHomeCount: 16,
            wholeComparison: 'Diagnostic district growth; every old owner retains its cell, style and maturity.' };
        for (const owner of [...before.plots, ...before.landmarks]) assert.deepEqual([...state.plots, ...state.landmarks].find(item => item.id === owner.id), owner);
        extra.push(case32);
        for (const owner of oldOwners) assert.deepEqual([...case16.island.state.plots, ...case16.island.state.landmarks].find(item => item.id === owner.id), owner);
        assert.equal(case16.island.state.seed, case16.id);
        assert.equal(case32.island.state.seed, case32.id);
        assert.deepEqual(case16.island.state.land.districts, [...base.land.districts, ...plan.sides]);
    }
    for (const size of [16, 32]) {
        const alternatives = extra.filter(entry => entry.expansion.size === size);
        for (const entry of alternatives.slice(1)) assert.deepEqual(materials(entry.island.state), materials(alternatives[0].island.state));
    }
    pack.sources['tools/growing-expansion-fixtures.mjs'] = hash(await fs.readFile(path.join(root, 'tools/growing-expansion-fixtures.mjs')));
    pack.sourceHash = hash(stableJSON(pack.sources)); pack.cases.push(...extra); pack.payloadHash = hash(stableJSON(pack.cases));
    return pack;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output NEW_FILE');
    const pack = await makeExpansionPack(); await fs.writeFile(process.argv[3], `${JSON.stringify(pack, null, 2)}\n`, { flag: 'wx' });
    console.log(`Created ${pack.cases.length} explicit place/whole-island diagnostics`);
}
