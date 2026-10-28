import { GrowingIslandDatabase, assertGrowingOwnerAvailable, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import { readable } from '../../../src/domain/growingIsland/syncProjection';
import { terrainFootingError } from '../../../src/domain/growingIsland/terrainEditing';
import { holdPwaUpdateForCriticalPersistence } from '../../../src/pwa';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { compositeEnabled, compositeOf } from './composite-field';
import { coastalTrialMode } from './coastal-section';
import { assertCompositeGeometry, validateCompositeState, type CompositeGrowingState } from './composite-model';
import { assertNoShoulderPersistence } from './shoulder-section';
import { assemblyEnabled, coastSetEnabled, connectivityGuardEnabled } from './assembly-mode';

export const ASSEMBLY_DATABASE = connectivityGuardEnabled() ? 'SansuAssemblyTrialV3' : coastSetEnabled() ? 'SansuAssemblyTrialV2' : 'SansuAssemblyTrialV1';
export const isAssemblyDatabase = (name: string) => ['SansuAssemblyTrialV1', 'SansuAssemblyTrialV2', 'SansuAssemblyTrialV3'].includes(name);
export const ASSEMBLY_PROFILE = 'expanded-comparison-fixture';
export const ASSEMBLY_SAVE_RECIPE = (connectivityGuardEnabled() ? 'assembly-save-v3:retained-route-guard-v1:independent-two-bays-v1:' : coastSetEnabled() ? 'assembly-save-v2:independent-two-bays-v1:' : 'assembly-save-v1:') + 'platforms-then-protected-bay-memory-v1:depth-0.4-2.4:H:fixed-two-shear-grid-v1:fixed-core-base-v1:fixed-bilinear-interior-ramp-v1:directional-ramp-v1:flat-owner-v1';
export type SavedAssemblyState = CompositeGrowingState & { trialPlaceSetRecipe: typeof ASSEMBLY_SAVE_RECIPE };
let database: GrowingIslandDatabase | undefined;
const fail = (): never => { throw Error('湾と高台の保存をよみこめなかったよ。対応した試作の版で開いてください。保存は変更していません。'); };

export function assemblySavedMode(): boolean {
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (query.get('trialSave') !== 'assembly-local') return false;
    if (!assemblyEnabled() || !compositeEnabled() || coastalTrialMode() !== 'bay08') throw Error('湾と高台の保存は専用の岸データ・湾の合成モードで開いてください。');
    const required: Record<string, string> = { terrainTrial: 'H', baseTrial: 'stable', rampTrial: 'linear', growthTrial: 'inherit',
        compileTrial: 'single', trialScene: 'shore', queryTrial: 'frozen', memoTrial: 'samples', edgeTrial: 'memo' };
    if (Object.entries(required).some(([key, value]) => query.get(key) !== value))
        throw Error('湾と高台を保存した制作方式と違います。元の試作URLで開いてください。');
    return true;
}
function assertDatabase(db: GrowingIslandDatabase): void {
    if (!assemblySavedMode()) throw Error('湾と高台の保存専用URLで開いてください。');
    if (!(db instanceof GrowingIslandDatabase) || db.name !== ASSEMBLY_DATABASE)
        throw Error('湾と高台の保存先が違います。ほかのDBは変更していません。');
}
export function assemblyDatabase(): GrowingIslandDatabase {
    assertNoShoulderPersistence();
    if (!assemblySavedMode()) throw Error('湾と高台の保存専用画面で開いてください。');
    return database ??= new GrowingIslandDatabase(ASSEMBLY_DATABASE);
}
export function assemblyInitialRecord(): GrowingRecord {
    const state = structuredClone(fixture.state) as unknown as SavedAssemblyState;
    state.trialPlaceSetRecipe = ASSEMBLY_SAVE_RECIPE;
    state.trialPlaceSet = {}; state.trialPlaceSetHistory = { version: 1, undo: [], redo: [] };
    return { profileId: ASSEMBLY_PROFILE, islandId: 'main', version: 6, revision: 0, createdAt: 0, updatedAt: 0, state };
}

/** Structural and geometric validation is independent of a DB selection. It
 * also runs through the real reader and immediately before the writer's put. */
export function assertAssemblySavedRecord(record: GrowingRecord): void {
    const state = record.state as SavedAssemblyState;
    if (record.profileId !== ASSEMBLY_PROFILE || state?.seed !== ASSEMBLY_PROFILE || record.islandId !== 'main'
        || record.version !== 6 || !Number.isSafeInteger(record.revision) || record.revision < 0
        || !Number.isFinite(record.createdAt) || record.createdAt < 0 || !Number.isFinite(record.updatedAt) || record.updatedAt < record.createdAt
        || state.trialPlaceSetRecipe !== ASSEMBLY_SAVE_RECIPE || Object.hasOwn(state, 'trialPlace') || Object.hasOwn(state, 'trialPlaceHistory')) fail();
    validateCompositeState(state);
    const history = state.trialPlaceSetHistory!;
    if (Object.keys(history).some(key => !['version', 'undo', 'redo'].includes(key))
        || [...history.undo, ...history.redo].some(entry => Object.keys(entry).some(key => !['before', 'after'].includes(key)))) fail();
    assertCompositeGeometry(state);
    const footing = terrainFootingError({ ...state, trialPlaceSet: {} } as CompositeGrowingState, state);
    if (footing) throw Error(footing);
}
export function validateSavedAssemblyIfPresent(record: GrowingRecord): void {
    const state = record.state as Partial<SavedAssemblyState>;
    if (compositeOf(state) !== undefined || state.trialPlaceSetHistory !== undefined || state.trialPlaceSetRecipe !== undefined)
        assertAssemblySavedRecord(record);
}

/** Every command in saved-assembly mode must name this DB and synthetic owner.
 * The memory command cannot cross into another database even when passed one. */
export function assertAssemblyWriteBoundary(profileId: string, intent: { command: { type: string }; islandId?: string }, db: GrowingIslandDatabase): void {
    assertNoShoulderPersistence();
    if (!assemblyEnabled()) throw Error('湾と高台の保存専用画面で開いてください。');
    assertDatabase(db);
    if (profileId !== ASSEMBLY_PROFILE || (intent.islandId ?? 'main') !== 'main')
        throw Error('湾と高台の保存の持ち主が違います。ほかの島は変更していません。');
    if (intent.command.type === 'place-outline') throw Error('湾と高台は西・東・湾を選んで編集してください。');
}
export function assertAssemblyReadBoundary(profileId: string, db: GrowingIslandDatabase): void {
    assertNoShoulderPersistence();
    assertDatabase(db);
    if (profileId !== ASSEMBLY_PROFILE) throw Error('湾と高台の保存の持ち主が違います。');
}
export function assertAssemblyRecordBoundary(record: GrowingRecord, db: GrowingIslandDatabase): void {
    if (db.name === ASSEMBLY_DATABASE) { assertAssemblySavedRecord(record); return; }
    throw Error('湾と高台の保存先が違います。');
}

/** Initialize only an empty new DB. Failed/corrupt opens never substitute the
 * fixture; no record is imported from the old v3 DB or the memory-only tab. */
export async function openAssemblyTrial(supplied?: GrowingIslandDatabase, now = Date.now()): Promise<GrowingRecord> {
    assertNoShoulderPersistence();
    if (!assemblySavedMode()) throw Error('湾と高台の保存専用画面で開いてください。');
    const db = supplied ?? assemblyDatabase(); assertDatabase(db);
    if (!Number.isFinite(now) || now < 0) throw Error('保存の時刻を確認してください。');
    const release = holdPwaUpdateForCriticalPersistence();
    try {
        await db.transaction('rw', db.islands, db.deletedOwners, async () => {
            await assertGrowingOwnerAvailable(ASSEMBLY_PROFILE, db);
            const current = await db.islands.get(ASSEMBLY_PROFILE);
            if (current) { readable(current); assertAssemblySavedRecord(current); return; }
            if (await db.islands.count()) return fail(); // A corrupt/foreign key is not an empty new DB.
            const initial = assemblyInitialRecord(); readable(initial); assertAssemblySavedRecord(initial);
            await db.islands.add(initial);
        });
    } finally { release(); }
    const saved = await readGrowingIsland(ASSEMBLY_PROFILE, db);
    if (!saved) return fail();
    assertAssemblySavedRecord(saved); return saved;
}
