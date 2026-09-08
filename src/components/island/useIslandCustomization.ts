import { useRef, useState } from 'react';
import { getIslandCosmetics, getIslandCustomization, CUSTOMIZATION_CATALOG,
    type IslandCosmetics, type IslandCustomizationAction, type IslandCustomizationItemId } from '../../domain/island/customization';
import { customizeIsland } from '../../domain/island/customizationRepository';
import type { IslandRecord } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';
import { previewIslandCustomization } from './islandCustomizationPreview';
import { executeIslandCustomizationRequest, type IslandCustomizationRequest } from './islandCustomizationRequest';

export function useIslandCustomization(island: IslandRecord | undefined,
    run: ReturnType<typeof useIslandActions>['run'], onSaved: (island: IslandRecord) => void) {
    const [preview, setPreview] = useState<IslandCosmetics>();
    const [selectedId, setSelectedId] = useState<IslandCustomizationItemId>('moon-garden');
    const [celebration, setCelebration] = useState<string>();
    const pending = useRef<IslandCustomizationRequest | undefined>(undefined);
    const reset = () => { setPreview(undefined); setCelebration(undefined); pending.current = undefined; };
    const open = () => {
        if (!island) return;
        const state = getIslandCustomization(island), id = state.desiredItemId ?? state.themeId;
        setSelectedId(id); setPreview(previewIslandCustomization(getIslandCosmetics(island), id));
        setCelebration(undefined); pending.current = undefined;
    };
    const select = (id: IslandCustomizationItemId) => {
        if (!island) return;
        setSelectedId(id); setPreview(previous => previewIslandCustomization(previous ?? getIslandCosmetics(island), id));
        setCelebration(undefined);
    };
    const act = async (action: IslandCustomizationAction) => {
        if (!island) return;
        const updated = await run(() => executeIslandCustomizationRequest(pending, island.revision, action,
            request => customizeIsland(island.profileId, request.revision, request.action)));
        if (!updated) return;
        onSaved(updated);
        if (action.type === 'desire' || action.type === 'clear-desire') return;
        setPreview(getIslandCosmetics(updated));
        if (action.type === 'purchase' && !getIslandCustomization(island).ownedItemIds.includes(action.itemId)) {
            setCelebration(`${CUSTOMIZATION_CATALOG.find(item => item.id === action.itemId)!.name}が しまに とどいた！`);
        } else setCelebration(undefined);
    };
    return { preview, selectedId, celebration, reset, open, select, act };
}
