import manifest from '../../../docs/design/2026-10-12-authored-cove-entrance/source-manifest.json';
import patch from '../../../docs/design/2026-10-12-authored-cove-entrance/shared-apron-world-patch-v1.json';
import type { DerivedPlace } from './placeTypes';
import type { Cell, GrowingState, Plot } from './types';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { WorldDistrict, WorldEdge, WorldPoint, WorldSite } from './worldTypes';
import { occupiedCells } from '../islandLife/footprint';
import type { ItemKind } from '../islandLife/model';

/** Visual assembly identity includes the shared shore; the unchanged shell
 * keeps its own source ID and byte hash. */
export const AUTHORED_COVE_VISUAL_CANDIDATE = patch.candidate;

export interface AuthoredCoveTransform {
    readonly pivot: [number, number, number];
    readonly position: WorldPoint;
    readonly scale: number;
    readonly yaw: number;
}
export interface AuthoredCoveAssembly {
    readonly placeId: string;
    readonly placeRevision: string;
    readonly ownerIds: readonly string[];
    readonly playId: string;
    readonly sourceId: string;
    readonly sourceSha256: string;
    readonly transform: AuthoredCoveTransform;
}
export interface AuthoredCovePatch {
    readonly district: WorldDistrict;
    readonly siteAdditions: readonly { districtId: string; sites: readonly WorldSite[] }[];
    readonly edges: readonly WorldEdge[];
}
interface CovePlotRole {
    readonly cell: Cell;
    readonly stage: Plot['stage'];
    readonly style: Plot['style'];
}
export interface AuthoredCoveSourceProfile {
    readonly revision: string;
    readonly sourceId: string;
    readonly sourceSha256: string;
    readonly baseSha256: string;
    readonly groundInputSha256: string;
    readonly transform: AuthoredCoveTransform;
    readonly localGround: { readonly min: Cell; readonly max: Cell; readonly revision: string };
    readonly clearCourt: { readonly min: Cell; readonly max: Cell };
    readonly roles: {
        readonly play: CovePlotRole;
        readonly homes: readonly CovePlotRole[];
        readonly supply: Cell;
    };
    readonly patch: AuthoredCovePatch;
}
export interface AuthoredCovePlan {
    readonly revision: string;
    readonly sourceId: string;
    readonly sourceSha256: string;
    readonly assemblies: readonly AuthoredCoveAssembly[];
    /** The exact upstream geometry this additive patch was evaluated against. */
    readonly upstreamRevision: string;
    readonly profileRevision: string;
    readonly patch?: AuthoredCovePatch;
}

function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

/** Stable geometry identity, not a cryptographic substitute for source SHA-256. */
export function authoredWorldFingerprint(value: unknown): string {
    const text = JSON.stringify(value) ?? 'undefined';
    let a = 2166136261, b = 2246822507;
    for (let i = 0; i < text.length; i++) {
        a = Math.imul(a ^ text.charCodeAt(i), 16777619);
        b = Math.imul(b ^ text.charCodeAt(i), 3266489909);
    }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const worldRevisions = new WeakMap<IslandWorld, string>();
const profileRevisions = new WeakMap<AuthoredCoveSourceProfile, string>();
export function authoredCoveProfileRevision(profile: AuthoredCoveSourceProfile): string {
    const known = profileRevisions.get(profile);
    if (known) return known;
    const revision = authoredWorldFingerprint(profile);
    // Only our recursively frozen source is cacheable. A caller may freeze its
    // outer profile while still editing nested geometry during authoring.
    if (profile === AUTHORED_COVE_SOURCE_PROFILE) profileRevisions.set(profile, revision);
    return revision;
}
export function authoredWorldGeometryRevision(world: IslandWorld): string {
    let revision = worldRevisions.get(world);
    if (!revision) { revision = authoredWorldFingerprint(world.definition); worldRevisions.set(world, revision); }
    return revision;
}

/** Consume every triangle touching the court, including added water/upper floors. */
export function authoredCoveGroundRevision(world: IslandWorld, bounds: { min: Cell; max: Cell }): string {
    const triangles: unknown[] = [];
    for (const floor of world.floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const vertices = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]);
        const points = vertices.map(vertex => vertex.point);
        if (Math.max(...points.map(point => point.x)) < bounds.min.x || Math.min(...points.map(point => point.x)) > bounds.max.x
            || Math.max(...points.map(point => point.z)) < bounds.min.z || Math.min(...points.map(point => point.z)) > bounds.max.z) continue;
        // This profile guards physical support. Source shading attributes must
        // not invalidate an otherwise identical court or its owned assembly.
        triangles.push([floor.id, floor.kind, vertices.map(({ cell, point }) => ({ cell, point }))]);
    }
    return authoredWorldFingerprint(triangles);
}

// This source was audited with these physical models and positions. Ordinary
// P04 growth remains more general; an unproved arrangement gets no fixed shell.
export const AUTHORED_COVE_SOURCE_PROFILE: AuthoredCoveSourceProfile = freeze({
    revision: 'native05-cove-fixed-water-homes-v1',
    sourceId: manifest.candidate,
    sourceSha256: manifest.outputs['cove-corner-v3.glb'],
    baseSha256: manifest.original_hashes['whole-island.glb'],
    groundInputSha256: manifest.ground_input_sha256,
    transform: {
        pivot: [...manifest.source_transform.pivot_gltf] as [number, number, number],
        position: { x: manifest.source_transform.position[0], y: manifest.source_transform.position[1], z: manifest.source_transform.position[2] },
        scale: manifest.source_transform.uniform_scale,
        yaw: manifest.source_transform.yaw,
    },
    // Actual source floor triangles within this support/entry envelope. The
    // native05 base and its audited hill-water composition have this same value.
    // Include the bowed v4 shoreline and its surrounding clearance, not just
    // the older rectangular apron. A changed floor at its sea-facing tip must
    // invalidate this fixed source too.
    localGround: { min: { x: 5, z: -3.5 }, max: { x: 11, z: 3.5 }, revision: 'b854fd9d1de0c4d9' },
    clearCourt: { min: { x: 5, z: -3.5 }, max: { x: 11, z: 3.5 } },
    roles: {
        play: { cell: { x: 8, z: 0 }, stage: 1, style: 'plain' },
        homes: [{ cell: { x: 7, z: -1 }, stage: 4, style: 'water' }, { cell: { x: 9, z: -1 }, stage: 4, style: 'water' }],
        supply: { x: 8, z: -2 },
    },
    patch: structuredClone(patch) as AuthoredCovePatch,
});

const sameCell = (a: Cell | undefined, b: Cell) => !!a && Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.z - b.z) < 1e-8;
const matchesPlot = (plot: Plot | undefined, role: CovePlotRole) => !!plot && sameCell(plot.cell, role.cell)
    && plot.stage === role.stage && plot.style === role.style;

/** No geometry derives from receipts, a place anchor, or a previously added apron. */
export function deriveAuthoredCovePlan(state: GrowingState, upstream: IslandWorld, inputPlaces: readonly DerivedPlace[],
    profile: AuthoredCoveSourceProfile = AUTHORED_COVE_SOURCE_PROFILE): AuthoredCovePlan {
    const upstreamRevision = authoredWorldGeometryRevision(upstream), profileRevision = authoredCoveProfileRevision(profile);
    if (upstream.definition.districts.some(district => district.id === profile.patch.district.id))
        throw new Error('Authored cove requires the upstream world without its apron');
    const assemblies: AuthoredCoveAssembly[] = [];
    const sourceMatches = upstream.definition.source?.sha256 === profile.baseSha256
        && authoredCoveGroundRevision(upstream, profile.localGround) === profile.localGround.revision;
    for (const place of inputPlaces) {
        // The upstream derivation already proves shore, supply and reachable use.
        if (!sourceMatches || place.ruleId !== 'P04' || place.variant !== 'bay'
            || !['grown', 'lived'].includes(place.stage) || place.missing.length) continue;
        const main = place.mainIds.map(id => state.plots.find(plot => plot.id === id));
        const play = main.find(plot => plot?.kind === 'play');
        const homes = main.filter((plot): plot is Plot => plot?.kind === 'home');
        if (!play || !matchesPlot(play, profile.roles.play) || main.length !== profile.roles.homes.length + 1
            || homes.length !== profile.roles.homes.length || main.some(plot => !plot || state.unopened.includes(plot.id))) continue;
        if (!profile.roles.homes.every(role => homes.some(home => matchesPlot(home, role)))) continue;
        const use = place.useTargets.find(target => target.id === play.id && target.kind === 'play');
        if (!use || !sameCell(use.cell, profile.roles.play.cell)) continue;
        const supply = state.landmarks.find(owner => owner.kind === 'water-bowl' && sameCell(owner.cell, profile.roles.supply)
            && place.waterRefs.includes(owner.id) && place.memberIds.includes(owner.id));
        if (!supply || ![play, ...homes, supply].every(owner => owner.cell && upstream.owns(owner.cell) && upstream.anchorAt(owner.cell))) continue;
        const required = new Set([play, ...homes, supply].map(owner => owner.id));
        const inCourt = (cell: Cell) => cell.x >= profile.clearCourt.min.x && cell.x <= profile.clearCourt.max.x
            && cell.z >= profile.clearCourt.min.z && cell.z <= profile.clearCourt.max.z;
        const occupied = [...state.plots, ...state.keepsakes].filter(owner => !required.has(owner.id)).flatMap(owner => owner.cell ? [owner.cell] : []);
        occupied.push(...state.landmarks.filter(owner => !required.has(owner.id)).flatMap(owner => occupiedCells({ kind: owner.kind as ItemKind, cell: owner.cell })));
        if (occupied.some(inCourt)) continue;
        assemblies.push({ placeId: place.id, placeRevision: place.revision, ownerIds: [...place.memberIds], playId: play.id,
            sourceId: profile.sourceId, sourceSha256: profile.sourceSha256, transform: structuredClone(profile.transform) });
    }
    // Fixed sockets describe one arrangement, never several overlapping shells.
    if (assemblies.length > 1) assemblies.length = 0;
    const revision = `authored-cove:${authoredWorldFingerprint([upstreamRevision, profileRevision, assemblies,
        inputPlaces.filter(place => place.ruleId === 'P04'), state.plots, state.landmarks, state.keepsakes, state.unopened])}`;
    return freeze({ revision, upstreamRevision, profileRevision, sourceId: profile.sourceId, sourceSha256: profile.sourceSha256,
        assemblies, ...(assemblies.length ? { patch: structuredClone(profile.patch) } : {}) });
}

/** Append only the authored floor, bank and walk grants; acquired rights stay upstream. */
export function composeAuthoredCoveWorld(upstream: IslandWorld, plan: AuthoredCovePlan): IslandWorld {
    if (authoredWorldGeometryRevision(upstream) !== plan.upstreamRevision) throw new Error('Authored cove upstream geometry changed');
    if (!plan.assemblies.length) return upstream;
    if (!plan.patch) throw new Error('Authored cove assembly has no apron');
    const patch = plan.patch;
    if (upstream.definition.districts.some(district => district.id === patch.district.id)) throw new Error('Authored cove apron already composed');
    if ([...patch.district.sites, ...patch.siteAdditions.flatMap(addition => addition.sites)].some(site => site.placement)
        || patch.edges.some(edge => edge.allows.length !== 1 || edge.allows[0] !== 'walk')) throw new Error('Authored cove patch grants more than walking');
    const districtIds = new Set(upstream.definition.districts.map(district => district.id));
    if (patch.siteAdditions.some(addition => !districtIds.has(addition.districtId))) throw new Error('Authored cove site district is absent');
    const districts = upstream.definition.districts.map(district => ({ ...district,
        sites: [...district.sites, ...patch.siteAdditions.filter(addition => addition.districtId === district.id).flatMap(addition => addition.sites)] }));
    const world = compileWorldDefinition({ ...upstream.definition, revision: plan.revision,
        districts: [...districts, patch.district], edges: [...upstream.definition.edges, ...patch.edges] });
    for (const site of upstream.sites) {
        const before = site.support, after = world.floorAt(site.cell);
        if (!!before !== !!after || before && after && (before.floorId !== after.floorId
            || Math.hypot(before.point.x - after.point.x, before.point.y - after.point.y, before.point.z - after.point.z) > 1e-8))
            throw new Error('Authored cove patch changes existing site support');
    }
    return world;
}

const placeIdentity = (place: DerivedPlace) => JSON.stringify([place.id, place.mainIds, place.memberIds, place.stage, place.variant,
    place.waterRefs, place.useTargets.map(target => [target.id, target.kind, target.cell])]);

/** The extra route may alter footprint/revision, but may not recruit its own owners. */
export function reconcileAuthoredCovePlan(plan: AuthoredCovePlan, inputPlaces: readonly DerivedPlace[], finalPlaces: readonly DerivedPlace[]): AuthoredCovePlan {
    const valid = plan.assemblies.every(assembly => {
        const input = inputPlaces.find(place => place.id === assembly.placeId), final = finalPlaces.find(place => place.id === assembly.placeId);
        return input && final && placeIdentity(input) === placeIdentity(final);
    });
    if (!valid) return rejectAuthoredCovePlan(plan, 'membership-rejected');
    return freeze({ ...plan, assemblies: plan.assemblies.map(assembly => ({ ...assembly,
        placeRevision: finalPlaces.find(place => place.id === assembly.placeId)!.revision })) });
}

export function rejectAuthoredCovePlan(plan: AuthoredCovePlan, reason: string): AuthoredCovePlan {
    return freeze({ ...plan, revision: `authored-cove:${authoredWorldFingerprint([plan.revision, reason])}`, assemblies: [], patch: undefined });
}
