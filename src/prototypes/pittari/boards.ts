import type { Board } from './engine';
export const CANDIDATE = 'pittari-positive-v1';
export const boards: Board[] = [
    { id: '5-1', target: 5, name: 'ふたつで ぴったり', columns: [[1], [4], [2]], goal: 1 },
    { id: '5-2', target: 5, name: 'うえから もうひとつ', columns: [[2, 1], [3, 4], [3, 2]], goal: 2 },
    { id: '5-3', target: 5, name: 'どっちから つなぐ？', columns: [[4, 2], [1, 3], [4, 1]], goal: 2 },
    { id: '5-4', target: 5, name: 'こんどは どっち？', columns: [[4, 1], [1, 3], [4, 2]], goal: 2 },
    { id: '5-5', target: 5, name: 'もういちだん うえへ', columns: [[1, 2, 4], [4, 3, 1], [3]], goal: 3 },
    { id: '5-6', target: 5, name: 'のこった くみも', columns: [[1], [4], [2, 2], [3, 3]], goal: 'all' },
    { id: '10-1', target: 10, name: 'ふたつで ぴったり', columns: [[4], [6], [3]], goal: 1 },
    { id: '10-2', target: 10, name: 'うえから もうひとつ', columns: [[2, 4], [8, 6], [3]], goal: 2 },
    { id: '10-3', target: 10, name: 'どっちから つなぐ？', columns: [[7, 4], [3, 6], [7, 2]], goal: 2 },
    { id: '10-4', target: 10, name: 'こんどは どっち？', columns: [[7, 2], [3, 6], [7, 4]], goal: 2 },
    { id: '10-5', target: 10, name: 'もういちだん うえへ', columns: [[2, 1, 5], [8, 9, 5], [2]], goal: 3 },
    { id: '10-6', target: 10, name: 'のこった くみも', columns: [[1], [9], [5, 2], [5, 8]], goal: 'all' },
];
