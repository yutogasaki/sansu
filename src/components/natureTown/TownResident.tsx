import type { ResidentPose } from './residentPose';
const sprites = import.meta.glob('../../assets/natureTown/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Pre-rendered canonical geometry: no WebGL context, pose generation, or crop changes at runtime. */
export function TownResident({ appearance, pose = 'idle' }: { appearance: 'pokomoko' | 'rabbit' | 'otter'; pose?: ResidentPose }) {
    return <span className="town-resident-body" data-pose={pose} aria-hidden="true">
        <span className="town-resident-shadow"/>
        <img src={sprites[`../../assets/natureTown/town-${appearance}-${pose}.png`]} width="160" height="192" alt="" draggable="false"/>
    </span>;
}

export function TownProp({ kind }: { kind: 'home' | 'bench' | 'flowers' | 'tree' }) {
    return <img className={`town-prop-art town-prop-${kind}`} src={sprites[`../../assets/natureTown/town-prop-${kind}.png`]} width="160" height="192" alt="" aria-hidden="true" draggable="false"/>;
}
