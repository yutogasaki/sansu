import type { Dispatch, SetStateAction } from 'react';
import type { IslandStageProps as StageProps } from './three/types';
import type { IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { furniturePlacementKey } from './islandFurniturePlacement';
import { islandDistrictForPosition } from './islandDistrictView';
import type { IslandDistrict } from './IslandGrowth';
import type { IslandItem } from '../../domain/island/types';
import type { IslandOptionalFurnitureKind } from '../../domain/island/furniture';
import type { IslandResidentId } from '../../domain/island/experience';
import type { useIslandSessionPlacement } from './useIslandSessionPlacement';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type PlacementStageBindings = Pick<StageProps, 'furnitureTrial' | 'furnitureTrialChoice' | 'furniturePlacement' | 'furniturePlacementSearchRequestId' | 'onFurniturePlacement' | 'preview' | 'previewValid' | 'selectedId' | 'placementSuggestionId' | 'onPlacementSuggestion' | 'onGroundPoint'>;
type Inputs = { screen: IslandScreen; island: IslandRecord;
    busy: boolean; furnitureTrial?: IslandItem; furnitureKind: IslandOptionalFurnitureKind;
    furnitureResident: IslandResidentId; furniturePartner: IslandResidentId; furniturePlacementChoice: StageProps['furniturePlacement'];
    playRequest: StageProps['playRequest']; valid: boolean;
    controls: Pick<ReturnType<typeof useIslandSessionPlacement>, 'preview' | 'setPreview' | 'placementSuggestionId' | 'setPlacementSuggestionId'
        | 'furniturePlacementSearch' | 'setFurniturePlacementSearch' | 'setFurniturePlacementResult'>;
    setDistrict: Setter<IslandDistrict | undefined>;
};

export function islandSessionPlacementStage({ screen, island, busy, furnitureTrial, furnitureKind, furnitureResident,
    furniturePartner, furniturePlacementChoice, playRequest, valid, controls, setDistrict }: Inputs): PlacementStageBindings {
    const { preview, setPreview, placementSuggestionId, setPlacementSuggestionId, furniturePlacementSearch,
        setFurniturePlacementSearch, setFurniturePlacementResult } = controls;
    return {
        furnitureTrial: furnitureTrial,
        furnitureTrialChoice: furnitureTrial ? { residentId: furnitureResident, ...(furnitureKind === 'tea-table' ? { partnerId: furniturePartner } : {}) } : undefined,
        furniturePlacement: furniturePlacementChoice,
        furniturePlacementSearchRequestId: furniturePlacementChoice ? furniturePlacementSearch : undefined,
        onFurniturePlacement: result => {
            if (busy || screen !== 'placement' || !preview || !furniturePlacementChoice || result.key !== furniturePlacementKey(preview, furniturePlacementChoice)) return;
            setFurniturePlacementResult(result);
            if (result.suggestion?.requestId === furniturePlacementSearch && result.suggestion) {
                const suggestion = result.suggestion;
                setDistrict(islandDistrictForPosition(island, suggestion.position));
                setPreview(previous => previous?.id === result.itemId ? { ...previous, position: suggestion.position, rotation: suggestion.rotation } : previous);
                setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
            }
            },
        preview: preview,
        previewValid: valid,
        selectedId: screen === 'play' ? playRequest?.itemId : preview?.id,
        placementSuggestionId: screen === 'placement' ? placementSuggestionId : undefined,
        onPlacementSuggestion: ({ itemId, position }) => {
            if (screen !== 'placement' || busy || preview?.id !== itemId) return;
            setDistrict(islandDistrictForPosition(island, position));
            setPreview(previous => previous?.id === itemId ? { ...previous, position } : previous);
            setPlacementSuggestionId(undefined);
            },
        onGroundPoint: screen === 'placement' && !busy ? point => { setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined); setPlacementSuggestionId(undefined); setPreview(previous => {
            if (!previous) return previous;
            const position = { x: Math.round(point.x * 4) / 4, z: Math.round(point.z * 4) / 4 };
            return previous.position?.x === position.x && previous.position?.z === position.z ? previous : { ...previous, position };
            }); } : undefined,
    };
}
