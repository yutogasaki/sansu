import { authoredWaterFrame } from './authoredWaterFrame';
import type { AuthoredWaterPlan } from './authoredWaterWorld';
import { AUTHORED_COVE_SOURCE_PROFILE, authoredCoveProfileRevision, authoredWorldFingerprint, authoredWorldGeometryRevision, composeAuthoredCoveWorld,
    deriveAuthoredCovePlan, reconcileAuthoredCovePlan, rejectAuthoredCovePlan, type AuthoredCovePlan, type AuthoredCoveSourceProfile } from './authoredCoveWorld';
import { derivePlaces } from './places';
import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';
import { composeAuthoredShoulderWorld, authoredShoulderProfileDrawingRevision, type AuthoredShoulderProfile } from './authoredShoulderWorld';
import { composeAuthoredGrowthTerrainWorld, deriveAuthoredGrowthTerrainPlan, rejectAuthoredGrowthTerrainPlan, type AuthoredGrowthTerrainCatalog, type AuthoredGrowthTerrainPlan } from './authoredGrowthTerrain';

export interface AuthoredWorldOptions { readonly water: boolean; readonly cove: boolean; readonly shoulder?: AuthoredShoulderProfile; readonly growthTerrain?: AuthoredGrowthTerrainCatalog }
export interface AuthoredWorldFrame {
    readonly world: IslandWorld;
    readonly waterPlan?: AuthoredWaterPlan;
    readonly covePlan?: AuthoredCovePlan;
    readonly growthTerrainPlan?: AuthoredGrowthTerrainPlan;
    readonly revision: string;
}

const frames = new WeakMap<IslandWorld, Map<string, AuthoredWorldFrame>>();
const extensions = new WeakMap<IslandWorld, { revision: string; world: IslandWorld }>();

/** Compose once: acquired land → fixed shoulder → tree-grown shore → water → places → cove. */
export function authoredWorldFrame(state: GrowingState, immutableBase: IslandWorld, options: AuthoredWorldOptions,
    profile: AuthoredCoveSourceProfile = AUTHORED_COVE_SOURCE_PROFILE): AuthoredWorldFrame {
    if (immutableBase.definition.districts.some(district => district.id === profile.patch.district.id))
        throw new Error('Authored world frame requires the immutable base, not a cove frame');
    // Keep all state dependencies, including unopened and future additions. Only
    // renderer/command receipts are excluded from this bounded frame cache.
    const stateInputs = Object.fromEntries(Object.entries(state).filter(([field]) => field !== 'applied' && field !== 'placeProgress'));
    const shoulderRevision = options.shoulder ? authoredShoulderProfileDrawingRevision(options.shoulder) : undefined;
    const key = JSON.stringify([options.water, options.cove, shoulderRevision, options.growthTerrain?.revision, options.cove ? authoredCoveProfileRevision(profile) : undefined, stateInputs]);
    let cache = frames.get(immutableBase);
    if (!cache) { cache = new Map(); frames.set(immutableBase, cache); }
    const cached = cache.get(key);
    if (cached) return cached;
    // A composed world contains large immutable lookup graphs. Release the
    // previous cache reference before constructing the next edit; consumers
    // retain whichever committed or preview frame they are still displaying.
    cache.clear();
    let land = immutableBase;
    if (options.shoulder && shoulderRevision) {
        const known = extensions.get(immutableBase);
        if (known?.revision === shoulderRevision) land = known.world;
        else {
            land = composeAuthoredShoulderWorld(immutableBase, options.shoulder);
            extensions.set(immutableBase, { revision: shoulderRevision, world: land });
        }
    }
    let growthTerrainPlan = options.growthTerrain ? deriveAuthoredGrowthTerrainPlan(state, land, options.growthTerrain) : undefined;
    if (options.growthTerrain && growthTerrainPlan && !growthTerrainPlan.rejectedReason) {
        try { land = composeAuthoredGrowthTerrainWorld(land, options.growthTerrain, growthTerrainPlan); }
        catch (error) {
            if (!(error instanceof Error) || !/^(Invalid island world:|Authored growth terrain:)/.test(error.message)) throw error;
            growthTerrainPlan = rejectAuthoredGrowthTerrainPlan(growthTerrainPlan, error.message);
        }
    }
    const water = options.water ? authoredWaterFrame(state, land) : undefined;
    const upstream = water?.world ?? land;
    let world = upstream, covePlan: AuthoredCovePlan | undefined;
    if (options.cove) {
        const inputPlaces = derivePlaces(state, upstream);
        covePlan = deriveAuthoredCovePlan(state, upstream, inputPlaces, profile);
        if (covePlan.assemblies.length) {
            try {
                const composed = composeAuthoredCoveWorld(upstream, covePlan);
                covePlan = reconcileAuthoredCovePlan(covePlan, inputPlaces, derivePlaces(state, composed));
                if (covePlan.assemblies.length) world = composed;
            } catch (error) {
                // Unsupported refs/floors fail closed without changing the live world.
                if (!(error instanceof Error) || !/^(Invalid island world:|Authored cove)/.test(error.message)) throw error;
                covePlan = rejectAuthoredCovePlan(covePlan, error.message);
            }
        }
    }
    const revision = options.cove || options.growthTerrain ? `authored-world:${authoredWorldFingerprint([authoredWorldGeometryRevision(immutableBase), options.water,
        water?.plan.revision, covePlan?.revision, ...(shoulderRevision ? [shoulderRevision] : []), ...(growthTerrainPlan ? [growthTerrainPlan.revision] : [])])}` : water?.plan.revision ?? upstream.definition.revision ?? 'base';
    const frame = Object.freeze({ world, ...(water ? { waterPlan: water.plan } : {}), ...(covePlan ? { covePlan } : {}), ...(growthTerrainPlan ? { growthTerrainPlan } : {}), revision });
    cache.set(key, frame);
    return frame;
}
