import type { IslandItemKind } from '../../../domain/island/types';
export type { IslandItemKind } from '../../../domain/island/types';
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
    activity?: 'flower' | 'star' | 'bubble' | 'telescope' | 'hammock' | 'tea';
    partner?: 'otter' | 'rabbit' | 'fox';
    reason?: 'unreachable' | 'not-placed' | 'learning' | 'editing' | 'renderer' | 'resident-unavailable' | 'partner-unavailable';
}
export interface IslandPlacementSuggestion { itemId: string; position: { x: number; z: number } }
export interface IslandSharedStageState {
    island: IslandRecord;
    active: boolean;
    selectedDisplayId?: SharedDisplayId;
    focusDisplayId?: SharedDisplayId;
    preview?: { displayId: SharedDisplayId; target: SharedTarget; position: IslandPosition; rotation: number; valid: boolean };
}
export interface IslandSharedSceneRequest {
    id: string;
    command: { type: 'run'; requestId: string } | { type: 'memory'; memoryKey: string } | { type: 'stop' }
        | { type: 'place-preview'; action: Extract<IslandSharedMemoriesAction, { type: 'place-display' }> }
        | { type: 'arrange'; displayId: SharedDisplayId; expectedDisplayKey: string }
        | { type: 'illuminate'; displayId: SharedDisplayId };
}
export interface IslandStageState {
    learningKeepsakes?: { state?: IslandLearningKeepsakesState; selectedId?: IslandLearningKeepsakeId };
    shared?: IslandSharedStageState;
    sharedRequest?: IslandSharedSceneRequest;
    workshop?: WorkshopSceneState;
    workshopRequest?: WorkshopSceneRequest;
    experience?: IslandExperienceState;
    expressionSelection?: IslandExpressionSelection;
    expressionResidentId?: IslandResidentId;
    expressionFlagFocus?: boolean;
    expressionWalkRequest?: { id: string; residentId: IslandResidentId };
    furniturePlacement?: IslandFurniturePlacementChoice;
    furnitureTrialChoice?: IslandFurniturePlacementChoice;
    furniturePlacementSearchRequestId?: string;
    residentPortraitId?: 'otter' | 'rabbit' | 'fox';
    cosmetics?: IslandCosmetics;
    /** Viewing only: stable current/preview framing without comparison visibility. */
    cosmeticFocus?: IslandAppearanceSlotId | 'all';
    items: IslandStageItem[];
    completedSets: number;
    pulse: number;
    learning: boolean;
    growth?: IslandGrowthState;
    growthTarget?: IslandHabitatId;
    districtFocus?: 'all' | 'home' | 'east' | 'west';
    /** Layout-owned close framing for the ordinary phone home; never a manual zoom. */
    closeHomeView?: boolean;
    comparisonHabitat?: IslandHabitatId | 'all';
    readOnly?: boolean;
    photographing?: boolean;
    learningProgress?: { sectionId: string; completed: number; total: number };
    reaction?: { id: string; kind: 'correct' | 'retry' | 'support'; growthTarget?: IslandHabitatId };
    playRequest?: { id: string; itemId: string; discoveryId?: string; residentId?: 'otter' | 'rabbit' | 'fox'; partnerId?: 'otter' | 'rabbit' | 'fox' };
    /** Borrowed optional tool at a legal candidate; never a placement or saved ownership. */
    furnitureTrial?: IslandStageItem;
    placementSuggestionId?: string;
    preview?: IslandStageItem;
    previewValid?: boolean;
    selectedId?: string;
}
export interface IslandStageProps extends IslandStageState {
    onHomeEnter?: () => void;
    onHomeAction?: (action: { type: 'keepsake'; id: IslandLearningKeepsakeId } | { type: 'album' } | { type: 'notices' }) => void;
    onFurniturePlacement?: (result: IslandFurniturePlacementResult) => void;
    onSharedAction?: (action: IslandSharedMemoriesAction) => void;
    onSharedDisplaySelect?: (displayId: SharedDisplayId) => void;
    onSharedFeedback?: (text: string) => void;
    onWorkshopGesture?: () => void;
    onWorkshopAction?: (action: IslandWorkshopAction) => void;
    onWorkshopSpecimenSelect?: (id: WorkshopSpecimenId) => void;
    onWorkshopPartSelect?: (id: WorkshopPartId) => void;
    onWorkshopFeedback?: (kind: WorkshopFeedbackKind) => void;
    photoRequestId?: string;
    onPhoto?: (requestId: string, frame?: string) => void;
    onGroundPoint?: (point: { x: number; z: number }) => void;
    onItemSelect?: (id: string) => void;
    onPlayResult?: (result: IslandPlayResult) => void;
    onRendererRecovered?: () => void;
    onPlacementSuggestion?: (suggestion: IslandPlacementSuggestion) => void;
    onDiscovery?: (id: string, itemId: string) => void;
}
import type { IslandGrowthState, IslandHabitatId, IslandPosition, IslandRecord } from '../../../domain/island/types';
import type { IslandSharedMemoriesAction, SharedDisplayId, SharedTarget } from '../../../domain/island/sharedMemories';
import type { IslandCosmetics } from '../../../domain/island/customization';
import type { IslandAppearanceSlotId } from '../../../domain/island/appearance';
import type { IslandExperienceState, IslandResidentId } from '../../../domain/island/experience';
import type { IslandExpressionSelection } from '../../../domain/island/expression';
import type { IslandLearningKeepsakeId, IslandLearningKeepsakesState } from '../../../domain/island/learningKeepsakes';
import type { IslandFurniturePlacementChoice, IslandFurniturePlacementResult } from './optionalFurniturePlacement';
import type { IslandWorkshopAction, WorkshopSpecimenId } from '../../../domain/island/workshop';
import type { WorkshopPartId } from '../../../domain/island/workshopLayout';
import type { WorkshopFeedbackKind, WorkshopSceneRequest, WorkshopSceneState } from './workshopScene';
