import { useEffect, useEffectEvent, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { IslandItem, IslandRecord } from '../../domain/island/types';
import type { IslandScreen } from '../../domain/island/navigation';
import { findAvailablePosition } from '../../domain/island/catalog';
import { isIslandOptionalFurnitureKind } from '../../domain/island/furniture';
import { saveIslandEdit } from '../../domain/island/repository';
import { setIslandItemAppearance } from '../../domain/island/growthRepository';
import { islandDistrictForPosition } from './islandDistrictView';
import type { IslandDistrict } from './IslandGrowth';
import type { IslandFurniturePlacementResult } from './islandFurniturePlacement';
import type { IslandStageState } from './three/types';
import type { useIslandActions } from './useIslandActions';
import type { useIslandNavigation } from './useIslandNavigation';

type Inputs = {
    profileId: string; island: IslandRecord | undefined;
    screen: IslandScreen; setScreen: (screen: IslandScreen) => void;
    busy: boolean; active: boolean; opening: boolean; hasShell: boolean;
    navigation: ReturnType<typeof useIslandNavigation>;
    run: ReturnType<typeof useIslandActions>['run'];
    setSnapshot: Dispatch<SetStateAction<IslandRecord | undefined>>;
    setDistrict: Dispatch<SetStateAction<IslandDistrict | undefined>>;
    setPlayRequest: Dispatch<SetStateAction<IslandStageState['playRequest']>>;
    setPlayMessage: Dispatch<SetStateAction<string | undefined>>;
    returnToGuide: boolean; returnToHouse: boolean; onPlaced: () => void;
};

/** Owns placement selection and persistence; cross-screen cleanup stays with the session. */
export function useIslandSessionPlacement({ profileId, island, screen, setScreen, busy, active, opening,
    hasShell, navigation, run, setSnapshot, setDistrict, setPlayRequest, setPlayMessage,
    returnToGuide, returnToHouse, onPlaced }: Inputs) {
    const [preview, setPreview] = useState<IslandItem>();
    const [placementSuggestionId, setPlacementSuggestionId] = useState<string>();
    const [furniturePlacementSearch, setFurniturePlacementSearch] = useState<string>();
    const [furniturePlacementResult, setFurniturePlacementResult] = useState<IslandFurniturePlacementResult>();
    const [returnToFurniture, setReturnToFurniture] = useState(false);
    const recoverPlacement = useEffectEvent(() => navigation?.open('/island?view=inventory', true));
    const placementWasPrepared = useRef(false);
    useEffect(() => {
        if (screen !== 'placement') { placementWasPrepared.current = false; return; }
        if (preview) { placementWasPrepared.current = true; return; }
        // Clearing a saved/cancelled preview may render before the route change.
        // Recover only an editor entered without a selection, never that exit.
        if (hasShell && active && !opening && !navigation?.blocked && !placementWasPrepared.current) recoverPlacement();
    }, [hasShell, active, opening, screen, preview, navigation?.blocked]);
    const select = (item: IslandItem, current = island) => {
        if (!current || busy) return;
        setFurniturePlacementSearch(undefined); setFurniturePlacementResult(undefined);
        setReturnToFurniture(screen === 'furniture' && isIslandOptionalFurnitureKind(item.kind));
        setPlayRequest(undefined);
        setPlacementSuggestionId(item.position ? undefined : item.id);
        const position = item.position ?? findAvailablePosition(current, item.kind, item.id) ?? { x: 0, z: 1 };
        setDistrict(islandDistrictForPosition(current, position));
        setPreview({ ...item, position });
        setScreen('placement');
    };
    const appearance = async (level: number) => {
        if (!island || !preview) return;
        const updated = await run(() => setIslandItemAppearance(profileId, island.revision, preview.id, level));
        if (!updated) return;
        setSnapshot(updated);
        const item = updated.items.find(candidate => candidate.id === preview.id);
        if (item) setPreview(previous => previous ? { ...previous, appearanceLevel: item.appearanceLevel } : previous);
    };
    const place = async (store = false) => {
        if (!island || !preview?.position) return;
        const updated = await run(() => saveIslandEdit(profileId, island.revision, store
            ? { type: 'store', itemId: preview.id }
            : { type: 'place', itemId: preview.id, position: preview.position!, rotation: preview.rotation }));
        if (!updated) return;
        setSnapshot(updated); setPreview(undefined); setPlayRequest(undefined); setPlayMessage(undefined);
        setScreen(navigation ? 'home' : returnToFurniture ? 'furniture' : returnToGuide ? 'guide' : returnToHouse ? 'keepsakes' : 'home');
        onPlaced();
    };
    return { preview, setPreview, placementSuggestionId, setPlacementSuggestionId,
        furniturePlacementSearch, setFurniturePlacementSearch, furniturePlacementResult, setFurniturePlacementResult,
        returnToFurniture, setReturnToFurniture, select, appearance, place };
}
