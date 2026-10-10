import data from '../../../docs/product/island-place-goals.json';
import type { PlaceFamily, PlaceGoalId } from './placeTypes';

/** The design catalog is also the initial runtime rule catalog, avoiding competing recipes. */
export const PLACE_CATALOG = data;
export const placeGoalCatalog = data.goals.map(goal => ({
    ...goal,
    id: goal.id as PlaceGoalId,
    family: goal.family as PlaceFamily | 'island',
}));
export const placeGoalDefinition = (id: PlaceGoalId) => placeGoalCatalog.find(goal => goal.id === id)!;
export const placeInputCount = (id: PlaceGoalId, kind: string) => placeGoalDefinition(id).inputs
    .filter(input => input.kind === kind).reduce((sum, input) => sum + input.count, 0);
