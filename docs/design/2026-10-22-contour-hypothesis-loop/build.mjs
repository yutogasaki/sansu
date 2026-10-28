import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./',import.meta.url));
const hashes=Object.fromEntries(['terrain.mjs','viewer.js','index.html','style.css','build.mjs'].map(f=>[f,createHash('sha256').update(fs.readFileSync(dir+f)).digest('hex')]));
const revision=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
const result=await build({entryPoints:[dir+'viewer.js'],bundle:true,format:'esm',minify:true,write:false,define:{LOOP_REVISION:JSON.stringify(revision)}});
fs.writeFileSync(dir+'viewer.bundle.js',result.outputFiles[0].contents);fs.writeFileSync(dir+'source-manifest.json',JSON.stringify({revision,hashes,bundleSha256:createHash('sha256').update(result.outputFiles[0].contents).digest('hex')},null,2)+'\n');console.log(revision);
