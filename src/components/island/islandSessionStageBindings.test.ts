import { describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { getIslandWorkshop } from '../../domain/island/workshop';
import { createEmptyWorkshopLayout } from '../../domain/island/workshopLayout';
import type { IslandItem } from '../../domain/island/types';
import { furniturePlacementKey } from './islandFurniturePlacement';
import { islandSessionPlacementStage } from './islandSessionPlacementStage';
import { islandSessionWorkshopStage } from './islandSessionWorkshopStage';

function placement() {
    let preview: IslandItem | undefined = { id: 'owned-tool', kind: 'telescope', position: { x: 0, z: 1 }, rotation: 0 };
    const inputs: Parameters<typeof islandSessionPlacementStage>[0] = {
        screen: 'placement', island: createIsland('child', 1), busy: false, furnitureKind: 'telescope',
        furnitureResident: 'otter', furniturePartner: 'rabbit', furniturePlacementChoice: { residentId: 'otter' },
        playRequest: undefined, valid: true, setDistrict: vi.fn(),
        controls: { preview, setPreview: next => { preview = typeof next === 'function' ? next(preview) : next; },
            placementSuggestionId: 'owned-tool', setPlacementSuggestionId: vi.fn(), furniturePlacementSearch: 'search-current',
            setFurniturePlacementSearch: vi.fn(), setFurniturePlacementResult: vi.fn() },
    };
    const result = { key: furniturePlacementKey(preview, inputs.furniturePlacementChoice!), itemId: preview.id,
        status: 'ready' as const, residentId: 'otter' as const,
        suggestion: { requestId: 'search-current', position: { x: 2, z: 1 }, rotation: Math.PI / 2 } };
    return { inputs, result, preview: () => preview };
}

describe('session stage callbacks across delayed renderer publication', () => {
    it('ignores furniture results owned by another preview or delivered after leaving the editor', () => {
        const h = placement();
        islandSessionPlacementStage(h.inputs).onFurniturePlacement!({ ...h.result, key: 'another-preview' });
        h.inputs.screen = 'photos'; islandSessionPlacementStage(h.inputs).onFurniturePlacement!(h.result);
        expect(h.inputs.controls.setFurniturePlacementResult).not.toHaveBeenCalled();
        expect(h.preview()?.position).toEqual({ x: 0, z: 1 });
    });
    it('does not apply a search suggestion superseded by a newer search', () => {
        const h = placement();
        islandSessionPlacementStage(h.inputs).onFurniturePlacement!({ ...h.result,
            suggestion: { ...h.result.suggestion, requestId: 'search-old' } });
        expect(h.preview()?.position).toEqual({ x: 0, z: 1 });
        expect(h.inputs.setDistrict).not.toHaveBeenCalled();
        expect(h.inputs.controls.setFurniturePlacementSearch).not.toHaveBeenCalled();
    });
    it('adopts a current search result only for the still-selected item', () => {
        const h = placement(); islandSessionPlacementStage(h.inputs).onFurniturePlacement!(h.result);
        expect(h.preview()).toMatchObject({ id: 'owned-tool', position: { x: 2, z: 1 }, rotation: Math.PI / 2 });
        expect(h.inputs.controls.setFurniturePlacementSearch).toHaveBeenCalledWith(undefined);
        h.inputs.controls.setPreview({ ...h.preview()!, id: 'new-selection' });
        islandSessionPlacementStage(h.inputs).onPlacementSuggestion!({ itemId: 'owned-tool', position: { x: 3, z: 2 } });
        expect(h.preview()).toMatchObject({ id: 'new-selection', position: { x: 2, z: 1 } });
    });
    it('rounds a ground gesture to the saved quarter-grid and disables it while saving', () => {
        const h = placement(); islandSessionPlacementStage(h.inputs).onGroundPoint!({ x: 1.13, z: -.12 });
        expect(h.preview()?.position).toEqual({ x: 1.25, z: -0 });
        expect(h.inputs.controls.setPlacementSuggestionId).toHaveBeenCalledWith(undefined);
        h.inputs.busy = true; expect(islandSessionPlacementStage(h.inputs).onGroundPoint).toBeUndefined();
    });
    it('keeps immutable replay and editable draft distinct through the camera round trip', () => {
        const island = createIsland('child', 1), layout = createEmptyWorkshopLayout();
        layout.parts.straight = { assembled: true, rotation: 1, position: { col: 1, row: 1 } };
        const inputs: Parameters<typeof islandSessionWorkshopStage>[0] = {
            screen: 'workshop', island, busy: false, cameraInlet: false,
            workshopView: { mode: 'build', selectedSpecimenId: 'driftwood', selectedPartId: 'straight', selectedToolId: 'brush' },
            workshopRequest: { id: 'run-1', command: { type: 'run' } },
            workReplay: { target: { kind: 'work', targetKey: 'captured-work', sourceWorkId: 'work-1', name: 'saved', capturedAt: 1, layout } },
            showCurrentDraft: false, workshopActions: { capture: vi.fn(), act: vi.fn(), error: undefined, retry: undefined },
            workshopAudio: { unlock: vi.fn(), play: vi.fn(), stop: vi.fn() }, setWorkshopView: vi.fn(),
        };
        expect(islandSessionWorkshopStage(inputs).workshop?.replayLayout).toBe(layout);
        inputs.screen = 'camera'; inputs.cameraInlet = true;
        expect(islandSessionWorkshopStage(inputs).workshop?.replayLayout).toBe(layout);
        inputs.showCurrentDraft = true;
        expect(islandSessionWorkshopStage(inputs).workshop?.replayLayout).toEqual(getIslandWorkshop(island).draftCheckpoint.draft.layout);
        expect(layout.parts.straight.position).toEqual({ col: 1, row: 1 });
        inputs.cameraInlet = false;
        expect(islandSessionWorkshopStage(inputs).workshopRequest).toBeUndefined();
        expect(inputs.workshopActions.act).not.toHaveBeenCalled(); expect(inputs.workshopActions.capture).not.toHaveBeenCalled();
    });
});
