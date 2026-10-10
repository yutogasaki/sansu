import * as T from 'three';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { makePokomokoRig } from '../../../src/components/island/three/islandCharacters';
import { makeResidentRig } from '../../../src/components/island/three/residentRig';
import { IslandMaterials } from '../../../src/components/island/three/primitives';

const output = process.argv[2];
const paints = new IslandMaterials('moon-garden');
const hero = makePokomokoRig(paints).hero;
const scarf = new T.Mesh(new T.TorusGeometry(.18, .047, 8, 32), paints.surface('#d75e72', .8));
scarf.rotation.x = Math.PI / 2; scarf.position.y = .59; scarf.name = 'life-scarf'; hero.add(scarf);
const roots = { pokomoko: hero, rabbit: makeResidentRig('rabbit', paints).pose, fox: makeResidentRig('fox', paints).pose };
const mats: T.MeshStandardMaterial[] = [], textures: T.DataTexture[] = [];
const models = Object.fromEntries(Object.entries(roots).map(([name, root]) => {
    root.updateMatrixWorld(true); const meshes: unknown[] = [];
    root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const g = object.geometry.clone().applyMatrix4(object.matrixWorld);
        const mat = object.material as T.MeshStandardMaterial;
        if (!mats.includes(mat)) mats.push(mat);
        meshes.push({ name: object.name || `${name}-mesh-${meshes.length}`, material: mats.indexOf(mat),
            position: Array.from(g.attributes.position.array), uv: g.attributes.uv ? Array.from(g.attributes.uv.array) : null,
            index: g.index ? Array.from(g.index.array) : Array.from({length:g.attributes.position.count},(_,i)=>i) });
        g.dispose();
    });
    return [name, meshes];
}));
function crc(bytes: Uint8Array) {
    let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;
}
function png(texture: T.DataTexture, file: string) {
    const {width,height,data}=texture.image;const raw=Buffer.alloc(height*(width*4+1));
    for(let y=0;y<height;y++) Buffer.from(data.buffer,data.byteOffset+(height-1-y)*width*4,width*4).copy(raw,y*(width*4+1)+1);
    const chunk=(name:string,bytes:Buffer)=>{const t=Buffer.from(name);const h=Buffer.alloc(4);h.writeUInt32BE(bytes.length);const c=Buffer.alloc(4);c.writeUInt32BE(crc(Buffer.concat([t,bytes])));return Buffer.concat([h,t,bytes,c]);};
    const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
    fs.writeFileSync(path.join(output,file),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
const materials=mats.map((m,i)=>{
    const getTexture=(t:T.Texture|null)=>{if(!(t instanceof T.DataTexture))return null;let n=textures.indexOf(t);if(n<0){n=textures.length;textures.push(t);png(t,`resident-texture-${n}.png`);}return `resident-texture-${n}.png`;};
    return {name:m.name||`resident-material-${i}`,color:m.color.toArray(),roughness:m.roughness,map:getTexture(m.map),bumpMap:getTexture(m.bumpMap),bumpScale:m.bumpScale};
});
fs.writeFileSync(path.join(output,'residents.json'),JSON.stringify({source:'existing makePokomokoRig and makeResidentRig; no redesigned geometry',models,materials}));
console.log(JSON.stringify({models:Object.keys(models),meshes:Object.values(models).map(m=>m.length),materials:materials.length,textures:textures.length}));
