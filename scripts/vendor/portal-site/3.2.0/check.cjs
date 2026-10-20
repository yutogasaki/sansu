#!/usr/bin/env node
'use strict';
// Checks a generated site: every page has the shared skeleton, every local
// link/image resolves, every #anchor exists. Usage: node check.cjs [dir]
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'preview'));
const pages=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(f.endsWith('.html'))pages.push(f);}})(dir);
const ids=new Map(),problems=[];let links=0;
const idsOf=f=>{if(!ids.has(f)){const h=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';ids.set(f,new Set([...h.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1])));}return ids.get(f);};
for(const f of pages){
 const h=fs.readFileSync(f,'utf8'),name=path.relative(dir,f);
 const framed=/<html\b[^>]*data-portal-site=/.test(h)||/<link rel="stylesheet" href="(?:\.\.\/)*site\.css">/.test(h);
 if(framed)for(const [what,re] of [['bar',/<header class="bar">/],['tabs',/<nav class="tabs"/],['main',/<main id="main">/],['one h1',/^(?:(?!<h1)[\s\S])*<h1[\s\S]*?<\/h1>(?:(?!<h1)[\s\S])*$/],['find',/data-jump/]])if(!re.test(h))problems.push(`${name}: missing ${what}`);
 const body=h.replace(/<script\b[\s\S]*?<\/script>/gi,'');
 for(const m of body.matchAll(/\s(?:href|src)="([^"]*)"/g)){
  const url=m[1].replace(/&amp;/g,'&');if(!url||/^(?:[a-z]+:|\/\/)/i.test(url))continue;links++;
  const [p,hash]=url.split('#'),target=p?path.resolve(path.dirname(f),decodeURIComponent(p.split('?')[0])):f;
  if(p&&!fs.existsSync(target)){problems.push(`${name}: broken ${url}`);continue;}
  if(hash&&target.endsWith('.html')&&!idsOf(target).has(decodeURIComponent(hash)))problems.push(`${name}: missing anchor ${url}`);
 }
}
const result={pages:pages.length,framed:pages.filter(f=>{const h=fs.readFileSync(f,'utf8');return /data-portal-site=|href="(?:\.\.\/)*site\.css"/.test(h);}).length,links,problems:problems.length,examples:problems.slice(0,20)};
console.log(JSON.stringify(result,null,1));process.exitCode=problems.length?1:0;
