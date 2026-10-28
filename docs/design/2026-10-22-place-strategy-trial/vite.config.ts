import { defineConfig, mergeConfig } from 'vite';
import baseConfig from '../../../vite.config';
import { foundationTransform, foundationCommandTransform } from './foundation-transform.mjs';

// A local comparison build of the real app. Save, navigation and life modules
// remain the ordinary application; only the ground builder is substituted.
export default defineConfig(env => mergeConfig(baseConfig(env), {
    plugins: [{
        name: 'place-strategy-trial', enforce: 'pre',
        transform(source: string, id: string) {
            if (process.env.SANSU_FOUNDATION_TRIAL === 'true' && id.endsWith('/src/domain/growingIsland/editableTerrainWorld.ts')) return foundationTransform(source);
            if (process.env.SANSU_FOUNDATION_TRIAL === 'true' && id.endsWith('/src/domain/growingIsland/terrainEditing.ts')) return foundationCommandTransform(source);
            if (!id.endsWith('/src/components/island/growing/worldScene.ts')) return;
            if (!source.includes('buildEditableGround(layout)')) throw Error('Ground integration changed; re-review trial adapter');
            return source.replace("import { buildEditableGround } from './editableGround';",
                "import { buildTrialGround as buildEditableGround } from '../../../../docs/design/2026-10-22-place-strategy-trial/ground';")
                .replace('buildEditableGround(layout)', 'buildEditableGround(layout, state)');
        },
    }],
    build: { outDir: '/private/tmp/sansu-place-strategy-build', emptyOutDir: true },
}));
