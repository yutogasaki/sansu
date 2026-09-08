import { getIslandLandAccess, isValidIslandPlacement } from '../../../domain/island/catalog';
import { sharedDisplayObstacles } from '../../../domain/island/sharedDisplayGeometry';
import { furniturePlacementKey, type IslandFurniturePlacementChoice, type IslandFurniturePlacementResult } from '../islandFurniturePlacement';
export { furniturePlacementKey, type IslandFurniturePlacementChoice, type IslandFurniturePlacementResult } from '../islandFurniturePlacement';
import type { IslandRecord } from '../../../domain/island/types';
import type { IslandResident } from './animals';
import type { OptionalFurnitureController } from './optionalFurnitureController';
import { isOptionalFurniture, makeOptionalFurniture } from './optionalFurnitureGeometry';
import { optionalFurnitureTrialSteps } from './optionalFurnitureTrial';
import { disposeGeometry, type IslandMaterials } from './primitives';
import type { IslandStageItem } from './types';

export interface OptionalFurniturePlacementInput {
    preview: IslandStageItem; choice: IslandFurniturePlacementChoice; searchRequestId?: string;
    appearanceKey?: string;
    island: Pick<IslandRecord, 'profileId' | 'items' | 'completedSets' | 'growth' | 'sharedMemories'>;
}

/** Availability is separate from save validity. A hidden owned scratch model
 * runs the same actual-body preflight; only an explicit search proposes a new
 * preview. This controller cannot save, move an owned Group or start a visit. */
export class OptionalFurniturePlacement {
    private input?: OptionalFurniturePlacementInput;
    private model?: ReturnType<typeof makeOptionalFurniture>;
    private modelKind?: IslandStageItem['kind'];
    private key?: string;
    private worldKey?: string;
    private pending = false;
    private seenRequestId?: string;
    private search?: { requestId: string; iterator: ReturnType<typeof optionalFurnitureTrialSteps> };
    private result?: IslandFurniturePlacementResult;
    private disposed = false;

    constructor(private readonly residents: readonly IslandResident[], private readonly controller: OptionalFurnitureController,
        private readonly materials: IslandMaterials, private readonly onResult: (result: IslandFurniturePlacementResult) => void) {}
    get busy() { return this.pending || Boolean(this.search); }
    update(input?: OptionalFurniturePlacementInput) {
        if (this.disposed) return;
        if (!input || !isOptionalFurniture(input.preview.kind) || !input.preview.position) { this.cancel(); this.input = undefined; this.key = this.worldKey = undefined; this.release(); return; }
        const key = furniturePlacementKey(input.preview, input.choice);
        const worldKey = JSON.stringify([input.island.profileId, input.island.items, input.island.completedSets, input.island.growth?.expansionLevel,
            input.island.sharedMemories?.displays, input.appearanceKey, this.residents.map(resident => [resident.species, resident.group.visible])]);
        const changed = this.key !== key || this.worldKey !== worldKey;
        if (changed) { this.cancel(); this.key = key; this.worldKey = worldKey; this.pending = true; }
        this.input = input;
        if (this.modelKind !== input.preview.kind) {
            this.release(); this.model = makeOptionalFurniture(input.preview.kind, this.materials); this.modelKind = input.preview.kind;
        }
        if (changed) this.emit('checking');
        if (input.searchRequestId && this.seenRequestId !== input.searchRequestId) {
            this.seenRequestId = input.searchRequestId;
            this.search = { requestId: input.searchRequestId, iterator: optionalFurnitureTrialSteps(input.preview, this.model!, this.residents,
                this.controller, input.island, performance.now(), false, input.choice) };
            this.pending = false; this.emit('searching');
        } else if (!input.searchRequestId && this.search) { this.search = undefined; this.pending = true; this.emit('checking'); }
    }
    private emit(status: IslandFurniturePlacementResult['status'], suggestion?: IslandFurniturePlacementResult['suggestion']) {
        if (!this.input || !this.key) return;
        this.result = { key: this.key, itemId: this.input.preview.id, ...this.input.choice, status, ...(suggestion ? { suggestion } : {}) };
        this.onResult(this.result);
    }
    private ready(item: IslandStageItem, now: number, reduced: boolean) {
        const input = this.input!, group = this.model!;
        const island: IslandRecord = { schemaVersion: 1, revision: 0, updatedAt: 0, pendingRewards: [],
            ...input.island, items: [...input.island.items.filter(value => value.id !== item.id), item] };
        if (!item.position || !isValidIslandPlacement(island, item.id, item.position, item.rotation)) return false;
        group.position.set(item.position.x, 0, item.position.z); group.rotation.y = item.rotation; group.updateWorldMatrix(true, true);
        return this.controller.canStart({ item, group, ...input.choice, requestId: 'placement-check', borrowed: false,
            items: input.island.items, land: getIslandLandAccess(input.island), obstacles: sharedDisplayObstacles(input.island), now, reduced }).status === 'playing';
    }
    /** At most one candidate preflight per frame; cancelling drops the iterator. */
    step(now: number, reduced: boolean) {
        if (this.disposed || !this.input || !this.model) return false;
        if (this.search) {
            const search = this.search, next = search.iterator.next();
            if (!next.done) return true;
            this.search = undefined;
            if (next.value.ready && this.ready(next.value.item, now, reduced)) {
                this.emit('ready', { requestId: search.requestId, position: { ...next.value.item.position! }, rotation: next.value.item.rotation });
            } else this.emit('no-space');
        } else if (this.pending) {
            this.pending = false; this.emit(this.ready(this.input.preview, now, reduced) ? 'ready' : 'blocked');
        }
        return this.busy;
    }
    cancel() { this.search = undefined; this.pending = false; this.result = undefined; }
    /** Foreground resumes assessment only. An old search request stays consumed. */
    resume() { if (this.input) { this.pending = true; this.emit('checking'); } }
    describe() { return this.result ? { ...this.result, busy: this.busy, modelUuid: this.model?.uuid } : undefined; }
    private release() { if (this.model) disposeGeometry(this.model); this.model = undefined; this.modelKind = undefined; }
    dispose() { if (this.disposed) return; this.disposed = true; this.cancel(); this.release(); this.input = undefined; }
}
