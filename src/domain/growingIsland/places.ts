import { connectedWaterChannels, shadeInfluence, waterInfluence } from '../islandLife/waterChannels';
import { BLOOM_HOURS, TREE_MATURE_HOURS, waterLayout } from './environment';
import { treeAge } from './nature';
import { PLACE_CATALOG, placeInputCount } from './placeCatalog';
import { placeGalleryRoute, terrainHeightAt } from './placeTerrain';
import type { DerivedPlace, PlaceGoalId, PlaceStage, PlaceUseTarget } from './placeTypes';
import { distance, key, landBounds, neighbors, onLand, reachableFromHome, walkableCells, passageNeighbors, approachCells } from './space';
import type { Cell, GrowingState, Landmark, Plot } from './types';
import type { IslandWorld } from './worldDefinition';

type Located = { id: string; cell: Cell };
type LocatedLandmark = Landmark & Located;
type LocatedPlot = Plot & Located;
const stable = <T extends { id: string }>(items: readonly T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
const count = (id: PlaceGoalId, kind: string) => placeInputCount(id, kind);
const ATTACH = PLACE_CATALOG.common.attachmentMaxWalkCells;
const FREE = PLACE_CATALOG.common.gardenMinFreeCells;

/** Limits remain logical cells when a narrow shore uses finer walking points. */
export const placePathDistance = (path: readonly Cell[]) => path.slice(1).reduce((sum, cell, i) => sum + distance(path[i], cell), 0);
/** Multi-source shortest paths share one search across the entrances of a place. */
export function placeWalkSearch(open: Set<string>, starts: readonly Cell[], maxSteps = Infinity, world?: IslandWorld, target?: Cell) {
    const costs = new Map<string, number>(), previous = new Map<string, Cell | undefined>();
    type Entry = { cell: Cell; cost: number; order: number };
    const heap: Entry[] = []; let order = 0;
    const less = (a: Entry, b: Entry) => a.cost < b.cost || a.cost === b.cost && a.order < b.order;
    const push = (cell: Cell, cost: number) => {
        const entry = { cell, cost, order: order++ }; let at = heap.length; heap.push(entry);
        while (at > 0) { const parent = Math.floor((at - 1) / 2); if (!less(entry, heap[parent])) break; heap[at] = heap[parent]; at = parent; }
        heap[at] = entry;
    };
    const pop = () => {
        const result = heap[0], tail = heap.pop()!;
        if (heap.length) { let at = 0;
            while (at * 2 + 1 < heap.length) {
                let child = at * 2 + 1; if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
                if (!less(heap[child], tail)) break; heap[at] = heap[child]; at = child;
            }
            heap[at] = tail;
        }
        return result;
    };
    const siteKeys = world ? new Set(world.sites.map(site => key(site.cell))) : undefined;
    for (const cell of starts) if (open.has(key(cell)) && (!siteKeys || siteKeys.has(key(cell))) && !costs.has(key(cell))) {
        costs.set(key(cell), 0); previous.set(key(cell), undefined); push(cell, 0);
    }
    const visited = new Set<string>();
    while (heap.length) {
        const { cell, cost } = pop(), id = key(cell);
        if (visited.has(id) || cost !== costs.get(id)) continue;
        visited.add(id);
        if (target && id === key(target)) break;
        for (const next of passageNeighbors(cell, world)) {
            const nextId = key(next), nextCost = cost + distance(cell, next);
            if (!open.has(nextId) || nextCost > maxSteps || nextCost >= (costs.get(nextId) ?? Infinity)) continue;
            previous.set(nextId, cell); costs.set(nextId, nextCost); push(next, nextCost);
        }
    }
    return { costs, path(to: Cell): Cell[] | undefined {
        if (!costs.has(key(to))) return;
        const path: Cell[] = []; let at: Cell | undefined = to;
        while (at) { path.unshift(at); at = previous.get(key(at)); }
        return path;
    } };
}
export function placeWalkPath(open: Set<string>, from: Cell, to: Cell, maxSteps = Infinity, world?: IslandWorld): Cell[] | undefined {
    if (!open.has(key(from)) || !open.has(key(to))) return undefined;
    return placeWalkSearch(open, [from], maxSteps, world, to).path(to);
}

const endpointCells = (cell: Cell, reached: Set<string>, world?: IslandWorld) => [cell, ...approachCells(cell, world)].filter(c => reached.has(key(c)));
function accessDistanceFrom(search: ReturnType<typeof placeWalkSearch>, target: Cell, reached: Set<string>, world?: IslandWorld) {
    return Math.min(...endpointCells(target, reached, world).map(cell => (search.costs.get(key(cell)) ?? Infinity) + distance(cell, target)));
}
/** Only explicit join edges can merge owners; the straight free gap stays optional. */
export function placeConnected(a: Cell, b: Cell, open: Set<string>, world?: IslandWorld) {
    const d = distance(a, b);
    const joins = (from: Cell, to: Cell) => passageNeighbors(from, world, 'join').some(next => key(next) === key(to));
    if (d === 1) return joins(a, b);
    const gap = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    return d === 2 && (a.x === b.x || a.z === b.z) && open.has(key(gap)) && joins(a, gap) && joins(gap, b);
}
function components(items: Located[], connects: (a: Cell, b: Cell) => boolean) {
    const remaining = new Map(stable(items).map(item => [item.id, item])), out: Located[][] = [];
    while (remaining.size) {
        const start = remaining.values().next().value!;
        const group = [start]; remaining.delete(start.id);
        for (let i = 0; i < group.length; i++) for (const next of [...remaining.values()]) {
            if (!connects(group[i].cell, next.cell)) continue;
            group.push(next); remaining.delete(next.id);
        }
        out.push(stable(group));
    }
    return out;
}
function region(main: Located[], open: Set<string>, state: GrowingState, world?: IslandWorld) {
    const cells = new Map<string, Cell>();
    for (const item of main) {
        cells.set(key(item.cell), item.cell);
        const nearby = world ? world.sites.filter(site => distance(site.cell, item.cell) <= 1).map(site => site.cell) : neighbors(item.cell);
        for (const near of nearby) if ((world || onLand(state, near)) && open.has(key(near))) cells.set(key(near), near);
    }
    return [...cells.values()].sort((a, b) => a.z - b.z || a.x - b.x);
}
function gardenCells(main: Located[], reached: Set<string>, world?: IslandWorld) {
    const nearby = new Map<string, Cell>();
    for (const item of main) for (const cell of endpointCells(item.cell, reached, world)) nearby.set(key(cell), cell);
    return [...nearby.values()];
}
/** Attachments belong to the nearest component, with a stable ID tie. No double-use meshes. */
function attachments(groups: Located[][], items: Located[], reached: Set<string>, world?: IslandWorld) {
    const result = groups.map(() => [] as Located[]);
    const searches = groups.map(group => placeWalkSearch(reached, gardenCells(group, reached, world), ATTACH, world));
    for (const item of stable(items)) {
        const choices = groups.map((group, index) => ({ index, id: group[0].id,
            distance: accessDistanceFrom(searches[index], item.cell, reached, world) }))
            .filter(choice => choice.distance <= ATTACH).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
        if (choices[0]) result[choices[0].index].push(item);
    }
    return result;
}

/** Only an open, accessible interior can be a courtyard, before cluster/lane precedence. */
function enclosedByMain(main: Located[], center: Cell): boolean {
    if (main.length < 4) return false;
    const quadrants = [false, false, false, false];
    for (const item of main) {
        if (item.cell.x < center.x && item.cell.z < center.z) quadrants[0] = true;
        if (item.cell.x > center.x && item.cell.z < center.z) quadrants[1] = true;
        if (item.cell.x < center.x && item.cell.z > center.z) quadrants[2] = true;
        if (item.cell.x > center.x && item.cell.z > center.z) quadrants[3] = true;
    }
    return quadrants.every(Boolean);
}

export function placeShape(main: Located[], reached: Set<string>): 'court' | 'cluster' | 'lane' | 'freeform' {
    const occupied = new Set(main.map(item => key(item.cell)));
    const minX = Math.min(...main.map(i => i.cell.x)), maxX = Math.max(...main.map(i => i.cell.x));
    const minZ = Math.min(...main.map(i => i.cell.z)), maxZ = Math.max(...main.map(i => i.cell.z));
    if (main.length >= 4) for (let x = minX + 1; x < maxX; x++) for (let z = minZ + 1; z < maxZ; z++) {
        const center = { x, z };
        if (!reached.has(key(center))) continue;
        if (enclosedByMain(main, center)) return 'court';
    }
    for (const item of main) if ([{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: 1, z: 1 }]
        .every(delta => occupied.has(key({ x: item.cell.x + delta.x, z: item.cell.z + delta.z })))) return 'cluster';
    if (main.every(item => item.cell.x === minX) || main.every(item => item.cell.z === minZ)) return 'lane';
    return 'freeform';
}

function derivePlace(state: GrowingState, ruleId: DerivedPlace['ruleId'], family: DerivedPlace['family'], main: Located[], attached: Located[],
    reached: Set<string>, open: Set<string>, variant: string, connected: boolean, missing: string[], world?: IslandWorld): DerivedPlace {
    const members = stable([...main, ...attached]);
    const anchor = attached.find(item => state.plots.some(p => p.id === item.id && (p.kind === 'home' || p.kind === 'play'))) ?? main[0];
    const footprint = region([...main, ...attached], open, state, world);
    if (variant === 'court') {
        const included = new Set(footprint.map(key));
        // The actual open courtyard centre joins its surrounding lanes. Four-neighbour
        // owner regions alone omit this centre and leave a gallery on isolated pads.
        for (const id of reached) {
            const [x, z] = id.split(',').map(Number), cell = { x, z };
            if (included.has(id) || !open.has(id) || !(world ? world.floorAt(cell) : onLand(state, cell)) || !enclosedByMain(main, cell)) continue;
            footprint.push(cell); included.add(id);
        }
        footprint.sort((a, b) => a.z - b.z || a.x - b.x);
    }
    const entrances = footprint.filter(cell => reached.has(key(cell)));
    if ((world ? entrances.filter(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z)).length : entrances.length) < FREE) missing.push('はいれる すきまを あけよう');
    const stage: PlaceStage = !connected ? 'seeded' : missing.length ? 'connected' : 'grown';
    const useTargets: PlaceUseTarget[] = [];
    for (const member of members) {
        if (!endpointCells(member.cell, reached, world).length) continue;
        if (state.landmarks.some(item => item.id === member.id && item.kind === 'bench')) useTargets.push({ id: member.id, kind: 'seat', cell: member.cell });
        if (state.plots.some(item => item.id === member.id && item.kind === 'play' && item.stage > 0 && !state.unopened.includes(item.id)))
            useTargets.push({ id: member.id, kind: 'play', cell: member.cell });
    }
    const walkSurface = ruleId === 'P02' && stage === 'grown'
        ? placeGalleryRoute(state, { footprint, entrances }, anchor.cell, world) : [];
    if (walkSurface.length) useTargets.push({ id: `${anchor.id}:gallery`, kind: 'gallery', cell: walkSurface[0], route: walkSurface });
    if (ruleId === 'P03' && entrances.length) useTargets.push({ id: `${anchor.id}:shore`, kind: 'shore', cell: entrances[0] });
    const waterRefs = members.filter(item => state.landmarks.some(l => l.id === item.id && (l.kind === 'water-bowl' || l.kind === 'water-channel'))).map(i => i.id);
    const shadeRefs = members.filter(item => state.landmarks.some(l => l.id === item.id && l.kind === 'sapling')).map(i => i.id);
    const revision = JSON.stringify([PLACE_CATALOG.version, ruleId, variant, stage,
        members.map(member => [member.id, member.cell.x, member.cell.z]), footprint, entrances, walkSurface, useTargets]);
    return { id: `${ruleId}:${anchor.id}`, ruleId, family, anchorId: anchor.id, memberIds: members.map(i => i.id), mainIds: main.map(i => i.id),
        variant, stage, footprint, entrances, walkSurface, waterRefs, shadeRefs, useTargets, revision, missing };
}

/** Current shapes derive from owned objects only. No clocks/owners/rewards are changed here. */
export function derivePlaces(state: GrowingState, world?: IslandWorld): DerivedPlace[] {
    const open = walkableCells(state, world), reached = reachableFromHome(state, open, world), places: DerivedPlace[] = [];
    const landmarks = stable(state.landmarks.filter((l): l is LocatedLandmark => !!l.cell && onLand(state, l.cell, world)));
    const plots = stable(state.plots.filter((p): p is LocatedPlot => !!p.cell && onLand(state, p.cell, world) && !state.unopened.includes(p.id)));
    const benches = landmarks.filter(l => l.kind === 'bench');
    const trees = landmarks.filter(l => l.kind === 'sapling');
    const groves = components(trees, (a, b) => placeConnected(a, b, open, world));
    const groveSeats = attachments(groves, benches, reached, world);
    const treeHomes = attachments(groves, plots.filter(p => p.kind === 'home' && p.style === 'tree'), reached, world);
    groves.forEach((main, index) => {
        const homes = treeHomes[index], seats = groveSeats[index], mature = main.filter(t => (t as Landmark).growth >= TREE_MATURE_HOURS);
        const big = main.filter(t => ['big', 'lord'].includes(treeAge(state, t.id)));
        const enoughBigPlace = main.length >= count('P02', 'landmark:sapling') && homes.length > 0;
        for (const id of (enoughBigPlace ? ['P01', 'P02'] : ['P01']) as DerivedPlace['ruleId'][]) {
            const missing: string[] = [];
            if (main.length < count(id, 'landmark:sapling')) missing.push('木を よせてみよう');
            if (mature.length < count(id, 'landmark:sapling')) missing.push('木が そだつのを たのしもう');
            if (!seats.length) missing.push('木のそばに ベンチを おこう');
            else if (mature.length >= count(id, 'landmark:sapling') && !seats.some(seat => shadeInfluence(waterLayout(state, world), seat.cell) > 0))
                missing.push('木陰へ ベンチを よせよう');
            if (id === 'P02') {
                if (big.length < 2) missing.push('大木が そだつのを たのしもう');
                if (!homes.some(h => (h as Plot).stage >= 2)) missing.push('木のいえが そだつのを たのしもう');
            }
            const shape = placeShape(main, reached);
            let variant: string = shape;
            if (id === 'P01') {
                const seat = seats[0];
                const narrow = main.length === 2 && distance(main[0].cell, main[1].cell) === 1;
                const edge = seat && (seat.cell.x <= Math.min(...main.map(t => t.cell.x)) || seat.cell.x >= Math.max(...main.map(t => t.cell.x)));
                variant = narrow ? 'corner' : edge ? 'alcove' : 'lane';
            }
            places.push(derivePlace(state, id, 'grove', main, [...(id === 'P02' ? homes : []), ...seats], reached, open, variant,
                main.length >= count(id, 'landmark:sapling') && seats.length > 0, missing, world));
        }
    });

    const flowers = landmarks.filter(l => l.kind === 'flower');
    const flowerGroups = components(flowers, (a, b) => placeConnected(a, b, open, world));
    const flowerSeats = attachments(flowerGroups, benches, reached, world);
    flowerGroups.forEach((main, index) => {
        if (main.length < 2) return;
        const missing: string[] = [], seats = flowerSeats[index];
        if (main.length < count('P05', 'landmark:flower')) missing.push('花を よせてみよう');
        if (main.filter(f => (f as Landmark).growth >= BLOOM_HOURS).length < count('P05', 'landmark:flower')) missing.push('花が ひらくのを たのしもう');
        if (!seats.length) missing.push('花のそばに ベンチを おこう');
        const shape = placeShape(main, reached), variant = shape === 'lane' ? 'arch' : shape === 'cluster' ? 'canopy' : shape;
        places.push(derivePlace(state, 'P05', 'flowers', main, seats, reached, open, variant,
            main.length >= count('P05', 'landmark:flower') && seats.length > 0, missing, world));
    });

    const water = landmarks.filter(l => l.kind === 'water-bowl' || l.kind === 'water-channel');
    const channels = connectedWaterChannels(waterLayout(state, world));
    const waterGroups = components(water.filter(l => l.kind === 'water-bowl' || channels.has(key(l.cell))), (a, b) => passageNeighbors(a, world, 'water').some(cell => key(cell) === key(b)));
    const waterSeats = attachments(waterGroups, benches, reached, world);
    const watersideFlowers = attachments(waterGroups, flowers, reached, world);
    const bounds = landBounds(state);
    const nearShore = (cell: Cell, radius: number) => world
        ? Array.from({ length: 16 }, (_, i) => i * Math.PI / 8).some(angle => !world.floorAt({ x: cell.x + Math.cos(angle) * radius, z: cell.z + Math.sin(angle) * radius }))
        : cell.z >= bounds.depth - radius || cell.x <= bounds.minX + radius - 1 || cell.x >= bounds.maxX - radius + 1;
    waterGroups.forEach((main, index) => {
        const bowls = main.filter(w => (w as Landmark).kind === 'water-bowl');
        if (!bowls.length || main.length < 2) return;
        const supplied = main.filter(w => (w as Landmark).kind === 'water-channel' && channels.has(key(w.cell)));
        const seats = waterSeats[index], flowersHere = watersideFlowers[index];
        const missing: string[] = [];
        if (bowls.length < count('P03', 'landmark:water-bowl')) missing.push('水ばちを みずみちで つなごう');
        if (supplied.length < count('P03', 'landmark:water-channel')) missing.push('水のとおる みずみちを つなごう');
        if (!flowersHere.some(f => (f as Landmark).growth >= BLOOM_HOURS)) missing.push('水のそばで 花を そだてよう');
        if (!seats.length) missing.push('岸のそばに ベンチを おこう');
        const heights = bowls.map(b => terrainHeightAt(state, b.cell, world));
        const descending = Math.max(...heights) - Math.min(...heights) >= .2 && supplied.every(channel => {
            const adjacent = main.filter(other => distance(channel.cell, other.cell) === 1);
            return adjacent.length < 2 || adjacent.some(a => terrainHeightAt(state, a.cell, world) > terrainHeightAt(state, channel.cell, world) + .005)
                && adjacent.some(a => terrainHeightAt(state, a.cell, world) < terrainHeightAt(state, channel.cell, world) - .005);
        });
        const onShore = bowls.every(b => world ? nearShore(b.cell, 2) : b.cell.z >= bounds.depth - 3 || b.cell.x <= bounds.minX + 1 || b.cell.x >= bounds.maxX - 1);
        const variant = descending ? 'tiered' : onShore ? 'shore' : 'curve';
        places.push(derivePlace(state, 'P03', 'spring', main, [...flowersHere, ...seats], reached, open, variant,
            bowls.length >= count('P03', 'landmark:water-bowl') && supplied.length >= count('P03', 'landmark:water-channel') && seats.length > 0 && flowersHere.length > 0, missing, world));
    });

    const plays = plots.filter(p => p.kind === 'play'), homes = plots.filter(p => p.kind === 'home');
    // A shared courtyard reaches two cells around the play; homes join its open perimeter.
    const playRegions = plays.map(play => region([play], open, state, world).flatMap(cell => [cell, ...passageNeighbors(cell, world)])
        .filter(cell => reached.has(key(cell))));
    const assignedHomes = plays.map(() => [] as LocatedPlot[]);
    const playSearches = playRegions.map(region => placeWalkSearch(reached, region, ATTACH, world));
    for (const home of homes) {
        const closest = plays.map((play, index) => ({ index, id: play.id,
            distance: accessDistanceFrom(playSearches[index], home.cell, reached, world) }))
            .filter(c => c.distance <= ATTACH).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
        if (closest) assignedHomes[closest.index].push(home);
    }
    plays.forEach((play, index) => {
        const nearby = assignedHomes[index];
        if (!nearby.length) return;
        const supplied = landmarks.filter(l => l.kind === 'water-bowl'
            && waterInfluence({ items: [{ kind: 'water-bowl', cell: l.cell, growth: l.growth }] }, play.cell) > 0);
        const main = stable([play, ...nearby]);
        const onShore = main.some(item => nearShore(item.cell, 2));
        const missing: string[] = [];
        if (nearby.length < count('P04', 'plot:home')) missing.push('あそびばのそばに いえを よせよう');
        if (nearby.filter(h => h.stage >= 2).length < count('P04', 'plot:home')) missing.push('いえが そだつのを たのしもう');
        if (!play.stage) missing.push('あそびばが そだつのを たのしもう');
        if (!supplied.length) missing.push('あそびばへ 水を とどけよう');
        if (!onShore) missing.push('海のそばへ よせてみよう');
        const homeZ = Math.min(...nearby.map(h => h.cell.z)), minX = Math.min(...nearby.map(h => h.cell.x)), maxX = Math.max(...nearby.map(h => h.cell.x));
        const bowlBetween = supplied.some(b => b.cell.x > minX && b.cell.x < maxX);
        const variant = play.cell.z - homeZ >= 2 && !bowlBetween ? 'court' : bowlBetween ? 'bay' : 'lane';
        places.push(derivePlace(state, 'P04', 'community', main, supplied, reached, open, variant,
            nearby.length >= count('P04', 'plot:home') && supplied.length > 0 && onShore, missing, world));
    });
    // A shared bench is still one owner. Assign it across families, not once per renderer.
    // P01/P02 are two milestones of the same grove and keep the same physical seat.
    const owners = new Map([...landmarks, ...plots].map(item => [item.id, item]));
    const reassigned = new Set<DerivedPlace>();
    for (const bench of benches) {
        const candidates = places.filter(p => p.memberIds.includes(bench.id) && p.stage !== 'seeded');
        const choices = candidates.map(place => ({ place, group: `${place.family}:${place.mainIds.join(',')}`,
            distance: accessDistanceFrom(placeWalkSearch(reached, gardenCells(place.mainIds.map(id => owners.get(id)!).filter(Boolean), reached, world), ATTACH, world), bench.cell, reached, world) }))
            .sort((a, b) => a.distance - b.distance || a.place.anchorId.localeCompare(b.place.anchorId));
        const chosen = choices[0]?.group;
        for (const candidate of choices) if (candidate.group !== chosen) {
            const place = candidate.place;
            reassigned.add(place);
            place.memberIds = place.memberIds.filter(id => id !== bench.id);
            place.useTargets = place.useTargets.filter(target => target.id !== bench.id);
            if (!place.useTargets.some(target => target.kind === 'seat')) {
                place.stage = 'connected'; place.missing.push('この庭の ベンチを おこう');
                place.walkSurface = []; place.useTargets = place.useTargets.filter(target => target.kind !== 'gallery');
            }
            place.revision = JSON.stringify([place.revision, place.memberIds, place.stage]);
        }
    }
    return places.map(place => {
        if (!reassigned.has(place)) return place;
        const main = place.mainIds.map(id => owners.get(id)!).filter(Boolean);
        const attached = place.memberIds.filter(id => !place.mainIds.includes(id)).map(id => owners.get(id)!).filter(Boolean);
        const seats = attached.filter(item => landmarks.some(l => l.id === item.id && l.kind === 'bench'));
        const missing = place.missing.filter(line => !line.includes('ベンチ'));
        if (!seats.length) missing.push('この庭の ベンチを おこう');
        else if (place.family === 'grove' && main.filter(item => (item as Landmark).growth >= TREE_MATURE_HOURS).length >= count(place.ruleId, 'landmark:sapling')
            && !seats.some(seat => shadeInfluence(waterLayout(state, world), seat.cell) > 0)) missing.push('木陰へ ベンチを よせよう');
        return derivePlace(state, place.ruleId, place.family, main, attached, reached, open, place.variant,
            place.stage !== 'seeded' && seats.length > 0, missing, world);
    }).sort((a, b) => a.id.localeCompare(b.id));
}
