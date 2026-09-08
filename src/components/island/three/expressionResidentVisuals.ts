import * as THREE from 'three';
import type { IslandExpressionOutfitId, IslandExpressionPatternId } from '../../../domain/island/expression';
import { curve, ellipsoid, mesh } from './primitives';
import type { ResidentSpecies } from './residentRig';

export const EXPRESSION_RESIDENT_CANDIDATE = 'island-stitched-expression-v1';
export function expressionResidentStandingBounds(species: ResidentSpecies, headY: number) {
    return new THREE.Box3(new THREE.Vector3(-.40, .26, -.32), new THREE.Vector3(.40, headY + (species === 'rabbit' ? .34 : .37), .36));
}
function starShape(radius: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const angle = Math.PI / 2 + i * Math.PI / 5, r = radius * (i % 2 ? .46 : 1);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
    }
    shape.closePath(); return shape;
}

/** Owned cloth attaches to the original body, head and shoulders. Switching a
 * selection never recolors or recreates a resident's face, limbs or contacts. */
export class ExpressionResidentVisuals {
    readonly coat = new THREE.Group();
    readonly beret = new THREE.Group();
    readonly pattern = new THREE.Group();
    private readonly sleeves: THREE.Group[] = [];
    private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
    private readonly patterns = new Map<IslandExpressionPatternId, THREE.Group>();
    private fabric?: THREE.DataTexture;
    private built = false;
    private disposed = false;
    private outfitId: IslandExpressionOutfitId | null = null;
    private patternId: IslandExpressionPatternId | null = null;

    constructor(private readonly species: ResidentSpecies, body: THREE.Group, head: THREE.Group) {
        this.coat.name = 'expression-raincoat'; this.beret.name = 'expression-star-beret'; this.pattern.name = 'expression-pattern-cloth';
        body.add(this.coat, this.pattern); head.add(this.beret);
        for (const side of ['left', 'right']) {
            const sleeve = new THREE.Group(); sleeve.name = `expression-coat-sleeve-${side}`;
            body.getObjectByName(`shoulder-${side}`)!.add(sleeve); this.sleeves.push(sleeve);
        }
        this.groups().forEach(group => { group.visible = false; group.userData.visualCandidate = EXPRESSION_RESIDENT_CANDIDATE; });
    }
    private groups() { return [this.coat, this.beret, this.pattern, ...this.sleeves]; }
    private material(color: string) {
        let value = this.materials.get(color);
        if (!value) {
            value = new THREE.MeshStandardMaterial({ color, map: this.fabric, roughness: .95, metalness: 0, side: THREE.DoubleSide });
            this.materials.set(color, value);
        }
        return value;
    }
    private build() {
        if (this.built) return;
        this.built = true;
        const bytes = new Uint8Array(32 * 32 * 4);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
            const at = (y * 32 + x) * 4, value = 232 + (x % 4 === 0 ? 10 : 0) + ((x + y) % 2 ? 10 : 0);
            bytes[at] = bytes[at + 1] = bytes[at + 2] = value; bytes[at + 3] = 255;
        }
        this.fabric = new THREE.DataTexture(bytes, 32, 32); this.fabric.colorSpace = THREE.SRGBColorSpace;
        this.fabric.wrapS = this.fabric.wrapT = THREE.RepeatWrapping; this.fabric.generateMipmaps = true;
        this.fabric.minFilter = THREE.LinearMipmapLinearFilter; this.fabric.needsUpdate = true;
        const yellow = this.material('#f6bf37'), edging = this.material('#a87424'), cream = this.material('#fff0d1');
        const blue = this.material('#187c9d'), pale = this.material('#bbdeda'), ink = this.material('#263950'), rose = this.material('#c94d76');
        const rabbit = this.species === 'rabbit', width = rabbit ? .265 : this.species === 'fox' ? .352 : .327;
        // A flared, open-bottom shell leaves both soles and the seat contact free.
        // Upper sleevelets follow the real shoulders and stop above the paws.
        const profile = [[.86, .29], [.98, .35], [1, .51], [.91, .67], [.70, .78], [.60, .80]].map(([r, y]) => new THREE.Vector2(r * width, y));
        const shell = mesh(this.coat, new THREE.LatheGeometry(profile, 32), yellow); shell.scale.z = rabbit ? .86 : .82;
        shell.name = 'raincoat-cloth-shell';
        const hem: [number, number, number][] = [];
        for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; hem.push([Math.sin(a) * width * .86, .296, Math.cos(a) * width * .86 * shell.scale.z]); }
        curve(this.coat, edging, hem, .009).name = 'raincoat-sewn-hem';
        const frontZ = width * shell.scale.z;
        curve(this.coat, cream, [[0, .36, frontZ * .985], [0, .51, frontZ + .005], [0, .67, frontZ * .93]], .007);
        for (const y of [.45, .58, .69]) ellipsoid(this.coat, blue, [.025, y, frontZ * (y > .65 ? .9 : .997) + .008], [.018, .018, .009], 10);
        for (const sleeve of this.sleeves) ellipsoid(sleeve, yellow, [0, -.025, 0], [.104, .083, .113], 16).name = 'raincoat-shoulder-cloth';
        const hatY = rabbit ? .24 : .275, hatZ = rabbit ? .17 : .06;
        ellipsoid(this.beret, ink, [0, hatY - .027, hatZ], [rabbit ? .181 : .199, .023, rabbit ? .073 : .17], 24).name = 'beret-band';
        const crown = ellipsoid(this.beret, rose, [-.012, hatY + .025, hatZ], [rabbit ? .189 : .211, .067, rabbit ? .077 : .182], 24);
        crown.rotation.z = -.10; crown.name = 'beret-soft-crown';
        curve(this.beret, rose, [[-.025, hatY + .084, hatZ], [-.020, hatY + .100, hatZ], [-.006, hatY + .106, hatZ]], .009);
        const star = mesh(this.beret, new THREE.ShapeGeometry(starShape(.047)), cream, [.012, hatY + .023, hatZ + (rabbit ? .077 : .182) + .003]);
        star.name = 'beret-star-stitch'; star.rotation.z = -.10;
        const clothZ = rabbit ? .264 : this.species === 'fox' ? .308 : .299;
        this.pattern.position.set(.078, .399, clothZ);
        ellipsoid(this.pattern, ink, [0, 0, 0], [.122, .091, .015], 20).name = 'pattern-sewn-border';
        const checked = new THREE.Group(); checked.name = 'river-check'; this.pattern.add(checked); this.patterns.set('river-check', checked);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            const color = (row + col) % 2 ? row % 2 ? cream : pale : blue;
            mesh(checked, new THREE.PlaneGeometry(.049, .034), color, [(col - 1.5) * .049, (row - 1.5) * .034, .016]);
        }
        const butterfly = new THREE.Group(); butterfly.name = 'butterfly-stitch'; this.pattern.add(butterfly); this.patterns.set('butterfly-stitch', butterfly);
        ellipsoid(butterfly, cream, [0, 0, .010], [.112, .081, .010], 20);
        for (const side of [-1, 1]) {
            const wing = ellipsoid(butterfly, rose, [side * .039, .021, .025], [.037, .033, .006], 16); wing.rotation.z = -side * .38;
            ellipsoid(butterfly, blue, [side * .027, -.022, .025], [.027, .023, .006], 16);
            curve(butterfly, ink, [[side * .004, .028, .034], [side * .014, .043, .034], [side * .023, .047, .034]], .003);
        }
        ellipsoid(butterfly, ink, [0, 0, .033], [.007, .041, .004], 10);
        for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
            curve(this.pattern, cream, [[side * .109, -.050 + i * .024, .018], [side * .100, -.045 + i * .024, .018]], .0026);
        }
        this.groups().forEach(group => group.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = false; child.receiveShadow = true; } }));
    }
    set(outfit: IslandExpressionOutfitId | null = null, pattern: IslandExpressionPatternId | null = null) {
        if (this.disposed || outfit === this.outfitId && pattern === this.patternId) return false;
        if (outfit || pattern) this.build();
        this.outfitId = outfit; this.patternId = pattern;
        this.coat.visible = outfit === 'raincoat'; this.beret.visible = outfit === 'star-beret';
        this.sleeves.forEach(sleeve => { sleeve.visible = outfit === 'raincoat'; });
        this.pattern.visible = pattern !== null;
        this.patterns.forEach((group, id) => { group.visible = id === pattern; });
        if (this.built) {
            // The same sewn patch sits on the outside of the raincoat shell.
            this.pattern.position.z = (this.species === 'rabbit' ? .264 : this.species === 'fox' ? .308 : .299) + (outfit === 'raincoat' ? .009 : 0);
        }
        return true;
    }
    describe() {
        return { candidate: EXPRESSION_RESIDENT_CANDIDATE, outfit: this.outfitId, pattern: this.patternId,
            groups: this.groups().map(group => ({ name: group.name, uuid: group.uuid, visible: group.visible, position: group.getWorldPosition(new THREE.Vector3()).toArray() })) };
    }
    dispose() {
        if (this.disposed) return; this.disposed = true;
        const geometries = new Set<THREE.BufferGeometry>();
        this.groups().forEach(group => { group.removeFromParent(); group.traverse(child => { if (child instanceof THREE.Mesh) geometries.add(child.geometry); }); group.clear(); });
        geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.materials.clear(); this.fabric?.dispose();
    }
}
