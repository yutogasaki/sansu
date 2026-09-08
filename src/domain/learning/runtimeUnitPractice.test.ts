import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { evaluateMathLevel11Pilot } from './evidence';
import { readMathLevel11Pilot } from './pilotRepository';
import { getMathLevel11Practice } from './unitPractice';
import { readRuntimeMathUnitPractice } from './runtimeUnitPractice';

vi.mock('./pilotRepository', () => ({ readMathLevel11Pilot: vi.fn() }));

const AS_OF = '2026-09-12T12:00:00.000Z';
const database = {} as SansuDatabase;
const profile = (main: number, max: number) => ({
    ...createInitialProfile('test', 2, 11, 2, 'math'), id: 'child',
    mathMainLevel: main, mathMaxUnlocked: max,
});

beforeEach(() => vi.resetAllMocks());

describe('bounded runtime unit practice read', () => {
    it.each([[0, 11], [9, 11], [10, 10], [12, 12], [28, 28]])(
        'does not read histories for main %s and max %s', async (main, max) => {
            expect(await readRuntimeMathUnitPractice(database, profile(main, max), AS_OF)).toBeUndefined();
            expect(readMathLevel11Pilot).not.toHaveBeenCalled();
        },
    );

    it.each([[10, 11], [10, 12], [11, 11], [11, 12]])(
        'returns practice for main %s and max %s using the requested profile and time', async (main, max) => {
            const evaluation = evaluateMathLevel11Pilot([], 'child', AS_OF);
            const practice = getMathLevel11Practice(evaluation);
            vi.mocked(readMathLevel11Pilot).mockResolvedValue({ legacyLevel11Evidence: false, evaluation, practice });
            expect(await readRuntimeMathUnitPractice(database, profile(main, max), AS_OF)).toBe(practice);
            expect(readMathLevel11Pilot).toHaveBeenCalledTimes(1);
            expect(readMathLevel11Pilot).toHaveBeenCalledWith(database, 'child', AS_OF);
        },
    );
});
