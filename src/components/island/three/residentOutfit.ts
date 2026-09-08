import * as THREE from 'three';
import { ISLAND_RESIDENT_LOOKS, type IslandResidentLook } from '../../../domain/island/experience';
import { curve, ellipsoid, mesh } from './primitives';
import type { ResidentSpecies } from './residentRig';

/** Conservative neutral-rig envelope, including every optional piece before a child ever equips it. */
export function residentOutfitStandingBounds(species: ResidentSpecies, headY: number) {
    return new THREE.Box3(new THREE.Vector3(-.32, .44, -.28),
        new THREE.Vector3(.32, headY + (species === 'rabbit' ? .35 : .44), .35));
}

/** Outfits attach to existing local body/head groups. They never replace fur,
 * ears, eyes, limbs, the rabbit/fox's fixed scarves, or seat/hand anchors. */
export class IslandResidentOutfit {
    readonly bodyGroup = new THREE.Group();
    readonly headGroup = new THREE.Group();
    private readonly materials = new Set<THREE.MeshStandardMaterial>();
    private fabric?: THREE.DataTexture;
    private built = false;
    private disposed = false;
    private look: IslandResidentLook = 'original';

    constructor(private readonly species: ResidentSpecies, body: THREE.Group, head: THREE.Group) {
        this.bodyGroup.name = 'resident-optional-scarf'; this.headGroup.name = 'resident-optional-cap';
        this.bodyGroup.visible = this.headGroup.visible = false;
        body.add(this.bodyGroup); head.add(this.headGroup);
    }

    private material(color: string) {
        const material = new THREE.MeshStandardMaterial({ color, map: this.fabric, roughness: .98, metalness: 0 });
        this.materials.add(material); return material;
    }

    private build() {
        if (this.built) return;
        this.built = true;
        const bytes = new Uint8Array(32 * 32 * 4);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const offset = (y * 32 + x) * 4, shade = 235 + ((x + y) % 2 ? 10 : 0) + (x % 4 === 0 ? 9 : 0);
            bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = shade; bytes[offset + 3] = 255;
        }
        this.fabric = new THREE.DataTexture(bytes, 32, 32, THREE.RGBAFormat);
        this.fabric.colorSpace = THREE.SRGBColorSpace; this.fabric.wrapS = this.fabric.wrapT = THREE.RepeatWrapping;
        this.fabric.magFilter = THREE.LinearFilter; this.fabric.minFilter = THREE.LinearMipmapLinearFilter;
        this.fabric.generateMipmaps = true; this.fabric.needsUpdate = true;
        const rose = this.material('#e43c83'), teal = this.material('#1498a7'), gold = this.material('#ffc442');
        const cream = this.material('#fff0ce'), ink = this.material('#282b56');
        const rabbit = this.species === 'rabbit';
        // The optional bright neckerchief sits a little lower than existing fixed scarves.
        const neckY = this.species === 'otter' ? .775 : rabbit ? .70 : .71;
        const band = mesh(this.bodyGroup, new THREE.TorusGeometry(rabbit ? .224 : .266, .041, 8, 28), rose, [0, neckY, .035]);
        band.rotation.x = Math.PI / 2; band.scale.z = .8;
        ellipsoid(this.bodyGroup, rose, [-.10, neckY - .105, rabbit ? .263 : .299], [.09, .15, .027], 16).rotation.z = -.21;
        ellipsoid(this.bodyGroup, gold, [.017, neckY - .11, rabbit ? .263 : .299], [.063, .125, .031], 16).rotation.z = .26;
        ellipsoid(this.bodyGroup, cream, [-.07, neckY - .007, rabbit ? .272 : .30], [.052, .044, .038], 12);
        for (let i = 0; i < 4; i++) {
            const stitch = ellipsoid(this.bodyGroup, cream, [-.124 + i * .014, neckY - .185 + i * .05, rabbit ? .292 : .328], [.019, .005, .003], 8);
            stitch.rotation.z = -.2;
        }
        const capY = rabbit ? .205 : .255, capZ = rabbit ? .17 : .045;
        const size: [number, number, number] = rabbit ? [.17, .115, .076] : [.185, .15, .185];
        for (let half = 0; half < 2; half++) {
            mesh(this.headGroup, new THREE.SphereGeometry(1, 20, 12, half * Math.PI, Math.PI, 0, Math.PI / 2), half ? teal : gold,
                [0, capY, capZ], size).name = `cap-patch-${half}`;
        }
        const brimZ = rabbit ? .24 : .20, brimY = capY - .003;
        ellipsoid(this.headGroup, ink, [0, brimY, brimZ], [rabbit ? .185 : .21, .026, rabbit ? .091 : .115], 20).name = 'cap-brim-edge';
        ellipsoid(this.headGroup, gold, [0, brimY + .009, brimZ], [rabbit ? .179 : .204, .022, rabbit ? .088 : .11], 20).name = 'cap-brim-cloth';
        const seam: [number, number, number][] = [];
        for (let i = 0; i <= 12; i++) {
            const angle = i / 12 * Math.PI;
            seam.push([0, capY + Math.sin(angle) * size[1] + .004, capZ + Math.cos(angle) * size[2]]);
        }
        curve(this.headGroup, cream, seam, .006);
        ellipsoid(this.headGroup, rose, [0, capY + size[1] + .008, capZ], [.031, .018, .029], 12);
        for (const group of [this.bodyGroup, this.headGroup]) group.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    }

    set(look: IslandResidentLook) {
        if (this.disposed || !ISLAND_RESIDENT_LOOKS.includes(look) || look === this.look) return false;
        if (look !== 'original') this.build();
        this.look = look;
        this.bodyGroup.visible = look === 'scarf'; this.headGroup.visible = look === 'cap';
        return true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const geometries = new Set<THREE.BufferGeometry>();
        for (const group of [this.bodyGroup, this.headGroup]) {
            group.removeFromParent(); group.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); }); group.clear();
        }
        geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
        this.fabric?.dispose(); this.materials.clear(); this.fabric = undefined;
    }
}
