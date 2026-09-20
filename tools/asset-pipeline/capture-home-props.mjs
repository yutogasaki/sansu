// Uses a disposable browser profile. No synthetic credits or external data writes.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const target=process.env.HOME_CAPTURE_URL,out=process.env.HOME_CAPTURE_OUTPUT;
assert(target&&out);await mkdir(out,{recursive:false});
const adopted=process.env.HOME_CAPTURE_ADOPTED==='1';
const report={target,version:await(await fetch(new URL('/version.json',target))).json(),adopted,runs:[]};
const browser=await chromium.launch();
try{for(const width of [390,768]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1024},reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(60000);
 await p.goto(target);for(const name of ['まなぶ','小学 1 年生','さんすう','足し算まで'])await p.getByRole('button',{name,exact:true}).first().click();
 await p.locator('.island-learning[data-input-ready="true"]').waitFor();await p.getByRole('button',{name:'とじる',exact:true}).click();
 await p.locator('.life-world[data-rendered="true"]').waitFor();
 if(adopted)await p.waitForFunction(()=>{try{return JSON.parse(document.querySelector('.life-world').dataset.runtimeAssets).loaded.length===4;}catch{return false;}});
 await p.waitForTimeout(650);await p.screenshot({path:`${out}/${width}-home.png`});
 const world=await p.locator('.life-world').evaluate(n=>({assets:n.dataset.runtimeAssets,render:n.dataset.lifeRender,visual:n.dataset.lifeVisualCandidate}));
 await p.locator('.life-camera-tools summary').click();for(let i=0;i<3;i++)await p.getByRole('button',{name:'しまを おおきく',exact:true}).click();
 await p.screenshot({path:`${out}/${width}-close.png`});assert.deepEqual(errors,[]);
 report.runs.push({width,world,errors});await context.close();
}report.pass=true;
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({pass:report.pass,version:report.version}));
