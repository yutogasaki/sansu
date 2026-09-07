export type Columns = number[][]; // Bottom first, with fixed column positions.
export type Board = { id: string; target: 5 | 10; name: string; columns: Columns; goal: number | 'all' };
export type Clear = { pair: number; values: [number, number]; before: Columns; after: Columns; automatic: boolean };
export const clone = (columns: Columns): Columns => columns.map(column => [...column]);
export const count = (columns: Columns) => columns.reduce((sum, column) => sum + column.length, 0);
export const pairs = (columns: Columns, target: number): number[] => columns.flatMap((column, i) =>
    column.length && columns[i + 1]?.length && column[0] + columns[i + 1][0] === target ? [i] : []);

export function play(columns: Columns, target: number, pair: number): Clear[] {
    if (!pairs(columns, target).includes(pair)) throw new Error('Not a matching adjacent pair');
    let state = clone(columns);
    const clears: Clear[] = [];
    let next = pair;
    for (;;) {
        const before = clone(state);
        const values: [number, number] = [state[next][0], state[next + 1][0]];
        state = state.map((column, i) => i === next || i === next + 1 ? column.slice(1) : column);
        clears.push({ pair: next, values, before, after: clone(state), automatic: clears.length > 0 });
        const fallen = [next, next + 1].filter(i => state[i].length > 0);
        const candidates = pairs(state, target).filter(i => fallen.includes(i) || fallen.includes(i + 1));
        if (candidates.length > 1) throw new Error('Competing automatic pairs');
        if (!candidates.length) return clears;
        next = candidates[0];
    }
}

export const achieved = (board: Board, columns: Columns, best: number) =>
    board.goal === 'all' ? count(columns) === 0 : best >= board.goal;

/** Enumerate every manual branch, including states beyond the goal. Throws on ambiguity. */
export function inspect(board: Board) {
    if (![3, 4].includes(board.columns.length) || ![5, 10].includes(board.target) ||
        board.columns.some(c => !c.length || c.some(n => !Number.isInteger(n) || n < 1 || n >= board.target))) {
        throw new Error('Invalid board');
    }
    const seen = new Set<string>();
    const wins: number[][] = [];
    const manualPairs = new Set<string>();
    const visit = (state: Columns, best: number, path: number[]) => {
        if (achieved(board, state, best)) wins.push(path);
        const key = JSON.stringify([state, best]);
        if (seen.has(key)) return;
        seen.add(key);
        for (const pair of pairs(state, board.target)) {
            manualPairs.add([state[pair][0], state[pair + 1][0]].sort((a, b) => a - b).join('+'));
            const steps = play(state, board.target, pair);
            visit(steps[steps.length - 1].after, Math.max(best, steps.length), [...path, pair]);
        }
    };
    visit(board.columns, 0, []);
    if (!wins.length) throw new Error(`Unsolvable board ${board.id}`);
    return { states: seen.size, wins, manualPairs: [...manualPairs] };
}
