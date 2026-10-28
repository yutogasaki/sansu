import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(directory);
const find = (number, suffix) => {
    const matching = files.filter(name => name.startsWith(`${number}-`) && name.endsWith(suffix));
    assert.equal(matching.length, 1, `${number}/${suffix}`); return matching[0];
};
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,v])=>[key,canonical(v)])) : value;
const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const read = name => JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
const materialFields = ['fixture','land','bridge','terrain','plots','landmarks','keepsakes','villagers','character','drops','town'];
function load(number) {
    const names = Object.fromEntries(Object.entries({before:'before-state.json',after:'cold-state.json',app:'cold-app-dom.json',cpu:'cold-cpu.json',cadence:'cold-cadence.json'}).map(([key,suffix])=>[key,find(number,suffix)]));
    const data = Object.fromEntries(Object.entries(names).map(([key,name])=>[key,read(name)]));
    const changes = [...new Set([...Object.keys(data.before.terrain.heights),...Object.keys(data.after.terrain.heights)])].flatMap(cell=>{
        const before=data.before.terrain.heights[cell]??0, after=data.after.terrain.heights[cell]??0;
        return before===after ? [] : [{cell,before,after}];
    });
    assert.deepEqual(changes,[{cell:'4,4',before:0,after:-1}]);
    const edit={cell:{x:4,z:4},before:0,after:-1};
    assert.deepEqual(data.after.terrain.undo,[...data.before.terrain.undo,edit].slice(-64));
    assert.deepEqual(data.after.terrain.redo,[]);
    for(const field of materialFields.filter(x=>x!=='terrain')) assert(equal(data.before[field],data.after[field]),`${number} unexpected ${field} mutation`);
    for(const key of ['editableIslandWorld:cold','compileWorldDefinition:derived-edges','applyIntent:terrain-edit','GrowingWorld.rebuild:']) {
        assert.equal(data.cpu.aggregates[key].calls,1); assert.equal(data.cpu.aggregates[key].failed,0);
    }
    assert.equal(data.cpu.dropped,0);assert.equal(data.cpu.incompleteSpans,0);
    const clicks=data.cadence.timeline.clicks.filter(click=>click.label==='じめんを さげる');assert.equal(clicks.length,1);
    assert.equal(data.cadence.visibility.hiddenObserved,false);
    const apply=data.cpu.spans.find(span=>span.name==='applyIntent'&&span.detail==='terrain-edit');
    const clickCpuDeltaMs = data.cpu.startedEpochMs + apply.startMs - (Date.parse(data.cadence.startedAt)+clicks[0].atMs);
    assert(Math.abs(clickCpuDeltaMs)<30,`${number}: timing windows do not align`);
    const ag=data.cpu.aggregates;
    const metrics={coldWorldMs:ag['editableIslandWorld:cold'].inclusiveMs,worldSelfMs:ag['editableIslandWorld:cold'].selfMs,
        compileMs:ag['compileWorldDefinition:derived-edges'].inclusiveMs,commandMs:ag['applyIntent:terrain-edit'].inclusiveMs,
        sceneRebuildMs:ag['GrowingWorld.rebuild:'].inclusiveMs,frameMaxMs:data.cadence.intervalMs.max,
        frameMedianMs:data.cadence.intervalMs.median,frameP95Ms:data.cadence.intervalMs.p95,
        over50Ms:data.cadence.over50Ms,longTasks:data.cadence.timeline.longTasks};
    return {number,names,data,changes,metrics,clickCpuDeltaMs};
}
const on=load(77),off=load(78);
assert.deepEqual(on.data.app,off.data.app);
assert.equal(on.data.app['data-build-revision'],'place-method-comparison-v16');
assert.equal(on.data.before.candidate,off.data.before.candidate+'+memo-samples-v1');
assert.equal(on.data.after.candidate,off.data.after.candidate+'+memo-samples-v1');
for(const field of materialFields)for(const phase of ['before','after'])assert(equal(on.data[phase][field],off.data[phase][field]),`${phase}/${field} mismatch`);
function diffPaths(a,b,prefix='') {
    if(equal(a,b)) return [];
    if(a&&b&&typeof a==='object'&&typeof b==='object')return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(key=>diffPaths(a[key],b[key],prefix?`${prefix}.${key}`:key));
    return [prefix];
}
const differences={before:diffPaths(on.data.before,off.data.before),after:diffPaths(on.data.after,off.data.after)};
for(const phase of ['before','after'])assert(differences[phase].every(p=>p==='candidate'||p.startsWith('placeProgress.')||p.startsWith('places.')),`unclassified ${phase} difference`);
const uses=s=>Object.fromEntries(Object.entries(s.placeProgress?.uses??{}).map(([rule,actors])=>[rule,Object.fromEntries(Object.entries(actors).map(([who,value])=>[who,{actorId:value.actorId,targetId:value.targetId,at:value.at,revisionSHA256:hash(value.revision)}]))]));
const metrics=Object.fromEntries(Object.keys(on.metrics).filter(k=>typeof on.metrics[k]==='number').map(key=>[key,{off:off.metrics[key],on:on.metrics[key],reductionMs:Number((off.metrics[key]-on.metrics[key]).toFixed(3)),reductionPercent:off.metrics[key]?Number(((off.metrics[key]-on.metrics[key])/off.metrics[key]*100).toFixed(2)):null}]));
const sourceFiles=[...Object.values(on.names),...Object.values(off.names),'build-place-method-comparison-v16.json'];
const report={status:'COMPARABLE_N1',createdAt:new Date().toISOString(),sourceSHA256:Object.fromEntries(sourceFiles.map(name=>[name,hash(fs.readFileSync(path.join(directory,name),'utf8'))])),
    build:on.data.app,operation:{type:'terrain-edit',cell:{x:4,z:4},delta:-1,before:0,after:-1,undo:'append one entry; retain final 64; redo empty'},
    controls:{sameBuildAndDelivery:true,sameBeforeTerrainIncludingUndo:true,sameAfterTerrainIncludingUndo:true,sameLandAndOwnerState:true,sameOtherRecordedMaterialState:true,onlyCandidateSuffixDifference:'memo-samples-v1',oneSuccessfulColdGenerationEach:true,oneSuccessfulCompileEach:true,oneSuccessfulSceneRebuildEach:true,visibleThroughoutBoth:true},
    observations:{on:{number:77,candidate:on.data.after.candidate,metrics:on.metrics,clickCpuDeltaMs:on.clickCpuDeltaMs,usesBefore:uses(on.data.before),usesAfter:uses(on.data.after)},off:{number:78,candidate:off.data.after.candidate,metrics:off.metrics,clickCpuDeltaMs:off.clickCpuDeltaMs,usesBefore:uses(off.data.before),usesAfter:uses(off.data.after)}},
    metrics,differences,limits:['One cold edit per condition, fixed order memo ON then OFF; not randomized or repeated.','Natural place usage/receipt timing differs; full state equality is not claimed.','Same app DOM build/delivery is recorded; these files do not independently capture viewport/camera matrices or actor instantaneous positions.','CPU spans are synchronous measured roots; GPU, async saves and browser paint are excluded. rAF maximum is an observed interval, not a GPU time.','Both are shore-memory-only fixtures. This does not test persisted DB saves or production release behavior.']};
const saved = read('memo-browser-pair-check.json');
for (const key of ['status','sourceSHA256','build','operation','controls','observations','differences','limits']) assert.deepEqual(report[key], saved[key], 'Saved report mismatch: '+key);
for (const [key,value] of Object.entries(report.metrics)) {
    assert.equal(value.off,saved.metrics[key].off); assert.equal(value.on,saved.metrics[key].on);
    assert.equal(value.reductionPercent,saved.metrics[key].reductionPercent);
    assert.equal(value.reductionMs,saved.metrics[key].reductionMs ?? saved.metrics[key].reductionCount);
}
console.log(JSON.stringify({status:'PASS',comparison:report.status,originalEvidenceUnchanged:true,metrics,differences},null,2));
