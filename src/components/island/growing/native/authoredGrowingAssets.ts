import manifest from '../../../../../docs/design/2026-10-11-authored-coast-skin/skin-manifest.json';
import type { AuthoredCoastSkin } from './authoredGrowingGround';
import { decodeNativeGrowingKit } from './decodeNativeGrowingKit';
import bridgeProfile from '../../../../domain/growingIsland/nativeWaterBridgeProfile.json';
import type { AuthoredWaterBridgeSkin } from './authoredWaterBridgeArt';

/** Explicit DEV diagnostic asset. The normal island never loads a sample map
 * or grants its sites to an existing owner's save. */
export async function loadAuthoredCoastSkin(signal: AbortSignal): Promise<AuthoredCoastSkin> {
    if (!import.meta.env.DEV) throw Error('Authored coast diagnostic requires development');
    const response = await fetch('/prototypes/place-qa/native05-coast.json.gz', { signal });
    if (!response.ok) throw Error(`Authored coast load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), manifest.artifact);
    signal.throwIfAborted();
    const skin = JSON.parse(new TextDecoder().decode(buffer)) as AuthoredCoastSkin;
    if (skin.version !== 1 || skin.worldId !== manifest.worldId || skin.source.sha256 !== manifest.source.sha256) throw Error('Authored coast manifest differs');
    return skin;
}

export async function loadAuthoredWaterBridgeSkin(signal: AbortSignal): Promise<AuthoredWaterBridgeSkin> {
    if (!import.meta.env.DEV) throw Error('Authored water bridge diagnostic requires development');
    const response = await fetch(bridgeProfile.artifact.path, { signal });
    if (!response.ok) throw Error(`Authored water bridge load: ${response.status}`);
    const buffer = await decodeNativeGrowingKit(await response.arrayBuffer(), { sha256: bridgeProfile.artifact.expandedSha256,
        gzipSha256: bridgeProfile.artifact.sha256, bytes: bridgeProfile.artifact.bytes });
    signal.throwIfAborted();
    const skin = JSON.parse(new TextDecoder().decode(buffer)) as AuthoredWaterBridgeSkin;
    if (skin.version !== 1 || skin.source.id !== bridgeProfile.source.id || skin.source.sha256 !== bridgeProfile.source.sha256
        || skin.scale !== bridgeProfile.scale || skin.parts.length !== bridgeProfile.counts.parts) throw Error('Authored water bridge manifest differs');
    return skin;
}
