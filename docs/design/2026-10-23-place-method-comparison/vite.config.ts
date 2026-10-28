import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../../vite.config';
import { foundationTransform, foundationCommandTransform } from '../2026-10-22-place-strategy-trial/foundation-transform.mjs';
import { terrainMethodTransform } from './terrain-transform.mjs';
import { curvedGridLandscapeTransform, curvedGridWorldSceneTransform } from './curved-grid-transform.mjs';
import { growthSeamCommandTransform } from './growth-seam-transform.mjs';
import { liveUseTransform } from './live-use-transform.mjs';
import { stableBaseTerrainTransform, stableBaseWorldTransform } from './stable-base-transform.mjs';
import { rampPlaneTerrainTransform } from './ramp-plane-transform.mjs';
import { singleCompileWorldTransform, singleCompileTerrainTransform } from './single-compile-transform.mjs';
import { trialTimingTransform } from './timing-transform.mjs';
import { edgeCheckMemoTransform } from './edge-check-memo-transform.mjs';
import { memoSamplesTransform } from './memo-samples-transform.mjs';
import { frozenQueryTransform } from './frozen-query-transform.mjs';

/** Explicit local experiment using the ordinary app, writer and resident life. */
export default defineConfig(env => mergeConfig(baseConfig(env), {
    plugins: [{
        name: 'place-method-comparison', enforce: 'pre',
        transform(source: string, id: string) {
            const transformCandidate = (source: string, id: string) => {
                if (id.endsWith('/src/domain/growingIsland/commands.ts')) return trialTimingTransform(growthSeamCommandTransform(source), id);
                if (id.endsWith('/src/components/island/growing/GrowingWorld.tsx')) return trialTimingTransform(liveUseTransform(source), id);
                if (id.endsWith('/src/domain/growingIsland/placeTerrain.ts')) return stableBaseTerrainTransform(source);
                if (id.endsWith('/src/domain/growingIsland/worldDefinition.ts')) return trialTimingTransform(edgeCheckMemoTransform(singleCompileWorldTransform(source)), id);
                if (id.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) return memoSamplesTransform(trialTimingTransform(singleCompileTerrainTransform(rampPlaneTerrainTransform(stableBaseWorldTransform(terrainMethodTransform(foundationTransform(source))))), id));
                if (id.endsWith('/src/domain/growingIsland/terrainEditing.ts')) return foundationCommandTransform(source);
                if (id.endsWith('/src/domain/growingIsland/landscape.ts')) return curvedGridLandscapeTransform(source);
                if (id.endsWith('/src/components/island/growing/growingCamera.ts')) {
                    const needle = 'export function frameCamera(camera: T.OrthographicCamera, layout: SceneLayout, view: CameraView, aspect: number) {';
                    if (source.split(needle).length !== 2) throw Error('Comparison camera integration changed');
                    return "import { fixedComparisonCamera } from '../../../../docs/design/2026-10-23-place-method-comparison/comparison-camera';\n"
                        + source.replace(needle, needle + '\n    const fixed = fixedComparisonCamera(camera, aspect); if (fixed) return fixed;');
                }
                if (id.endsWith('/src/components/island/growing/worldScene.ts')) {
                    if (!source.includes('buildEditableGround(layout)')) throw Error('Ground integration changed; review comparison adapter');
                    return trialTimingTransform(curvedGridWorldSceneTransform(source).replace("import { buildEditableGround } from './editableGround';",
                        "import { buildComparisonGround as buildEditableGround } from '../../../../docs/design/2026-10-23-place-method-comparison/ground';")
                        .replace('buildEditableGround(layout)', 'buildEditableGround(layout, state)'), id);
                }
                if (id.endsWith('/src/components/island/growing/GrowingIsland.tsx')) {
                    const needle = '        {guideRequest && <GrowingGuideEntry';
                    if (!source.includes(needle)) throw Error('Read-only evidence panel integration changed');
                    const hook = "import { useGrowingIsland } from './useGrowingIsland';";
                    if (source.split(hook).length !== 2) throw Error('Fixture hook integration changed');
                    for (const [before, after] of [
                        ['    const leaveFlower = async () => {', '    const leaveFlower = async () => {\n        if (expandedTrialEnabled()) return;'],
                        ['    const startVisit = async (id: string) => {', '    const startVisit = async (id: string) => {\n        if (expandedTrialEnabled()) return;'],
                        ['    const showChoice = async (choice: ShowChoice) => {', "    const showChoice = async (choice: ShowChoice) => {\n        if (expandedTrialEnabled() && (choice === 'visit' || choice === 'story')) { setLine('比較用の島では、この操作をしません。'); return; }"],
                        ['        if (!own || !pendingPicture.current || own.unopened.length || own.arrivals.length || visit) return;', '        if (expandedTrialEnabled() || !own || !pendingPicture.current || own.unopened.length || own.arrivals.length || visit) return;'],
                        ["setLine('じめんを ほぞんしたよ');", "setLine(expandedTrialEnabled() ? '比較用の じめんを かえたよ（保存しません）' : 'じめんを ほぞんしたよ');"],
                    ]) {
                        if (source.split(before).length !== 2) throw Error('Fixture I/O isolation changed');
                        source = source.replace(before, after);
                    }
                    return "import { TrialEvidence } from '../../../../docs/design/2026-10-23-place-method-comparison/TrialEvidence';\n"
                        + source.replace(hook, "import { useComparisonIsland as useGrowingIsland, expandedTrialEnabled } from '../../../../docs/design/2026-10-23-place-method-comparison/TrialIsland';")
                            .replace(needle, '        <TrialEvidence state={own} />\n' + needle);
                }
            };
            return frozenQueryTransform(transformCandidate(source, id) ?? source, id);
        },
    }],
    build: { outDir: '/private/tmp/sansu-place-method-comparison-build', emptyOutDir: true },
}));
