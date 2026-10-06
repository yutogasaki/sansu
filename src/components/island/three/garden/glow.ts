import * as T from 'three';

/** Small shared radial texture instead of a full-screen bloom/postprocessing pass. */
export function gardenGlow() {
    const data=new Uint8Array(32*32*4);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
        const at=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
        data[at]=data[at+1]=data[at+2]=255;data[at+3]=Math.round(Math.max(0,1-r)**2*255);
    }
    const texture=new T.DataTexture(data,32,32,T.RGBAFormat);texture.needsUpdate=true;
    const material=new T.SpriteMaterial({map:texture,color:'#ffd298',transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending});
    return {material,sprite(size:number){const sprite=new T.Sprite(material);sprite.scale.set(size,size,1);return sprite;},dispose(){material.dispose();texture.dispose();}};
}
