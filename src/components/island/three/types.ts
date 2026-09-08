export type IslandItemKind = 'bench' | 'flower' | 'lantern' | 'swing' | 'mushroom' | 'fountain';
export interface IslandStageItem {
    id: string;
    kind: IslandItemKind;
    position?: { x: number; z: number };
    rotation: number;
    growthLevel?: number;
    appearanceLevel?: number;
    habitatId?: IslandHabitatId;
}
export interface IslandPlayResult {
    requestId: string;
    itemId: string;
    status: 'playing' | 'blocked' | 'unavailable';
    resident?: 'otter' | 'rabbit' | 'fox';
    activity?: 'flower' | 'star' | 'bubble';
    partner?: 'otter' | 'rabbit' | 'fox';
    reason?: 'unreachable' | 'not-placed' | 'learning' | 'editing' | 'renderer';
}
export interface IslandPlacementSuggestion { itemId: string; position: { x: number; z: number } }
export interface IslandStageState {
    items: IslandStageItem[];
    completedSets: number;
    pulse: number;
    learning: boolean;
    growth?: IslandGrowthState;
    growthTarget?: IslandHabitatId;
    districtFocus?: 'all' | 'home' | 'east' | 'west';
    comparisonHabitat?: IslandHabitatId | 'all';
    readOnly?: boolean;
    learningProgress?: { sectionId: string; completed: number; total: number };
    reaction?: { id: string; kind: 'correct' | 'retry' | 'support'; growthTarget?: IslandHabitatId };
    playRequest?: { id: string; itemId: string; discoveryId?: string };
    placementSuggestionId?: string;
    preview?: IslandStageItem;
    previewValid?: boolean;
    selectedId?: string;
}
export interface IslandStageProps extends IslandStageState {
    onGroundPoint?: (point: { x: number; z: number }) => void;
    onItemSelect?: (id: string) => void;
    onPlayResult?: (result: IslandPlayResult) => void;
    onRendererRecovered?: () => void;
    onPlacementSuggestion?: (suggestion: IslandPlacementSuggestion) => void;
    onDiscovery?: (id: string, itemId: string) => void;
}
import type { IslandGrowthState, IslandHabitatId } from '../../../domain/island/types';
