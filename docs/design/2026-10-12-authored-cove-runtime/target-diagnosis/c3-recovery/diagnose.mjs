import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';
const basePath='/private/tmp/sansu-authored-cove-c3',root=`${basePath}/candidate`,out=`${basePath}/recovery-diagnosis`;
const sha=v=>createHash('sha256').update(v).digest('hex');
const failureBytes=fs.readFileSync(`${basePath}/full/report.json`),browser=JSON.parse(failureBytes);
const compiled=await build({stdin:{resolveDir:root,contents:`
export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving';
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition';
export { applyIntent } from './src/domain/growingIsland/commands';
export { previewGrowingState } from './src/components/island/growing/objectLayer';
`},bundle:true,packages:'external',format:'esm',platform:'node',write:false,metafile:true,logLevel:'silent'});
fs.writeFileSync(`${out}/domain-bundle.mjs`,compiled.outputFiles[0].contents);
const d=await import(`${out}/domain-bundle.mjs`);
const worldFile='prototypes/place-qa/native05-world.json.gz';
const base=d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(fs.readFileSync(`${root}/${worldFile}`)))));
const frame=s=>d.authoredWorldFrame(s,base,{water:true,cove:true});
const baseline=browser.initialState,storedJSON=browser.failureState,play=s=>s.plots.find(p=>p.id==='p9');
const initial=frame(baseline);
const moved=d.applyIntent(baseline,{id:'diagnostic-c3-move',command:{type:'move',id:'p9',cell:{x:12,z:-9}}},baseline.nature.realAt,initial.world).state;
const movedFrame=frame(moved);
const storedMemory=d.applyIntent(moved,{id:'diagnostic-c3-store',command:{type:'store',id:'p9'}},baseline.nature.realAt,movedFrame.world).state;
// The driver excludes these renderer/command receipts, and so does frame caching.
// Carry the exact failure receipts back to isolate the missing undefined cell key.
storedMemory.applied=structuredClone(storedJSON.applied);storedMemory.placeProgress=structuredClone(storedJSON.placeProgress);
const storedFrame=frame(storedMemory);
const restoredDriver=structuredClone(storedJSON);play(restoredDriver).cell=structuredClone(play(baseline).cell);
const ghost={ownerId:'p9',kind:play(baseline).kind,seed:true,style:play(baseline).style,cell:structuredClone(play(baseline).cell),valid:true,allowed:[structuredClone(play(baseline).cell)]};
const restoredUI=d.previewGrowingState(storedMemory,ghost);
const restoredFromJSON=d.previewGrowingState(storedJSON,ghost);
const driverFrame=frame(restoredDriver),uiFrame=frame(restoredUI),fromJSONFrame=frame(restoredFromJSON);
const confirmed=d.applyIntent(storedMemory,{id:'diagnostic-c3-unstore',command:{type:'unstore',id:'p9',cell:play(baseline).cell}},baseline.nature.realAt,storedFrame.world).state;
const confirmedFrame=frame(confirmed);
const canonical=s=>{const copy=structuredClone(s);delete copy.applied;delete copy.placeProgress;return copy};
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const stateDifferences=(a,b)=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!isDeepStrictEqual(a[k],b[k]));
const brief=(state,f)=>({revision:f.revision,coveRevision:f.covePlan.revision,waterRevision:f.waterPlan.revision,assemblies:f.covePlan.assemblies.length,p9Keys:Object.keys(play(state)),p9OwnCell:Object.hasOwn(play(state),'cell'),p9Cell:play(state).cell??null,canonicalSortedSha256:sha(JSON.stringify(sorted(canonical(state))))});
const inputFiles=[...new Set([...Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>path.relative(root,path.resolve(process.cwd(),p))),worldFile])].sort();
const inputs=inputFiles.map(file=>{const actual=sha(fs.readFileSync(`${root}/${file}`));return {file,sha256:actual,browserInitial:browser.initialInputs[file]??null,browserFinal:browser.finalInputs[file]??null,matches:actual===browser.initialInputs[file]&&actual===browser.finalInputs[file]}});
const result={scope:'Exact c3 browser baseline and stored failure state. Pure actual-command/preview/frame computations only; no browser, core or build run.',sourceReportSha256:sha(failureBytes),sourceClosureUnchanged:browser.sourceClosureUnchanged,initialInputHash:browser.initialInputHash,finalInputHash:browser.finalInputHash,
 browser:{error:browser.error,phase:browser.phase,worldRevision:browser.failureMetadata.worldRevision,previewWorldRevision:browser.failureMetadata.previewWorldRevision,preview:JSON.parse(browser.failureMetadata.authoredCovePreview)},
 states:{baseline:brief(baseline,initial),moved:brief(moved,movedFrame),storedMemory:brief(storedMemory,storedFrame),driverJSONRestored:brief(restoredDriver,driverFrame),UIRestored:brief(restoredUI,uiFrame),previewHelperFromJSON:brief(restoredFromJSON,fromJSONFrame),actualUnstore:brief(confirmed,confirmedFrame)},
 comparisons:{storedMemorySerializesExactlyAsFailure:JSON.stringify(storedMemory)===JSON.stringify(storedJSON),storedMemoryJSONValueEqualsFailure:isDeepStrictEqual(JSON.parse(JSON.stringify(storedMemory)),storedJSON),driverVsUIAllStateValuesEqual:isDeepStrictEqual(restoredDriver,restoredUI),driverVsUIValueDifferentFields:stateDifferences(restoredDriver,restoredUI),driverVsUIStringifiedStateEqual:JSON.stringify(restoredDriver)===JSON.stringify(restoredUI),driverVsUIWaterPlansEqual:isDeepStrictEqual(driverFrame.waterPlan,uiFrame.waterPlan),driverVsUIAssembliesEqual:isDeepStrictEqual(driverFrame.covePlan.assemblies,uiFrame.covePlan.assemblies),driverVsUIFloorsEqual:isDeepStrictEqual(driverFrame.world.floors,uiFrame.world.floors),driverVsUISitesEqual:isDeepStrictEqual(driverFrame.world.sites,uiFrame.world.sites),driverVsUIRevisionEqual:driverFrame.revision===uiFrame.revision,uiRevisionMatchesActualMetadata:uiFrame.revision===browser.failureMetadata.previewWorldRevision,driverRevisionMatchesActualMetadata:driverFrame.revision===browser.failureMetadata.previewWorldRevision,uiMatchesBaselineCanonical:isDeepStrictEqual(canonical(restoredUI),canonical(baseline)),actualUnstoreCanonicalMatchesBaseline:isDeepStrictEqual(canonical(confirmed),canonical(baseline)),actualUnstoreRevisionMatchesInitial:confirmedFrame.revision===initial.revision},
 inputCount:inputs.length,inputHashes:inputs,allInputsMatchBrowser:inputs.every(x=>x.matches)};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(`${out}/exact-input.json`,JSON.stringify({sourceReportSha256:sha(failureBytes),initialState:baseline,failureState:storedJSON,failureMetadata:browser.failureMetadata},null,2)+'\n');
console.log(JSON.stringify({states:result.states,comparisons:result.comparisons,inputCount:inputs.length,allInputsMatchBrowser:result.allInputsMatchBrowser},null,2));
