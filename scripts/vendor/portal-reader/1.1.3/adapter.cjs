'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function pin(){
 const lock=JSON.parse(fs.readFileSync(path.join(__dirname,'lock.json'),'utf8'));
 if(lock.version!=='1.1.3')throw Error('Unsupported reader component');
 for(const [file,digest]of Object.entries(lock.files)){if(file.includes('/')||sha(fs.readFileSync(path.join(__dirname,file)))!==digest)throw Error('Changed reader component: '+file);}
 return lock;
}
function runtimeSource(){pin();return fs.readFileSync(path.join(__dirname,'reader.js'),'utf8')+'\n';}
function once(source,before,after){if(source.split(before).length!==2)throw Error('Reader integration hook changed: '+before.slice(0,65));return source.replace(before,after);}
function commonSearch(source){
 source=once(source,"query.value.trim().toLocaleLowerCase()","PortalReader.normalize(query.value.trim())");
 const row=/\[row\.text,row\.pageTitle,row\.title,(?:row\.source,)?\.\.\.Object\.values\(row\.attributes\|\|\{\}\)\]\.join\(' '\)\.toLocaleLowerCase\(\)/g;
 if([...source.matchAll(row)].length!==1)throw Error('Reader record normalization hook changed');
 source=source.replace(row,part=>'PortalReader.normalize('+part.slice(0,-'.toLocaleLowerCase()'.length)+')');
 source=once(source,"  query.value = params.get('q') || '';\n  for (const [field, key] of [[category,'category'],[type,'type']]) {\n    field.value = [...field.options].some(option => option.value === params.get(key)) ? params.get(key) : '';\n  }","  PortalReader.restoreFilters({q:query,category,type},location.href);");
 const scope="includeRecords=p.get('scope')==='all';";
 const hasScope=source.includes(scope);
 source=once(source,"addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);"+(hasScope?scope:'')+"query.value=p.get('q')||'';category.value=p.get('category')||'';type.value=p.get('type')||'';draw(false);});","addEventListener('popstate',()=>{"+(hasScope?"includeRecords=new URLSearchParams(location.search).get('scope')==='all';":'')+"PortalReader.restoreFilters({q:query,category,type},location.href);draw(false);});");
 const before="      const url = new URL(location.href);\n      for (const [key, value] of [['q',query.value],['category',category.value],['type',type.value]]) {\n        if (value) url.searchParams.set(key,value); else url.searchParams.delete(key);\n      }\n      history.replaceState(null,'',url);";
 return once(source,hasScope?before.replace("['type',type.value]]","['type',type.value],['scope',includeRecords ? 'all' : '']]"):before,'      PortalReader.saveFilters({q:query,category,type'+(hasScope?",scope:{value:includeRecords ? 'all' : ''}":'')+'},location,history);');
}
function enhance(root,files,{prefix='',search='integration.js',clients=[],sources=[]}={}){
 const lock=pin(),runtime=runtimeSource(),changed=[];
 if(search){const name=prefix+search;if(!files.has(name))throw Error('Missing reader search client: '+name);files.set(name,Buffer.from(runtime+commonSearch(Buffer.from(files.get(name)).toString())));changed.push(name);}
 for(const client of clients){const name=prefix+client;if(!files.has(name))throw Error('Missing reader client: '+name);if(changed.includes(name))continue;files.set(name,Buffer.from(runtime+Buffer.from(files.get(name)).toString()));changed.push(name);}
 require('./library.cjs').enhanceLibrary(files,{prefix});
 const vendorPath=path.relative(root,__dirname).split(path.sep).join('/');
 if(vendorPath.startsWith('../')||path.isAbsolute(vendorPath))throw Error('Reader dependency must be pinned inside its repository');
 const sourceFiles=Object.fromEntries(['lock.json',...Object.keys(lock.files)].map(name=>[vendorPath+'/'+name,sha(fs.readFileSync(path.join(__dirname,name)))]));
 for(const source of sources){if(path.isAbsolute(source)||source.split('/').includes('..'))throw Error('Invalid reader source');sourceFiles[source]=sha(fs.readFileSync(path.join(root,source)));}
 files.set(prefix+'data/reader-component.json',Buffer.from(JSON.stringify({schemaVersion:1,component:'portal-reader',version:lock.version,lockSha256:sha(fs.readFileSync(path.join(__dirname,'lock.json'))),sourceFiles,clients:changed,features:{searchNormalization:!!search,urlRestore:!!search,clipboard:'only where explicitly bound by the repository adapter'},acceptance:'component verification does not accept the whole portal'},null,2)+'\n'));
 const manifestName=prefix+'data/unification-manifest.json';
 if(files.has(manifestName)){
  const manifest=JSON.parse(files.get(manifestName));Object.assign(manifest.sourceFiles,sourceFiles);
  manifest.outputs=Object.fromEntries([...files].filter(([name])=>name.startsWith(prefix)&&name!==manifestName&&!name.endsWith('.generated-by-hub-standard')).map(([name,body])=>[name.slice(prefix.length),sha(typeof body==='string'||Buffer.isBuffer(body)?body:fs.readFileSync(path.join(root,body.source)))]));
  files.set(manifestName,Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 }
 return files;
}
module.exports={enhance,runtimeSource,commonSearch,pin};
