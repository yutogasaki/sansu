import type { PartKind } from '../../domain/park/types';
import { threeParkRequested } from './three/config';
import manifest from './artManifest.json';

export const PARK_ART_CANDIDATE = 'park-resin-blender-v1';
export const PARK_ASSET_ROOT = '/assets/park/resin-v1/';
type SpriteMetadata = { width: number; height: number; pivot: number[]; file: string; bounds: number[] };
const sprites = manifest.sprites as Record<string, SpriteMetadata>;

/** Every image shares Blender's camera and unit scale; only its canvas/pivot differs. */
export function ParkSprite({ name, x = 0, y = 0, opacity = 1 }: { name: string; x?: number; y?: number; opacity?: number }) {
    const sprite = sprites[name];
    return <image href={`${PARK_ASSET_ROOT}${sprite.file}`} x={x - sprite.pivot[0]} y={y - sprite.pivot[1]}
        width={sprite.width} height={sprite.height} opacity={opacity} data-sprite={name} />;
}

export function PartIcon({ kind }: { kind: PartKind }) {
    if (threeParkRequested() && ['slide', 'trampoline', 'bubble'].includes(kind)) {
        return <svg viewBox="0 0 256 256" aria-hidden="true" data-icon-candidate="park-three-resin-v1">
            <image href={`/assets/park/three-v1/${kind}-icon.png`} width="256" height="256" />
        </svg>;
    }
    const sprite = sprites[`${kind}-icon`];
    const [left, top, right, bottom] = sprite.bounds;
    return <svg viewBox={`${left - 8} ${top - 8} ${right - left + 16} ${bottom - top + 16}`} aria-hidden="true">
        <image href={`${PARK_ASSET_ROOT}${sprite.file}`} width={sprite.width} height={sprite.height} />
    </svg>;
}
