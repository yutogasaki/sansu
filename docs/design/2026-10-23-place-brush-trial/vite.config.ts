import { connectionTransform } from './connection-transform.mjs';
import { waterMethodTransform } from './water-method-transform.mjs';
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import parent from '../2026-10-23-place-method-comparison/vite.config';

function once(source: string, before: string, after: string) {
    if (source.split(before).length !== 2) throw Error(`Place outline integration changed: ${before}`);
    return source.replace(before, after);
}
export function placeTransform(source: string, id: string) {
    source=connectionTransform(source,id);
    source=waterMethodTransform(source,id);
    if (id.endsWith('/src/components/island/growing/GrowingTray.tsx')) {
        source = once(source, 'const landmarks = tutorial ? [] : LANDMARKS.filter(kind => canPurchase(state, `landmark:${kind}`));',
            'const landmarks = tutorial && !compositeEnabled() ? [] : LANDMARKS.filter(kind => canPurchase(state, `landmark:${kind}`));');
        return "import { compositeEnabled } from '../../../../docs/design/2026-10-23-place-brush-trial/composite-field';\n" + source;
    }
    if (id.endsWith('/src/components/island/growing/GrowingWorld.tsx')) {
        source = once(source, '        const cast = (event: PointerEvent) => {', `        const trialPointers: Record<string, unknown>[] = [];
        const recordTrialPointer = (entry: Record<string, unknown>) => {
            if (!new URLSearchParams(location.search).has('trialEvidence')) return;
            trialPointers.push({ at: performance.now(), ...entry });
            if (trialPointers.length > 12) trialPointers.shift();
            if (host.current) host.current.dataset.placePointer = JSON.stringify(trialPointers);
        };
        const cast = (event: PointerEvent) => {`);
        source = once(source, '            ray.setFromCamera(ndc, camera); return ray;', `            ray.setFromCamera(ndc, camera);
            recordTrialPointer({ phase: 'cast', event: event.type, x: event.clientX, y: event.clientY,
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, ndc: ndc.toArray(),
                projection: camera.projectionMatrix.toArray(), inverse: camera.projectionMatrixInverse.toArray(),
                matrixWorld: camera.matrixWorld.toArray(), origin: ray.ray.origin.toArray(), direction: ray.ray.direction.toArray() });
            return ray;`);
        source = once(source, '            if (target) {\n                const hit = target;', `            recordTrialPointer({ phase: 'select', x: event.clientX, y: event.clientY,
                objectId: target?.object.userData.objectId, actorId: target?.object.userData.actorId,
                boat: target?.object.userData.boat, name: target?.object.name, distance: target?.distance });
            if (target) {
                const hit = target;`);
        return source;
    }
    if (id.endsWith('/docs/design/2026-10-23-place-method-comparison/ground.ts')) {
        source = once(source, 'const ground = buildTrialGround(layout, state);', 'const ground = applyContinuousMaterial(buildTrialGround(layout, state));');
        return "import { applyContinuousMaterial } from '../2026-10-23-place-brush-trial/continuous-material';\n" + source;
    }
    if (id.endsWith('/src/domain/growingIsland/types.ts')) {
        return once(source, 'export type Command =', "export type Command =\n    | import('../../../docs/design/2026-10-23-place-brush-trial/persistent-model').TrialPlaceCommand\n    | import('../../../docs/design/2026-10-23-place-brush-trial/composite-model').CompositeCommand");
    }
    if (id.endsWith('/src/domain/growingIsland/commands.ts')) {
        source = once(source, '    const state = structuredClone(previous);', `    const state = structuredClone(previous);
    if (intent.command.type === 'place-set') {
        if (!applyCompositeCommand(state, intent.command)) return { state: previous, events: [] };
        state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
        return { state, events: [] };
    }
    if (intent.command.type === 'place-outline') {
        if (compositeOf(state) !== undefined) throw Error('2つの場所の比較では西か東を選んで編集してください。');
        if (!applyTrialPlaceCommand(state, intent.command)) return { state: previous, events: [] };
        state.applied = [...state.applied, intent.id].slice(-RULES.appliedMemory);
        return { state, events: [] };
    }`);
        source = once(source, '        if (!applyTerrainCommand(state, intent.command)) return { state: previous, events: [] };',
            '        if (!applyTerrainCommand(state, intent.command)) return { state: previous, events: [] };\n        assertCompositeGeometry(state);\n        assertCompositeConnectivity(previous, state);');
        source = once(source, '    if (state.terrain) world = editableIslandWorld(state);',
            '    if (state.terrain) world = editableIslandWorld(state);\n    assertCompositeGeometry(state);');
        return "import { applyTrialPlaceCommand } from '../../../docs/design/2026-10-23-place-brush-trial/persistent-model';\nimport { applyCompositeCommand, assertCompositeGeometry, assertCompositeConnectivity } from '../../../docs/design/2026-10-23-place-brush-trial/composite-model';\nimport { compositeOf } from '../../../docs/design/2026-10-23-place-brush-trial/composite-field';\n" + source;
    }
    if (id.endsWith('/docs/design/2026-10-23-place-brush-trial/trial-store.ts')) {
        source = once(source, 'export const trialDatabase = () => database ??= new GrowingIslandDatabase(TRIAL_DATABASE);',
            'export const trialDatabase = () => { assertNoShoulderPersistence(); if (compositeEnabled() || coastalTrialMode() !== "off") throw Error("この比較はメモリ内専用です。保存DBは開けません。"); return database ??= new GrowingIslandDatabase(TRIAL_DATABASE); };');
        source = once(source, 'export function assertSavedTrialRecipe() {',
            'export function assertSavedTrialRecipe() {\n    assertNoShoulderPersistence();\n    if (compositeEnabled() || coastalTrialMode() !== "off") throw Error("この比較はメモリ内専用です。保存DBは開けません。");');
        return "import { compositeEnabled } from './composite-field';\nimport { assertNoShoulderPersistence } from './shoulder-section';\n" + source;
    }
    if (id.endsWith('/src/domain/growingIsland/repository.ts')) {
        source = once(source, '    database = growingDb, receiptSinceRevision?: number): Promise<{ record: GrowingRecord; town: TownEvent[] }> {',
            '    database = growingDb, receiptSinceRevision?: number): Promise<{ record: GrowingRecord; town: TownEvent[] }> {\n    assertCompositeWriteBoundary(profileId, intent, database);');
        source = once(source, '        await database.islands.put(record);\n        return { record, town: events };',
            '        assertCompositeRecordBoundary(record, database);\n        await database.islands.put(record);\n        return { record, town: events };');
        source = once(source, "        if (!current) throw new Error('しまを よみこんでから もういちど ためしてね。');",
            "        if (!current) throw new Error('しまを よみこんでから もういちど ためしてね。');\n        assertCompositeRecordBoundary(current, database);");
        source = once(source, 'export async function readGrowingIsland(profileId: string, database = growingDb) {',
            'export async function readGrowingIsland(profileId: string, database = growingDb) {\n    assertCompositeReadBoundary(profileId, database);');
        source = once(source, 'export function observeGrowingIsland(profileId: string, database = growingDb) {',
            'export function observeGrowingIsland(profileId: string, database = growingDb) {\n    assertCompositeReadBoundary(profileId, database);');
        const readGuard = 'if (record) readable(record);';
        if (source.split(readGuard).length !== 3) throw Error('Trial repository read guards changed');
        source = source.replaceAll(readGuard, 'if (record) { readable(record); assertCompositeRecordBoundary(record, database); }');
        return "import { assertCompositeWriteBoundary, assertCompositeReadBoundary, assertCompositeRecordBoundary } from '../../../docs/design/2026-10-23-place-brush-trial/composite-store';\n" + source;
    }
    if (id.endsWith('/src/domain/growingIsland/syncProjection.ts')) {
        source = once(source, '    validateTerrain(record.state);', '    validateTerrain(record.state);\n    validateTrialPlaceState(record.state);\n    validateSavedCompositeIfPresent(record);');
        return "import { validateTrialPlaceState } from '../../../docs/design/2026-10-23-place-brush-trial/persistent-model';\nimport { validateSavedCompositeIfPresent } from '../../../docs/design/2026-10-23-place-brush-trial/composite-store';\n" + source;
    }
    if (id.endsWith('/src/domain/growingIsland/terrainEditing.ts')) {
        source = once(source, 'return supported(legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), world, cell, .46);',
            'return supported(legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), world, cell, .46)\n        || (hasFlatPlace(state) && flatOwnerFootprintSupported(world, cell));');
        return "import { flatOwnerFootprintSupported } from '../../../docs/design/2026-10-23-place-brush-trial/flat-support';\nimport { hasFlatPlace } from '../../../docs/design/2026-10-23-place-brush-trial/composite-field';\n" + source;
    }
    if (id.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) {
        source = once(source, 'return JSON.stringify([', 'return JSON.stringify([placeRevision(state), ');
        source = once(source, 'mode: TerrainMethod = terrainMethod()): IslandWorld | undefined {',
            'mode: TerrainMethod = terrainMethod(), coastMode: CoastalMode = coastalTrialMode()): IslandWorld | undefined {');
        source = once(source, 'const revision = `${curved}:${terrainRevision(state, mode)}`',
            'const revision = `${curved}:${terrainRevision(state, mode)}${coastMode === "off" ? "" : ":" + COASTAL_SECTION_REVISION + ":" + coastMode}`');
        source = once(source, "trialTimingDetail(__trialTimingToken, 'cold');", "trialTimingDetail(__trialTimingToken, 'cold');\n    resetPlacePlans(state);");
        source = once(source, 'const surfaceHeight = coastBase ?', 'const originalSurfaceHeight = coastBase ?');
        source = once(source, '    type Sample = Cell & { y: number };',
            '    const surfaceHeight = createCoastalPlaceSection(state, originalSurfaceHeight, coastMode).heightAt;\n    type Sample = Cell & { y: number };');
        source = once(source, 'function rawHeight(state: TerrainLand, cell: Cell, curved: boolean, mode: TerrainMethod): number {',
            'function unmodifiedHeight(state: TerrainLand, cell: Cell, curved: boolean, mode: TerrainMethod): number {');
        source += `\nfunction rawHeight(state: TerrainLand, cell: Cell, curved: boolean, mode: TerrainMethod): number {
            const baseline = unmodifiedHeight(state, cell, curved, mode);
            return coastalBypassesPlaceField(state) ? baseline : placeHeight(state, cell, baseline,
                point => unmodifiedHeight(state, point, curved, mode), String(curved) + ':' + mode);
        }\n`;
        return "import { placeRevision, placeHeight, resetPlacePlans } from '../../../docs/design/2026-10-23-place-brush-trial/composite-field';\nimport { createCoastalPlaceSection, coastalTrialMode, coastalBypassesPlaceField, COASTAL_SECTION_REVISION, type CoastalMode } from '../../../docs/design/2026-10-23-place-brush-trial/coastal-section';\n" + source;
    }
    if (id.endsWith('/src/components/island/growing/GrowingIsland.tsx')) {
        source = once(source, "from '../../../../docs/design/2026-10-23-place-method-comparison/TrialIsland';", "from '../../../../docs/design/2026-10-23-place-brush-trial/TrialIsland';");
        source = once(source, "from '../../../../docs/design/2026-10-23-place-method-comparison/TrialEvidence';", "from '../../../../docs/design/2026-10-23-place-brush-trial/PlaceEvidence';");
        source = once(source, "'比較用の じめんを かえたよ（保存しません）'", "(island.trialPersisted ? '試作の じめんを ほぞんしたよ' : '比較用の じめんを かえたよ（保存しません）')");
        source = once(source, '<TrialEvidence state={own} />', `<TrialEvidence state={own} />
        <MatureControls state={own} dispatch={island.dispatch} occupied={() => !camera.current || camera.current.occupiedTerrainPlaceTargets().length > 0} />
        {expandedTrialEnabled() && <PlaceControls state={own} cell={terrainCell} clearSelection={() => setTerrainCell(undefined)} editing={panel === 'terrain'} enter={() => openHomeTool('terrain', '.growing-menu-button')}
            safety={() => camera.current ? { actors: camera.current.terrainActors(), occupiedPlaceTargets: camera.current.occupiedTerrainPlaceTargets() } : undefined}
            act={island.place} undo={island.placeUndo} redo={island.placeRedo} busy={island.busy} persisted={island.trialPersisted} revision={island.record?.revision} />}`);
        return "import { MatureControls } from '../../../../docs/design/2026-10-23-place-brush-trial/MatureControls';\n" + "import { PlaceControls } from '../../../../docs/design/2026-10-23-place-brush-trial/Controls';\n" + source;
    }
    return source;
}
export default defineConfig(async env => {
    const config = typeof parent === 'function' ? await parent(env) : await parent;
    const plugins: Plugin[] = [];
    async function flatten(input: PluginOption): Promise<void> {
        const value = await input;
        if (Array.isArray(value)) { for (const item of value) await flatten(item); }
        else if (value) plugins.push(value);
    }
    for (const entry of config.plugins ?? []) await flatten(entry);
    const comparison = plugins.find(p => p.name === 'place-method-comparison');
    if (!comparison || typeof comparison.transform !== 'function') throw Error('Comparison transform missing');
    const old = comparison.transform;
    comparison.transform = async function(source, id, options) {
        const result = await old.call(this, source, id, options);
        return placeTransform(typeof result === 'string' ? result : result?.code ?? source, id);
    };
    return { ...config, plugins, build: { ...config.build, outDir: '/private/tmp/sansu-place-outline-build', emptyOutDir: true } };
});
