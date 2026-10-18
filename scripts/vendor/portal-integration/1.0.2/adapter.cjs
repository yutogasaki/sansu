'use strict';
// A pinned, additive adapter. Never executes repository instructions or mutates source pages.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function apply(root, files) {
  const lockPath = path.join(__dirname, 'lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.version !== '1.0.2') throw new Error('Unsupported integration version');
  for (const [name, digest] of Object.entries(lock.files)) {
    if (hash(fs.readFileSync(path.join(__dirname, name))) !== digest) throw new Error(`Integration vendor changed: ${name}`);
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/portal-unification.json'), 'utf8'));
  const input = {root, config, home: Buffer.from(files.get('index.html')).toString('base64')};
  const output = JSON.parse(execFileSync('python3', [path.join(__dirname, 'integrate.py')], {
    input: JSON.stringify(input), maxBuffer: 512 * 1024 * 1024,
  }));
  for (const [name, content] of Object.entries(output.files)) {
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error('Invalid integration output');
    files.set(name, Buffer.from(content, 'base64'));
  }
  const registry=JSON.parse(files.get('data/unification.json'));
  const sources=new Map();
  for(const entry of [...registry.pages,...registry.documents,...registry.resources]){
    if(entry.sha256)sources.set(entry.source,entry.sha256);
  }
  for(const input of config.inputs||[]){
    if(input.startsWith('/')||input.split('/').includes('..'))throw new Error('Invalid source input');
    sources.set(input,hash(fs.readFileSync(path.join(root,input))));
  }
  for(const [source,digest] of sources){
    if(hash(fs.readFileSync(path.join(root,source)))!==digest)throw new Error(`Source changed during generation: ${source}`);
  }
  const manifest={schemaVersion:1,version:lock.version,acceptance:'unverified',
    original:config.original,sourceFiles:Object.fromEntries(sources),
    outputs:Object.fromEntries([...files].filter(([name])=>name!=='.generated-by-hub-standard').map(([name,body])=>[name,hash(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]))};
  files.set('data/unification-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  return files;
}
function pruneOwnedOutputs(root,files,output='portal'){
  const folder=path.join(root,output),manifestPath=path.join(folder,'data/unification-manifest.json');
  if(!fs.existsSync(manifestPath))return;
  const previous=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const [name,digest] of Object.entries(previous.outputs||{})){
    if(files.has(name)||!/^(?:integrated\/|read\/|(?:search|integration|pages|verification-flow|unification-exclusions)[-.])/.test(name))continue;
    if(name.startsWith('/')||name.split('/').includes('..'))throw new Error('Invalid obsolete output');
    const file=path.join(folder,name);
    if(fs.existsSync(file)){
      if(fs.lstatSync(file).isSymbolicLink()||hash(fs.readFileSync(file))!==digest)throw new Error(`Obsolete output was edited; preserved: ${name}`);
      fs.unlinkSync(file);
    }
  }
}
module.exports = {apply,pruneOwnedOutputs};
