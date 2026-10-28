import { matureCompositionFixture } from './mature-composition';
import { GrowingIslandDatabase, assertGrowingOwnerAvailable, readGrowingIsland, type GrowingRecord } from '../../../src/domain/growingIsland/repository';
import { readable } from '../../../src/domain/growingIsland/syncProjection';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { holdPwaUpdateForCriticalPersistence } from '../../../src/pwa';
import shore from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { candidateId } from '../2026-10-23-place-method-comparison/candidate';
import { coastalTrialMode } from './coastal-section';
import { LEGACY_TRIAL_PLACE_RECIPE, TRIAL_PLACE_RECIPE, trialHistoryOf, validateLegacyTrialPlaceState, validateTrialPlaceState,
    type PersistentPlaceState } from './persistent-model';

export const TRIAL_PROFILE = 'expanded-comparison-fixture';
export const TRIAL_DATABASE = 'SansuPlaceOutlineTrialV1';
export const SAVED_CANDIDATE = 'place-method-H:cardinal-convex-terrace-v2+fixed-two-shear-grid-v1+fixed-core-base-v1+fixed-bilinear-interior-ramp-v1+single-compile-v1+frozen-query-v1+memo-samples-v1+memo-edge-check-v1';
let database: GrowingIslandDatabase | undefined;
export const localTrialEnabled = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('trialSave') === 'local';
export const trialDatabase = () => database ??= new GrowingIslandDatabase(TRIAL_DATABASE);

export function trialInitialRecord(): GrowingRecord {
    const state = matureCompositionFixture(structuredClone(shore.state) as unknown as GrowingState);
    if (state.seed !== TRIAL_PROFILE) throw Error('比較データの所有者が変わりました。試作を確認してください。');
    Object.assign(state, { trialPlaceHistory: { version: 1, recipe: TRIAL_PLACE_RECIPE, undo: [], redo: [] } });
    return { profileId: TRIAL_PROFILE, islandId: 'main', version: 6, revision: 0, createdAt: 0, updatedAt: 0, state };
}

export function assertSavedTrialRecipe() {
    coastalTrialMode(); // Refuse the unsaved shore comparison before opening or writing the DB.
    if (candidateId() !== SAVED_CANDIDATE || new URLSearchParams(location.search).get('growthTrial') !== 'inherit')
        throw Error('保存した試作と違う制作方式です。元の試作URLで開いてください。保存は変更していません。');
}

function assertTrialRecord(record: GrowingRecord): void {
    if (record.profileId !== TRIAL_PROFILE || record.state?.seed !== TRIAL_PROFILE || record.islandId !== 'main'
        || record.version !== 6 || !Number.isSafeInteger(record.revision) || record.revision < 0
        || !Number.isFinite(record.createdAt) || record.createdAt < 0 || !Number.isFinite(record.updatedAt) || record.updatedAt < record.createdAt
        || trialHistoryOf(record.state) === undefined)
        throw Error('この場所の保存をよみこめなかったよ。対応した試作の版でひらいてね。');
}

/** Disclosed fixture import occurs once, never as recovery from a failed read.
 * V2 -> V3 is a representation migration in the same isolated DB/table: the
 * history recipe alone changes. The production record version remains 6;
 * revision advances once, updatedAt cannot go backwards, createdAt and every
 * gameplay clock/owner/wallet/intent are retained. The full candidate passes the
 * actual reader before a put, under the normal deleted-owner fence and PWA hold.
 * A failed put aborts both recipe and metadata. Reopening V3 performs no write.
 * Later child actions still use commandGrowingIsland. Optional DB/time inputs
 * let diagnostics exercise this exact opener without touching the browser DB. */
export async function openSavedTrial(db = trialDatabase(), now = Date.now()) {
    assertSavedTrialRecipe();
    const release = holdPwaUpdateForCriticalPersistence();
    try {
        await db.transaction('rw', db.islands, db.deletedOwners, async () => {
            await assertGrowingOwnerAvailable(TRIAL_PROFILE, db);
            const current = await db.islands.get(TRIAL_PROFILE);
            if (!current) {
                const initial = trialInitialRecord(); assertTrialRecord(initial); readable(initial); validateTrialPlaceState(initial.state);
                await db.islands.add(initial);
                return;
            }
            assertTrialRecord(current);
            if (trialHistoryOf(current.state)?.recipe === (LEGACY_TRIAL_PLACE_RECIPE as string)) {
                validateLegacyTrialPlaceState(current.state);
                if (!Number.isFinite(now) || now < 0 || current.revision === Number.MAX_SAFE_INTEGER)
                    throw Error('この場所の保存をよみこめなかったよ。対応した試作の版でひらいてね。');
                const migrated = structuredClone(current);
                (migrated.state as PersistentPlaceState).trialPlaceHistory!.recipe = TRIAL_PLACE_RECIPE;
                migrated.revision += 1;
                migrated.updatedAt = Math.max(current.updatedAt, now);
                readable(migrated); validateTrialPlaceState(migrated.state);
                await db.islands.put(migrated);
            } else {
                readable(current); validateTrialPlaceState(current.state);
            }
        });
    } finally { release(); }
    const saved = await readGrowingIsland(TRIAL_PROFILE, db);
    if (!saved) throw Error('試作の保存を読み込めませんでした。');
    validateTrialPlaceState(saved.state);
    return saved;
}
