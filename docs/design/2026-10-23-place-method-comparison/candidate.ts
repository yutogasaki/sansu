import { terrainMethod, SECTION_PROFILE_REVISION, type TerrainMethod } from './section-profile';
import { COASTAL_FIELD_REVISION } from './coastal-field';
import { TERRACE_FIELD_REVISION } from './terrace-field';
import { CONVEX_TERRACE_FIELD_REVISION } from './terrace-convex-field';
import { COASTAL_BASE_REVISION } from './coastal-base-field';
import { CURVED_GRID_REVISION } from './curved-grid';
import { STABLE_BASE_REVISION } from './stable-base-field';
import { RAMP_PLANE_REVISION } from './ramp-plane-field';

export function candidateId(mode: TerrainMethod = terrainMethod()) {
    const revision = mode === 'H' ? `${CONVEX_TERRACE_FIELD_REVISION}+${CURVED_GRID_REVISION}` : mode === 'G' ? COASTAL_BASE_REVISION : mode === 'C' ? COASTAL_FIELD_REVISION : mode === 'D' ? TERRACE_FIELD_REVISION
        : mode === 'F' ? CONVEX_TERRACE_FIELD_REVISION : SECTION_PROFILE_REVISION;
    const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const base = params.get('baseTrial') === 'stable' ? `+${STABLE_BASE_REVISION}` : '';
    const ramp = params.get('rampTrial') === 'linear' && (mode === 'F' || mode === 'H') ? `+${RAMP_PLANE_REVISION}` : '';
    const compile = params.get('compileTrial') === 'single' ? '+single-compile-v1' : '';
    const query = params.get('queryTrial') === 'frozen' ? '+frozen-query-v1' : '';
    const memo = params.get('memoTrial') === 'samples' ? '+memo-samples-v1' : '';
    const edge = params.get('edgeTrial') === 'memo' ? '+memo-edge-check-v1' : '';
    return `place-method-${mode}:${revision}${base}${ramp}${compile}${query}${memo}${edge}`;
}
