import { chromium } from 'playwright';
import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile(new URL('../docs/design/2026-09-14-canopy-materials/fixture-state.json', import.meta.url)));
const output=process.env.SANSU_CANOPY_PREVIEW_OUTPUT;
assert(output, 'Specify a fresh SANSU_CANOPY_PREVIEW_OUTPUT PNG path');
await assert.rejects(access(output), {code:'ENOENT'});
const base=process.env.SANSU_CANOPY_PREVIEW_URL || 'http://127.0.0.1:5223';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1120,height:740}});
try{
    await page.goto(base);
    await page.evaluate(async state=>{
        const T=await import('/node_modules/.vite/deps/three.js');
        const {buildLifeScene}=await import('/src/components/island/life/scene.ts');
        const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:999999;background:#e4eee8;padding:16px;font:15px system-ui;color:#25342e';document.body.append(host);
        const title=document.createElement('p');title.textContent='C3 木肌の素材検討 — 同じ実装済み3D形状／アプリの受入画面ではありません';host.append(title);
        const row=document.createElement('div');row.style.cssText='display:flex;gap:16px';host.append(row);
        state.worldStyle='canopy-dots-c3-v1';state.landscapeVersion='groves-water-v1';
        const map=await new T.TextureLoader().loadAsync('/docs/design/2026-09-14-canopy-materials/bark-albedo-candidate-2.png');
        map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(1,1);map.anisotropy=4;
        for(const candidate of [false,true]){
            const column=document.createElement('div');row.append(column);const label=document.createElement('p');label.textContent=candidate?'候補2：木肌map＋低い凹凸':'現行：周期的な頂点色';column.append(label);
            const content=buildLifeScene(structuredClone(state));content.animate(state.now,true);
            if(candidate){
                const old=content.root.getObjectByName('life-canopy-c3');
                globalThis.__canopyMap=map;
                let source=await (await fetch('/src/components/island/life/canopyScenery.ts')).text();
                if(!source.includes('batch(timber);')) throw Error('Prototype requires review against the changed canopy module');
                source=source.replace('batch(timber);','wood.map = globalThis.__canopyMap; batch(timber);');
                source=source.replace(/from\s*(["'])(\/[^"']+)\1/g,(_,q,path)=>'from '+q+location.origin+path+q);
                const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
                const {buildCanopyScenery}=await import(url);const canopy=buildCanopyScenery(2.5).root;
                old.removeFromParent();content.root.add(canopy);URL.revokeObjectURL(url);
                canopy.traverse(part=>{
                    if(!(part instanceof T.Mesh)||!part.material.vertexColors)return;
                    if(!part.geometry.getAttribute('uv'))throw Error('The material candidate lost its UV coordinates');
                    const colors=part.geometry.getAttribute('color');
                    for(let i=0;i<colors.count;i++){
                        const cool=colors.getY(i)>colors.getX(i);
                        const tint=new T.Color(cool?'#75a89b':'#e2d4b7');colors.setXYZ(i,tint.r,tint.g,tint.b);
                    }colors.needsUpdate=true;
                    part.material=new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:.025,vertexColors:true,roughness:.9});
                });
            }
            const scene=new T.Scene();scene.background=new T.Color('#dcece6');scene.add(content.root);
            scene.add(new T.HemisphereLight('#fff7ea','#63806c',1.15));
            const sun=new T.DirectionalLight('#fff4e0',2.3);sun.position.set(-3,8,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:6,bottom:-6});sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;scene.add(sun);
            const camera=new T.OrthographicCamera(-4.25,4.25,4.8,-4.8,.1,100);camera.position.set(4.5,6.95,11);camera.lookAt(0,.95,0);
            const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(528,596);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;column.append(renderer.domElement);
            renderer.render(scene,camera);
        }
    },fixture);
    await page.screenshot({path:output});
}finally{await browser.close();}
