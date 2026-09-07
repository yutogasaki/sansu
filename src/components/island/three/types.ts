export type IslandItemKind = 'bench' | 'flower' | 'lantern' | 'swing' | 'mushroom' | 'fountain';
export interface IslandStageItem {
    id: string;
    kind: IslandItemKind;
    position?: { x: number; z: number };
    rotation: number;
}
export interface IslandPlayResult {
    requestId: string;
    itemId: string;
    status: 'playing' | 'blocked' | 'unavailable';
    resident?: 'otter' | 'rabbit' | 'fox';
    reason?: 'unreachable' | 'not-placed' | 'learning' | 'editing' | 'renderer';
}
export interface IslandPlacementSuggestion { itemId: string; position: { x: number; z: number } }
export interface IslandStageState {
    items: IslandStageItem[];
    completedSets: number;
    pulse: number;
    learning: boolean;
    learningProgress?: { sectionId: string; completed: number; total: number };
    reaction?: { id: string; kind: 'correct' | 'retry' | 'support' };
    playRequest?: { id: string; itemId: string };
    placementSuggestionId?: string;
    preview?: IslandStageItem;
    previewValid?: boolean;
    selectedId?: string;
}
export interface IslandStageProps extends IslandStageState {
    onGroundPoint?: (point: { x: number; z: number }) => void;
    onItemSelect?: (id: string) => void;
    onPlayResult?: (result: IslandPlayResult) => void;
    onPlacementSuggestion?: (suggestion: IslandPlacementSuggestion) => void;
}
