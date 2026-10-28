import { key, type Island, type Owner } from './model';

// Diagnostic island built only from the saved data shape: acquired cells, integer
// heights and owned items. 'w' = dug one step below the meadow (water).
const MAP = [
    '...0111221....',
    '..0111222110..',
    '.001112221100.',
    '.0001111111000',
    '00000ww0001100',
    '0000www0001100',
    '.0000w0001110.',
    '.0000ww0111100',
    '..000.w00110..',
    '...00..000....',
];

export function sampleIsland(): Island {
    const land: string[] = [], heights: Record<string, number> = {};
    MAP.forEach((row, z) => [...row].forEach((c, x) => {
        if (c === '.') return;
        land.push(key(x, z));
        const l = c === 'w' ? -1 : Number(c);
        if (l) heights[key(x, z)] = l;
    }));
    const o = (id: string, kind: Owner['kind'], x: number, z: number, rot = 0, variant = ''): Owner => ({ id, kind, cell: [x, z], rot, variant });
    const owners: Owner[] = [
        o('big', 'bigtree', 7, 0, 0, 'bigtree'),
        o('h1', 'house', 1, 3, 0, 'house:Original home'), o('h2', 'house', 2, 6, 1, 'house:Forest / blue home'),
        o('h3', 'house', 3, 8, 2, 'house:Forest / yellow home'), o('h4', 'house', 3, 4, 0, 'house:Garden / small home'),
        o('h5', 'house', 10, 1, 0, 'house:Hill / rose terrace home'), o('h6', 'house', 12, 4, 0, 'house:Hill / upper yellow home'),
        o('h7', 'house', 12, 7, 2, 'house:Water town / blue home'), o('h8', 'house', 9, 8, 2, 'house:Village / coral house'),
        o('t1', 'tree', 4, 0, 0, 'tree:willow:0'), o('t2', 'tree', 5, 1, 0, 'tree:willow:1'), o('t3', 'tree', 3, 1, 0, 'tree:spire:0'),
        o('t4', 'tree', 4, 2, 0, 'tree:birch:0'), o('t5', 'tree', 2, 2, 0, 'tree:orchard:0'), o('t6', 'tree', 0, 5, 0, 'tree:willow:2'),
        o('t7', 'tree', 1, 7, 0, 'tree:spire:1'), o('t8', 'tree', 13, 3, 0, 'tree:birch:1'), o('t9', 'tree', 4, 9, 0, 'tree:orchard:1'),
        o('t10', 'tree', 11, 1, 0, 'tree:spire:2'), o('t11', 'tree', 6, 3, 0, 'tree:birch:2'),
        o('c1', 'canopy', 10, 6, 0, 'canopy'), o('f3', 'tree', 10, 8, 0, 'orchard:1'), o('f4', 'tree', 11, 3, 0, 'orchard:2'), o('f5', 'tree', 2, 8, 0, 'orchard:3'),
        o('t12', 'tree', 5, 0, 0, 'tree:willow:3'), o('t13', 'tree', 6, 0, 0, 'tree:birch:0'), o('t14', 'tree', 3, 2, 0, 'tree:willow:1'),
        o('t15', 'tree', 5, 3, 0, 'tree:willow:0'), o('t16', 'tree', 13, 5, 0, 'tree:birch:1'), o('t17', 'tree', 1, 5, 0, 'orchard:4'),
        o('b1', 'bench', 7, 5, 3, 'bench'), o('b2', 'bench', 9, 2, 0, 'bench'),
        o('p1', 'flowers', 9, 4, 0, 'flowers:0'), o('w1', 'pool', 8, 2), o('w2', 'pool', 8, 3), o('w3', 'pool', 8, 4), o('w4', 'pool', 7, 2), o('p2', 'flowers', 2, 5, 0, 'flowers:1'), o('p3', 'flowers', 9, 6, 0, 'flowers:2'),
    ];
    return { version: 1, width: 14, depth: 10, land, heights, owners, hub: [7, 6] };
}
