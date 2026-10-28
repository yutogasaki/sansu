import { GrowingIslandDatabase, assertGrowingOwnerAvailable, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import { readable } from '../../../src/domain/growingIsland/syncProjection';
import { terrainFootingError } from '../../../src/domain/growingIsland/terrainEditing';
import { holdPwaUpdateForCriticalPersistence } from '../../../src/pwa';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { compositeEnabled, compositeOf } from './composite-field';
import { coastalTrialMode } from './coastal-section';
import { assertCompositeGeometry, validateCompositeState, type CompositeGrowingState } from './composite-model';
import { assertNoShoulderPersistence } from './shoulder-section';
import { assemblyEnabled } from './assembly-mode';
import { isAssemblyDatabase, ASSEMBLY_SAVE_RECIPE, assertAssemblySavedRecord, assertAssemblyWriteBoundary,
    assertAssemblyReadBoundary, assertAssemblyRecordBoundary } from './assembly-store';

export const COMPOSITE_DATABASE = 'SansuPlaceSetTrialV1';
export const COMPOSITE_PROFILE = 'expanded-comparison-fixture';
export const COMPOSITE_SAVE_RECIPE = 'place-set-save-v1:disjoint-two-platform-memory-v1:H:fixed-two-shear-grid-v1:fixed-core-base-v1:fixed-bilinear-interior-ramp-v1:directional-ramp-v1:flat-owner-v1';
export type SavedCompositeState = CompositeGrowingState & { trialPlaceSetRecipe: typeof COMPOSITE_SAVE_RECIPE };
let database: GrowingIslandDatabase | undefined;
const fail = (): never => { throw Error('2つの場所の保存をよみこめなかったよ。対応した試作の版で開いてください。保存は変更していません。'); };

export function compositeSavedMode(): boolean {
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (query.get('trialSave') !== 'two-local') return false;
    if (!compositeEnabled() || coastalTrialMode() !== 'off') throw Error('2つの場所の保存は専用の岸データ・岸加工offで開いてください。');
    const required: Record<string, string> = { terrainTrial: 'H', baseTrial: 'stable', rampTrial: 'linear', growthTrial: 'inherit',
        compileTrial: 'single', trialScene: 'shore', queryTrial: 'frozen', memoTrial: 'samples', edgeTrial: 'memo' };
    if (Object.entries(required).some(([key, value]) => query.get(key) !== value))
        throw Error('2つの場所を保存した制作方式と違います。元の試作URLで開いてください。');
    return true;
}
function assertDatabase(db: GrowingIslandDatabase): void {
    if (!compositeSavedMode()) throw Error('2つの場所の比較はメモリ内専用です。保存専用URLで開いてください。');
    if (!(db instanceof GrowingIslandDatabase) || db.name !== COMPOSITE_DATABASE)
        throw Error('2つの場所の保存先が違います。ほかのDBは変更していません。');
}
export function compositeDatabase(): GrowingIslandDatabase {
    assertNoShoulderPersistence();
    if (!compositeSavedMode()) throw Error('2つの場所の保存専用画面で開いてください。');
    return database ??= new GrowingIslandDatabase(COMPOSITE_DATABASE);
}
export function compositeInitialRecord(): GrowingRecord {
    const state = structuredClone(fixture.state) as unknown as SavedCompositeState;
    state.trialPlaceSetRecipe = COMPOSITE_SAVE_RECIPE;
    state.trialPlaceSet = {}; state.trialPlaceSetHistory = { version: 1, undo: [], redo: [] };
    return { profileId: COMPOSITE_PROFILE, islandId: 'main', version: 6, revision: 0, createdAt: 0, updatedAt: 0, state };
}

/** Structural and geometric validation is independent of a DB selection. It
 * also runs through the real reader and immediately before the writer's put. */
export function assertCompositeSavedRecord(record: GrowingRecord): void {
    const state = record.state as SavedCompositeState;
    if (record.profileId !== COMPOSITE_PROFILE || state?.seed !== COMPOSITE_PROFILE || record.islandId !== 'main'
        || record.version !== 6 || !Number.isSafeInteger(record.revision) || record.revision < 0
        || !Number.isFinite(record.createdAt) || record.createdAt < 0 || !Number.isFinite(record.updatedAt) || record.updatedAt < record.createdAt
        || state.trialPlaceSetRecipe !== COMPOSITE_SAVE_RECIPE || Object.hasOwn(state, 'trialPlace') || Object.hasOwn(state, 'trialPlaceHistory')) fail();
    validateCompositeState(state);
    const history = state.trialPlaceSetHistory!;
    if (Object.keys(history).some(key => !['version', 'undo', 'redo'].includes(key))
        || [...history.undo, ...history.redo].some(entry => Object.keys(entry).some(key => !['before', 'after'].includes(key)))) fail();
    assertCompositeGeometry(state);
    const footing = terrainFootingError({ ...state, trialPlaceSet: {} } as CompositeGrowingState, state);
    if (footing) throw Error(footing);
}
export function validateSavedCompositeIfPresent(record: GrowingRecord): void {
    const state = record.state as Partial<SavedCompositeState>;
    if ((state.trialPlaceSetRecipe as string) === ASSEMBLY_SAVE_RECIPE) { assertAssemblySavedRecord(record); return; }
    if (compositeOf(state) !== undefined || state.trialPlaceSetHistory !== undefined || state.trialPlaceSetRecipe !== undefined)
        assertCompositeSavedRecord(record);
}

/** Every command in saved-two mode must name this DB and synthetic owner.
 * The memory command cannot cross into another database even when passed one. */
export function assertCompositeWriteBoundary(profileId: string, intent: { command: { type: string }; islandId?: string }, db: GrowingIslandDatabase): void {
    if (assemblyEnabled() || isAssemblyDatabase(db.name)) { assertAssemblyWriteBoundary(profileId, intent, db); return; }
    assertNoShoulderPersistence();
    if (coastalTrialMode() !== 'off') throw Error('岸の比較は保存できません。');
    const saved = compositeSavedMode();
    if (!saved && db.name !== COMPOSITE_DATABASE && intent.command.type !== 'place-set') return;
    assertDatabase(db);
    if (profileId !== COMPOSITE_PROFILE || (intent.islandId ?? 'main') !== 'main')
        throw Error('2つの場所の保存の持ち主が違います。ほかの島は変更していません。');
    if (intent.command.type === 'place-outline') throw Error('2つの場所は西か東を選んで編集してください。');
}
export function assertCompositeReadBoundary(profileId: string, db: GrowingIslandDatabase): void {
    if (assemblyEnabled() || isAssemblyDatabase(db.name)) { assertAssemblyReadBoundary(profileId, db); return; }
    assertNoShoulderPersistence();
    if (!compositeSavedMode() && db.name !== COMPOSITE_DATABASE) return;
    assertDatabase(db);
    if (profileId !== COMPOSITE_PROFILE) throw Error('2つの場所の保存の持ち主が違います。');
}
export function assertCompositeRecordBoundary(record: GrowingRecord, db: GrowingIslandDatabase): void {
    if (assemblyEnabled() || isAssemblyDatabase(db.name)) { assertAssemblyRecordBoundary(record, db); return; }
    if (db.name === COMPOSITE_DATABASE) { assertCompositeSavedRecord(record); return; }
    const state = record.state as Partial<SavedCompositeState>;
    if (compositeOf(state) !== undefined || state.trialPlaceSetHistory !== undefined || state.trialPlaceSetRecipe !== undefined)
        throw Error('2つの場所の保存先が違います。');
}

/** Initialize only an empty new DB. Failed/corrupt opens never substitute the
 * fixture; no record is imported from the old v3 DB or the memory-only tab. */
export async function openCompositeTrial(supplied?: GrowingIslandDatabase, now = Date.now()): Promise<GrowingRecord> {
    assertNoShoulderPersistence();
    if (!compositeSavedMode()) throw Error('2つの場所の保存専用画面で開いてください。');
    const db = supplied ?? compositeDatabase(); assertDatabase(db);
    if (!Number.isFinite(now) || now < 0) throw Error('保存の時刻を確認してください。');
    const release = holdPwaUpdateForCriticalPersistence();
    try {
        await db.transaction('rw', db.islands, db.deletedOwners, async () => {
            await assertGrowingOwnerAvailable(COMPOSITE_PROFILE, db);
            const current = await db.islands.get(COMPOSITE_PROFILE);
            if (current) { readable(current); assertCompositeSavedRecord(current); return; }
            if (await db.islands.count()) return fail(); // A corrupt/foreign key is not an empty new DB.
            const initial = compositeInitialRecord(); readable(initial); assertCompositeSavedRecord(initial);
            await db.islands.add(initial);
        });
    } finally { release(); }
    const saved = await readGrowingIsland(COMPOSITE_PROFILE, db);
    if (!saved) return fail();
    assertCompositeSavedRecord(saved); return saved;
}
