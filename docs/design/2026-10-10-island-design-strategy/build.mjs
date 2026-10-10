import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(root,'references.json'),'utf8'));
const ids=new Set();
for (const ref of data.references) {
 if(ids.has(ref.id)) throw Error(`Duplicate reference ${ref.id}`);
 ids.add(ref.id);
 const file=path.resolve(root,ref.image);
 const bytes=fs.readFileSync(file);
 if(createHash('sha256').update(bytes).digest('hex')!==ref.sha256) throw Error(`Source changed: ${ref.id}`);
 for(const key of ['title','source','kind','observe','take','avoid','next','sourceUrl','captureScope']) if(!ref[key]) throw Error(`${ref.id} missing ${key}`);
}
fs.writeFileSync(path.join(root,'reference-data.js'),`// Generated from references.json by build.mjs.\nwindow.ISLAND_REFERENCES = ${JSON.stringify(data,null,2)};\n`);
console.log(`Validated ${ids.size} references and wrote reference-data.js`);
