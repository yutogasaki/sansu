import { describe, expect, it, vi } from 'vitest';
import { IslandScene } from './runtime';
import type { IslandStageState } from './types';

interface UsualPlaceHarness {
    state: IslandStageState;
    pendingUsualPlace?: { itemId: string; residentSpecies: 'otter' | 'rabbit' | 'fox' };
    pendingVisitId?: string;
    deferredPlay?: IslandStageState['playRequest'];
    clearanceCaptionPending?: boolean;
    furnitureClearance: { active: boolean; blocked: unknown[] };
    callbacks: { caption: (caption: string) => void };
    performPlay(play: NonNullable<IslandStageState['playRequest']>, autonomous?: boolean): { status: 'playing' | 'blocked' } | undefined;
    finishPendingActivity(): void;
}

const state = (items: IslandStageState['items']): IslandStageState => ({ items, completedSets: 4, pulse: 0, learning: false });

describe('saved placement usual place invitation', () => {
    it('consumes one invitation after clearance and keeps it autonomous', () => {
        const caption = vi.fn(), performPlay = vi.fn(() => ({ status: 'playing' as const }));
        const scene = Object.create(IslandScene.prototype) as UsualPlaceHarness;
        Object.assign(scene, {
            state: state([{ id: 'flower', kind: 'flower', position: { x: 1, z: 1 }, rotation: 0 }]),
            pendingUsualPlace: { itemId: 'flower', residentSpecies: 'rabbit' },
            furnitureClearance: { active: false, blocked: [] }, callbacks: { caption }, performPlay,
        });

        scene.finishPendingActivity();

        expect(performPlay).toHaveBeenCalledWith({ id: 'usual-place-flower', itemId: 'flower', residentId: 'rabbit' }, true);
        expect(caption).toHaveBeenCalledWith('ウサギが いつもの ばしょへ とことこ');
        expect(scene.pendingUsualPlace).toBeUndefined();
    });

    it('does not invite a removed item and leaves the normal pending visit available', () => {
        const performPlay = vi.fn(), visitItem = vi.fn();
        const scene = Object.create(IslandScene.prototype) as UsualPlaceHarness & { visitItem(item: IslandStageState['items'][number]): void };
        Object.assign(scene, {
            state: state([{ id: 'other', kind: 'bench', position: { x: 0, z: 1 }, rotation: 0 }]),
            pendingUsualPlace: { itemId: 'removed', residentSpecies: 'rabbit' }, pendingVisitId: 'other',
            furnitureClearance: { active: false, blocked: [] }, callbacks: { caption: vi.fn() }, performPlay, visitItem,
        });

        scene.finishPendingActivity();

        expect(performPlay).not.toHaveBeenCalled();
        expect(visitItem).toHaveBeenCalledWith(scene.state.items[0]);
        expect(scene.pendingUsualPlace).toBeUndefined();
    });

    it('keeps the older pending visit when the preferred route becomes blocked', () => {
        const performPlay = vi.fn(() => ({ status: 'blocked' as const })), visitItem = vi.fn();
        const scene = Object.create(IslandScene.prototype) as UsualPlaceHarness & { visitItem(item: IslandStageState['items'][number]): void };
        Object.assign(scene, {
            state: state([{ id: 'old', kind: 'bench', position: { x: 0, z: 1 }, rotation: 0 },
                { id: 'flower', kind: 'flower', position: { x: 1, z: 1 }, rotation: 0 }]),
            pendingUsualPlace: { itemId: 'flower', residentSpecies: 'rabbit' }, pendingVisitId: 'old',
            furnitureClearance: { active: false, blocked: [] }, callbacks: { caption: vi.fn() }, performPlay, visitItem,
        });

        scene.finishPendingActivity();

        expect(performPlay).toHaveBeenCalledTimes(1);
        expect(visitItem).toHaveBeenCalledWith(scene.state.items[0]);
    });
});
