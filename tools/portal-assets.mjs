import fs from 'node:fs';import path from 'node:path';import {gzipSync} from 'node:zlib';import {hash} from './portal-registry.mjs';
const media=/\.(?:png|jpe?g|webp|avif|svg|glb|gltf|mp3|wav|ogg|mp4|webm|pdf)$/i;
export function addAssets(root,files,registry,manifest){
 const existing=new Map(registry.resources.map(r=>[r.source,r])),assets=[];
 const walk=dir=>{if(!fs.existsSync(path.join(root,dir)))return;for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const source=dir+'/'+e.name;if(e.isSymbolicLink()||/(?:^|\/)(?:private|personal|contacts?|students?|customers?)\//i.test(source))continue;if(e.isDirectory()){walk(source);continue;}if(!e.isFile()||!(media.test(source)||(dir.startsWith('docs/design')&&/\.zip$/i.test(source))))continue;
  const old=existing.get(source),bytes=fs.statSync(path.join(root,source)).size,digest=old?.sha256||hash(fs.readFileSync(path.join(root,source)));
  manifest.sourceFiles[source]=digest;
  if(!old){const row={source,target:'../'+source,bytes,sha256:digest,state:'local-reference',access:'元の素材・アクセス条件を維持。公開許可や採用を意味しない。'};registry.resources.push(row);existing.set(source,row);}
  const ext=path.extname(source).slice(1).toLowerCase();
  assets.push({source,type:/^(png|jpe?g|webp|avif|svg)$/.test(ext)?'image':/^(mp3|wav|ogg)$/.test(ext)?'audio':/^(mp4|webm)$/.test(ext)?'video':/^(glb|gltf)$/.test(ext)?'3d':'document',bytes,sha256:digest,usage:old?'既存資料から参照。使用箇所は原文から確認。':'元ポータルの素材集合。実装での使用先は未確認。',provenance:'元の相対パス。外部出典・ライセンス・最新版の採否は原資料で確認。'});
 }};
 for(const dir of ['assets','public/assets','src/assets','docs/design','public/foundation'])walk(dir);
 const foundation='public/foundation/v1/manifest.json';
 if(fs.existsSync(path.join(root,foundation))){const bytes=fs.readFileSync(path.join(root,foundation)),digest=hash(bytes);manifest.sourceFiles[foundation]=digest;if(!existing.has(foundation))registry.resources.push({source:foundation,target:'../'+foundation,bytes:bytes.length,sha256:digest,state:'local-reference',access:'現行英語基礎教材の固定manifest。配布可否と教材採用は製品仕様を確認。'});}
 const body=JSON.stringify(assets)+'\n';files.set('data/assets.json',body);files.set('assets-data.js','window.__sansuAssetsGzip='+JSON.stringify(gzipSync(Buffer.from(body),{level:9}).toString('base64'))+';\n');
 registry.assetInventory={count:assets.length,target:'assets.html',data:'data/assets.json',sha256:hash(body),basis:'元map generatorの4 roots/extensionsと現行英語教材public/foundation。symlink/privateを除く。保存元を複製しない。'};
 return assets;
}
