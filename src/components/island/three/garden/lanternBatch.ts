import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { buildLanternLight } from '../../life/lanternLight';

/** Retain the exact reachable-cell light and footprint regions in one draw call. */
export function batchGardenLanterns(light: ReturnType<typeof buildLanternLight>) {
    const tiles=light.root.children.filter((child):child is T.Mesh<T.BufferGeometry,T.ShaderMaterial>=>child instanceof T.Mesh);
    if(!tiles.length) return ()=>{};
    const material=tiles[0].material.clone();
    material.vertexShader='attribute vec4 tileEdges; varying vec4 edges;\n'+material.vertexShader.replace('void main(){','void main(){edges=tileEdges;');
    material.fragmentShader=material.fragmentShader.replace('uniform vec4 edges;','varying vec4 edges;');
    delete material.uniforms.edges;
    const geometries=tiles.map(tile=>{
        tile.updateMatrix();const geometry=tile.geometry.clone().applyMatrix4(tile.matrix);
        const edge=tile.material.uniforms.edges.value as T.Vector4,values=new Float32Array(geometry.attributes.position.count*4);
        for(let i=0;i<values.length;i+=4)edge.toArray(values,i);
        geometry.setAttribute('tileEdges',new T.BufferAttribute(values,4));return geometry;
    });
    const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!merged){material.dispose();return ()=>{};}
    tiles.forEach(tile=>{tile.removeFromParent();tile.geometry.dispose();tile.material.dispose();});
    const mesh=new T.Mesh(merged,material);mesh.name='garden-lantern-ground';light.root.add(mesh);
    return ()=>{merged.dispose();material.dispose();};
}
